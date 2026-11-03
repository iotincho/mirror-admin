import { describe, expect, it, vi } from 'vitest';
import { configuration } from '../../../providers/journals-test-fixture';
import type { JournalService } from '../../../providers/journals-contracts';
import { adjustment, clone, conflictingFields, createDraft, mergeDraft, signature, validPrompts } from './editor';
import { pendingFor, reserve, send } from './requests';

describe('borrador administrativo y revisiones', () => {
  it('envía sólo etapas pendientes y aprobaciones vigentes, sin intención ni hashes cliente', () => {
    const base = configuration(); base.editable_stage_id = base.stages[1].id;
    const draft = createDraft(base);
    draft.approvals.meaning = signature(draft, draft.stages[1]);
    const body = adjustment(draft);
    expect(body.remaining_stages.map(s => s.key)).toEqual(['meaning', 'daily-life']);
    expect(body.reviewed_catalogs).toHaveLength(1);
    expect(body.reviewed_catalogs[0]).not.toHaveProperty('goal_hash');
    draft.stages[1].objective = 'Otro objetivo';
    expect(adjustment(draft).reviewed_catalogs).toEqual([]);
    draft.stages[1].objective = base.stages[1].definition.objective;
    draft.purpose = 'Otro propósito';
    expect(adjustment(draft).reviewed_catalogs).toEqual([]);
  });
  it('una duración nueva conserva la aprobación del mismo objetivo', () => {
    const draft = createDraft(configuration());
    draft.approvals.explore = signature(draft, draft.stages[0]);
    draft.stages[0].duration_days = 9;
    expect(adjustment(draft).reviewed_catalogs).toHaveLength(1);
  });
  it('valida tres profundidades distintas y preguntas de una línea', () => {
    const prompts = configuration().catalogs[0].prompts;
    expect(validPrompts(prompts)).toBe(true);
    for (const gentle of ['Una frase', '¿Una? ¿Otra?', '¿Una?\nOtra línea', prompts[0].middle]) expect(validPrompts([{ ...prompts[0], gentle }])).toBe(false);
  });
  it('combina un cambio local con una duración concurrente sin sobrescribirla', () => {
    const base = configuration(), draft = createDraft(base), latest = clone(base);
    draft.stages[0].instructions = 'Invitar a observar ejemplos';
    latest.stages[0].definition.duration_days = 9; latest.run.revision = 2;
    expect(conflictingFields(draft, latest)).toEqual([]);
    const merged = mergeDraft(draft, latest, {});
    expect(merged.stages[0].instructions).toBe('Invitar a observar ejemplos');
    expect(merged.stages[0].duration_days).toBe(9);
    expect(adjustment(merged).expected_revision).toBe(2);
    expect(draft.base.run.revision).toBe(1);
  });
  it('exige elección si el mismo campo cambió en ambos lados', () => {
    const base = configuration(), draft = createDraft(base), latest = clone(base);
    draft.stages[0].objective = 'Mi ajuste'; latest.stages[0].definition.objective = 'Otro ajuste';
    expect(() => mergeDraft(draft, latest, {})).toThrow('Elegí');
    expect(mergeDraft(draft, latest, { 'explore.objective': 'local' }).stages[0].objective).toBe('Mi ajuste');
    expect(mergeDraft(draft, latest, { 'explore.objective': 'current' }).stages[0].objective).toBe('Otro ajuste');
  });
  it('conserva la eliminación concurrente de una etapa que no se editó', () => {
    const base = configuration(), draft = createDraft(base), latest = clone(base);
    draft.stages[0].instructions = 'Mi cambio'; latest.stages.pop();
    expect(mergeDraft(draft, latest, {}).stages).toHaveLength(2);
  });
  it('no elimina silenciosamente una etapa futura editada por otra revisión', () => {
    const base = configuration(), draft = createDraft(base), latest = clone(base);
    draft.stages.pop(); latest.stages[2].definition.objective = 'Ajuste concurrente';
    expect(() => mergeDraft(draft, latest, {})).toThrow('Elegí');
    const merged = mergeDraft(draft, latest, { 'daily-life.removal': 'current' });
    expect(merged.stages.at(-1)?.objective).toBe('Ajuste concurrente');
  });
  it('no convierte un borrador antiguo en edición de una etapa ya terminada', () => {
    const base = configuration(), latest = clone(base); latest.editable_stage_id = latest.stages[1].id;
    expect(() => mergeDraft(createDraft(base), latest, {})).toThrow('calendario avanzó');
  });
  it('no descarta un respaldo concurrente al quitar una etapa futura', () => {
    const base = configuration(), draft = createDraft(base), latest = clone(base);
    draft.stages.pop(); latest.catalogs[2].prompts[0].middle = '¿Qué querés volver a mirar?';
    expect(() => mergeDraft(draft, latest, {})).toThrow('Elegí');
    const merged = mergeDraft(draft, latest, { 'daily-life.removal': 'current' });
    expect(merged.stages).toHaveLength(3);
    expect(merged.prompts['daily-life'][0].middle).toBe('¿Qué querés volver a mirar?');
  });
  it('permite recuperar los textos locales si otra revisión quitó la etapa', () => {
    const base = configuration(), draft = createDraft(base), latest = clone(base);
    draft.prompts['daily-life'][0].middle = '¿Qué pregunta sigue abierta?'; latest.stages.pop(); latest.catalogs.pop();
    expect(() => mergeDraft(draft, latest, {})).toThrow('Elegí');
    const merged = mergeDraft(draft, latest, { 'daily-life.removed': 'local' });
    expect(merged.stages).toHaveLength(3);
    expect(merged.prompts['daily-life'][0].middle).toBe('¿Qué pregunta sigue abierta?');
  });
});

describe('guardados sin confirmación', () => {
  it('reintenta con la misma clave y cuerpo, aunque cambie el formulario', async () => {
    const owner = '10000000-0000-4000-8000-000000000009', body = adjustment(createDraft(configuration()));
    const operation = reserve(owner, { kind: 'adjust', command: body, runId: configuration().run.id });
    const call = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockImplementation(async (_owner, _run, _body, key) => ({ key, run_id: operation.runId, revision: 2, operation: 'adjust', recorded_at: '2026-11-03T12:00:00Z' }));
    const service = { adjust: call } as unknown as JournalService;
    await expect(send(service, operation)).rejects.toThrow();
    expect(pendingFor(owner)?.status).toBe('uncertain');
    body.remaining_stages[0].objective = 'Otro cambio';
    expect(() => reserve(owner, { kind: 'adjust', command: body, runId: operation.runId })).toThrow('pendiente');
    await send(service, operation);
    expect(call.mock.calls[0][3]).toBe(call.mock.calls[1][3]);
    expect(call.mock.calls[1][2].remaining_stages[0].objective).toBe('Objetivo 1');
    expect(pendingFor(owner)).toBeUndefined();
  });
  it('rechaza una respuesta de otra solicitud y mantiene aisladas las cuentas', async () => {
    const owner = '10000000-0000-4000-8000-000000000008', other = '10000000-0000-4000-8000-000000000007';
    const op = reserve(owner, { kind: 'activate', command: { template_id: configuration().run.template_id, template_version: 2, timezone: 'UTC' }, runId: null });
    const service = { activate: vi.fn().mockResolvedValue({ key: other, run_id: configuration().run.id, operation: 'activate', revision: 1 }) } as unknown as JournalService;
    await expect(send(service, op)).rejects.toThrow('identidad');
    expect(pendingFor(owner)?.status).toBe('uncertain');
    expect(pendingFor(other)).toBeUndefined();
    service.activate = vi.fn().mockResolvedValue({ key: op.key, run_id: configuration().run.id, operation: 'activate', revision: 1, recorded_at: '2026-11-03T12:00:00Z' });
    await send(service, op);
  });
});
