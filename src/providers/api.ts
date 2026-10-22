import { HttpError } from 'react-admin';
import { z } from 'zod';
import { ActivitySchema, SummarySchema, UserListSchema, UserSchema } from './contracts';
import type { DashboardService } from './contracts';
import { createUserProvider } from './users-provider';
import { queryString } from './users-query';

export function createApiServices(base: string, request: typeof fetch = fetch) {
  async function get<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal, mutation?: RequestInit): Promise<T> {
    const response = await request(`${base}${path}`, { signal, cache: 'no-store', ...mutation, headers: { Accept: 'application/json', ...mutation?.headers } });
    if (!response.ok) throw new HttpError(`La API administrativa respondió ${response.status}.`, response.status);
    let body: unknown;
    try { body = await response.json(); }
    catch { throw new HttpError('La API devolvió una respuesta que no es JSON válido.', 502); }
    const result = schema.safeParse(body);
    if (!result.success) throw new HttpError('La API devolvió datos con un formato incompatible.', 502);
    return result.data;
  }
  const dataProvider = createUserProvider({
    list: (query, signal) => get(`/users?${queryString(query)}`, UserListSchema, signal),
    get: (id, signal) => get(`/users/${encodeURIComponent(String(id))}`, UserSchema, signal),
    setLaboratory: (id, enabled) => get(`/users/${encodeURIComponent(String(id))}/laboratory`, UserSchema, undefined, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ laboratory_enabled: enabled }),
    }),
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
