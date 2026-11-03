import { describe, expect, it, vi } from 'vitest';
import { createApiServices } from './api';
import { JournalRequestError } from './journals-contracts';
import { configuration } from './journals-test-fixture';
import { adjustment, createDraft } from '../features/users/journals/editor';

const owner = '10000000-0000-4000-8000-000000000006', key = '50000000-0000-4000-8000-000000000001';
describe('contrato HTTP de Journals', () => {
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
