import { describe, expect, it, vi } from 'vitest';
import { createApiServices } from './api';
import { JournalRequestError } from './journals-contracts';
import { configuration } from './journals-test-fixture';
import { adjustment, createDraft } from '../features/users/journals/editor';

const owner = '10000000-0000-4000-8000-000000000006', key = '50000000-0000-4000-8000-000000000001';
describe('contrato HTTP de Journals', () => {
  it('carga templates legados y el template v3 con su descripción breve', async () => {
    const fixture = configuration();
    const template = { id: fixture.run.template_id, version: 2, name: fixture.run.name, purpose: fixture.run.purpose, instructions: fixture.instructions, stages: fixture.stages.map(stage => stage.definition), catalogs: fixture.catalogs };
    const current = { ...template, version: 3, short_description: 'Dale forma a tu intención.' };
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ items: [template, current] }));
    const templates = await createApiServices('/api/admin', request).journalService.templates();
    expect(templates).toHaveLength(2);
    expect(templates[0].short_description).toBeUndefined();
    expect(templates[1].short_description).toBe(current.short_description);
  });
  it('lee recorridos y previsualizaciones con y sin descripción breve', async () => {
    const legacy = configuration();
    const current = { ...legacy, run: { ...legacy.run, template_version: 3, short_description: 'Dale forma a tu intención.' } };
    const cleared = { ...legacy, run: { ...legacy.run, short_description: null } };
    const account = { enabled: true, account_active: true, workspace_active: true, server_now: legacy.started_at, items: [legacy, current], total: 2 };
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(account)).mockResolvedValueOnce(Response.json(current)).mockResolvedValueOnce(Response.json(cleared));
    const service = createApiServices('/api/admin', request).journalService;
    const result = await service.account(owner);
    expect(result.items[0].run.short_description).toBeUndefined();
    expect(result.items[1].run.short_description).toBe(current.run.short_description);
    const preview = await service.previewActivation(owner, { template_id: current.run.template_id, template_version: 3, timezone: 'UTC' });
    expect(preview.run.short_description).toBe(current.run.short_description);
    expect((await service.detail(owner, cleared.run.id)).run.short_description).toBeNull();
  });
  it('propaga cancelación/no-store en lecturas y valida respuestas privadas incompatibles', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ...configuration(), intention: 'PRIVATE_PERSONAL_CONTENT' }));
    const service = createApiServices('/api/admin', request).journalService;
    const signal = new AbortController().signal;
    await expect(service.detail(owner, configuration().run.id, 1, signal)).rejects.toMatchObject({ status: 502 });
    expect(request.mock.calls[0][1]).toMatchObject({ signal, cache: 'no-store', credentials: 'omit' });
    expect(String(request.mock.calls[0][0])).toContain('?revision=1');
  });
  it('previsualiza sin clave y guarda sólo con el cuerpo permitido y clave explícita', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(configuration())).mockResolvedValueOnce(Response.json({ key, run_id: configuration().run.id, revision: 2, operation: 'adjust', recorded_at: '2026-11-03T12:00:00Z' }));
    const service = createApiServices('/api/admin', request).journalService, body = adjustment(createDraft(configuration()));
    await service.preview(owner, configuration().run.id, body);
    await service.adjust(owner, configuration().run.id, body, key);
    expect(request.mock.calls[0][1]?.headers).not.toHaveProperty('Idempotency-Key');
    expect(request.mock.calls[1][1]).toMatchObject({ method: 'PATCH', headers: { 'Idempotency-Key': key } });
    expect(JSON.parse(String(request.mock.calls[1][1]?.body))).toEqual(body);
    await expect(service.adjust(owner, configuration().run.id, { ...body, owner_id: owner } as typeof body, key)).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('muestra sólo códigos seguros y nunca mensajes libres del servidor', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ detail: 'journal_revision_conflict' }, { status: 409 })).mockResolvedValueOnce(Response.json({ detail: 'PRIVATE_DATABASE_PAYLOAD' }, { status: 503 }));
    const service = createApiServices('/api/admin', request).journalService;
    await expect(service.account(owner)).rejects.toMatchObject({ code: 'journal_revision_conflict', status: 409 });
    try { await service.account(owner); } catch (error) { expect(error).toBeInstanceOf(JournalRequestError); expect(String(error)).not.toContain('PRIVATE'); }
  });
});
