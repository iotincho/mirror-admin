import { z } from 'zod';
import { JournalAccountSchema, JournalActivationSchema, JournalAdjustmentSchema, JournalConfigurationSchema, JournalHistorySchema, JournalLifecycleSchema, JournalReceiptSchema, JournalRequestError, JournalTemplatesSchema } from './journals-contracts';
import type { JournalService } from './journals-contracts';

export type AdministrativeRequest = <T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal, mutation?: RequestInit) => Promise<T>;
const identifier = (value: string) => encodeURIComponent(z.string().uuid().parse(value));
const root = (owner: string) => `/users/${identifier(owner)}/journals`;
const resource = (owner: string, run: string) => `${root(owner)}/${identifier(run)}`;
const post = (body: unknown, key?: string): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': z.string().uuid().parse(key) } : {}) }, body: JSON.stringify(body) });

export function createJournalService(get: AdministrativeRequest): JournalService {
  return {
    templates: async signal => get('/journals/templates', JournalTemplatesSchema, signal).then(result => result.items),
    account: async (owner, offset = 0, signal) => get(`${root(owner)}?limit=20&offset=${z.number().int().nonnegative().parse(offset)}`, JournalAccountSchema, signal),
    detail: async (owner, run, revision, signal) => get(`${resource(owner, run)}${revision ? `?revision=${z.number().int().positive().parse(revision)}` : ''}`, JournalConfigurationSchema, signal),
    history: async (owner, run, offset = 0, signal) => get(`${resource(owner, run)}/revisions?limit=20&offset=${z.number().int().nonnegative().parse(offset)}`, JournalHistorySchema, signal),
    previewActivation: async (owner, body, signal) => get(`${root(owner)}/preview-activation`, JournalConfigurationSchema, signal, post(JournalActivationSchema.parse(body))),
    preview: async (owner, run, body, signal) => get(`${resource(owner, run)}/preview`, JournalConfigurationSchema, signal, post(JournalAdjustmentSchema.parse(body))),
    activate: async (owner, body, key, signal) => get(root(owner), JournalReceiptSchema, signal, post(JournalActivationSchema.parse(body), key)),
    adjust: async (owner, run, body, key, signal) => get(resource(owner, run), JournalReceiptSchema, signal, { ...post(JournalAdjustmentSchema.parse(body), key), method: 'PATCH' }),
    lifecycle: async (owner, run, body, key, signal) => get(`${resource(owner, run)}/actions`, JournalReceiptSchema, signal, post(JournalLifecycleSchema.parse(body), key)),
  };
}

export function unavailableJournalService(): JournalService {
  const unavailable = async () => { throw new JournalRequestError(503, 'journal_demo_unavailable'); };
  return { templates: unavailable, account: unavailable, detail: unavailable, history: unavailable, previewActivation: unavailable, preview: unavailable, activate: unavailable, adjust: unavailable, lifecycle: unavailable };
}
