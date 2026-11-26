import { HttpError } from 'react-admin';
import { z } from 'zod';
import type { Period } from './contracts';

const count = z.number().int().nonnegative();
const period = z.union([z.literal(7), z.literal(30)]);
const coverage = z.enum(['complete', 'partial', 'unavailable']);
const amounts = z.object({
  attempts: count,
  unmeasured_attempts: count,
  input_tokens: count.nullable(),
  output_tokens: count.nullable(),
  total_tokens: count.nullable(),
  duration_seconds: z.number().finite().nonnegative().nullable(),
});

const Summary = z.object({
  period_days: period,
  user_id: z.string().uuid().nullable(),
  timezone: z.literal('America/Argentina/Buenos_Aires'),
  updated_at: z.string().datetime({ offset: true }),
  coverage,
  totals: amounts,
  daily: z.array(amounts.extend({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), coverage })),
  by_model: z.array(amounts.extend({ provider: z.string(), model: z.string() })),
  by_feature: z.array(amounts.extend({ feature: z.string() })),
});

const Ranking = z.object({
  period_days: period,
  page: count.min(1),
  per_page: count.min(1).max(100),
  total: count,
  items: z.array(amounts.extend({ user_id: z.string().uuid(), email: z.string().email() })),
});

export type UsageAmounts = z.infer<typeof amounts>;
export type AiUsageSummary = z.infer<typeof Summary>;
export interface AiUsageService {
  summary(period: Period, userId?: string, signal?: AbortSignal): Promise<AiUsageSummary>;
  ranking(period: Period, page: number, perPage: number, signal?: AbortSignal): Promise<z.infer<typeof Ranking>>;
}

export function createAiUsageService(
  get: <T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal) => Promise<T>,
): AiUsageService {
  return {
    async summary(days, userId, signal) {
      const params = new URLSearchParams({ period_days: String(days) });
      if (userId !== undefined) params.set('user_id', userId);
      const result = await get(`/usage?${params}`, Summary, signal);
      if (result.period_days !== days || result.user_id !== (userId ?? null) || result.daily.length !== days) {
        throw new HttpError('La API devolvió un alcance de consumo diferente al solicitado.', 502);
      }
      return result;
    },
    async ranking(days, page, perPage, signal) {
      const params = new URLSearchParams({ period_days: String(days), page: String(page), per_page: String(perPage) });
      const result = await get(`/usage/users?${params}`, Ranking, signal);
      if (result.period_days !== days || result.page !== page || result.per_page !== perPage) {
        throw new HttpError('La API devolvió una página de consumo diferente a la solicitada.', 502);
      }
      return result;
    },
  };
}
