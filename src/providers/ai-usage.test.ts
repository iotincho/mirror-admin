import { describe, expect, it, vi } from 'vitest';
import { createApiServices } from './api';
import { createDemoServices } from './demo';

const userId = '10000000-0000-4000-8000-000000000001';
const missing = {
  attempts: 0, unmeasured_attempts: 0, input_tokens: null, output_tokens: null,
  total_tokens: null, duration_seconds: null,
};

function summary(owner: string | null) {
  return {
    period_days: 7,
    user_id: owner,
    timezone: 'America/Argentina/Buenos_Aires',
    updated_at: '2026-11-26T15:00:00Z',
    coverage: 'partial',
    totals: { ...missing, attempts: 1, duration_seconds: 90 },
    daily: Array.from({ length: 7 }, (_, index) => ({
      ...missing,
      date: `2026-11-${20 + index}`,
      coverage: index < 5 ? 'unavailable' : 'complete',
      ...(index === 5 ? { attempts: 1, duration_seconds: 90 } : {}),
      ...(index === 6 ? { input_tokens: 0, output_tokens: 0, total_tokens: 0, duration_seconds: 0 } : {}),
    })),
    by_model: [],
    by_feature: [],
  };
}

describe('consumo de IA', () => {
  it('consulta la cuenta y conserva el cero y el uso desconocido', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(summary(userId)));
    const signal = new AbortController().signal;
    const result = await createApiServices('/api/admin', request).usageService.summary(7, userId, signal);
    expect(request.mock.calls[0][0]).toBe(`/api/admin/usage?period_days=7&user_id=${userId}`);
    expect(request.mock.calls[0][1]).toMatchObject({ signal, cache: 'no-store', credentials: 'omit' });
    expect(result.totals).toMatchObject({ duration_seconds: 90, total_tokens: null });
    expect(result.daily[0]).toMatchObject({ coverage: 'unavailable', total_tokens: null });
    expect(result.daily[6]).toMatchObject({ coverage: 'complete', total_tokens: 0 });
  });

  it('rechaza respuestas de otro alcance', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(summary(userId)));
    await expect(createApiServices('/api/admin', request).usageService.summary(7)).rejects.toMatchObject({ status: 502 });
  });

  it('solicita la página exacta del ranking', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ period_days: 30, page: 2, per_page: 10, total: 11, items: [] }));
    const result = await createApiServices('/api/admin', request).usageService.ranking(30, 2, 10);
    expect(request.mock.calls[0][0]).toBe('/api/admin/usage/users?period_days=30&page=2&per_page=10');
    expect(result).toMatchObject({ page: 2, total: 11 });
  });

  it('deja la medición fuera de los servicios de demo', () => {
    expect(createDemoServices().usageService).toBeNull();
  });
});
