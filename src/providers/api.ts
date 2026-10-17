import { HttpError } from 'react-admin';
import { z } from 'zod';
import { ActivitySchema, SummarySchema, UserListSchema, UserSchema } from './contracts';
import type { DashboardService } from './contracts';
import { createReadOnlyProvider } from './read-only';
import { queryString } from './users-query';

export function createApiServices(base: string, request: typeof fetch = fetch) {
  async function get<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
    const response = await request(`${base}${path}`, { signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new HttpError(`La API administrativa respondió ${response.status}.`, response.status);
    let body: unknown;
    try { body = await response.json(); }
    catch { throw new HttpError('La API devolvió una respuesta que no es JSON válido.', 502); }
    const result = schema.safeParse(body);
    if (!result.success) throw new HttpError('La API devolvió datos con un formato incompatible.', 502);
    return result.data;
  }
  const dataProvider = createReadOnlyProvider({
    list: (query, signal) => get(`/users?${queryString(query)}`, UserListSchema, signal),
    get: (id, signal) => get(`/users/${encodeURIComponent(String(id))}`, UserSchema, signal),
  });
  const dashboardService: DashboardService = {
    async getDashboard(period, signal) {
      const [summary, activity] = await Promise.all([
        get(`/dashboard/summary?period_days=${period}`, SummarySchema, signal),
        get(`/dashboard/activity?period_days=${period}`, ActivitySchema, signal),
      ]);
      if (summary.period_days !== period) throw new HttpError('La API devolvió un período diferente al solicitado.', 502);
      return { summary, activity: activity.items };
    },
  };
  return { dataProvider, dashboardService };
}
