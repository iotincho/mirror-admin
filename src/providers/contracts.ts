import { z } from 'zod';

const count = z.number().int().nonnegative();
const instant = z.string().datetime({ offset: true });
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  is_active: z.boolean(),
  created_at: instant.nullable(),
  last_activity_at: instant.nullable(),
  notes_count: count.nullable(),
});
export type AdminUser = z.infer<typeof UserSchema>;
export const UserListSchema = z.object({ items: z.array(UserSchema), total: count });
export const SummarySchema = z.object({
  period_days: z.union([z.literal(7), z.literal(30)]),
  timezone: z.literal('America/Argentina/Buenos_Aires'),
  updated_at: instant,
  users_total: count,
  users_active: count,
  users_accessed: count.nullable(),
  users_wrote: count.nullable(),
  notes_total: count.nullable(),
  notes_created: count.nullable(),
  notes_by_source: z.object({ writing: count.nullable(), audio: count.nullable(), imported: count.nullable() }),
  processing: z.object({ completed: count, failed: count, pending: count, running: count }),
  coverage: z.object({ activity_since: instant.nullable(), documents_complete: z.boolean(), inventory_synced_at: instant.nullable().optional(), notes_complete: z.boolean().optional() }),
});
export const ActivitySchema = z.object({
  items: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    accessed: count.nullable(),
    wrote: count.nullable(),
  })),
});
export type DashboardSummary = z.infer<typeof SummarySchema>;
export type ActivityPoint = z.infer<typeof ActivitySchema>['items'][number];
export type Period = DashboardSummary['period_days'];
export type DashboardData = { summary: DashboardSummary; activity: ActivityPoint[] };
export interface DashboardService {
  getDashboard(period: Period, signal?: AbortSignal): Promise<DashboardData>;
}
