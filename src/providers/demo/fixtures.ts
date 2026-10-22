import type { AdminUser, DashboardData, Period } from '../contracts';

export const demoUsers: AdminUser[] = [
  { id: '10000000-0000-4000-8000-000000000001', email: 'lucia@example.com', laboratory_enabled: false, laboratory_global_enabled: true, is_active: true, created_at: '2026-10-02T14:00:00Z', last_activity_at: '2026-10-16T14:48:00Z', notes_count: 38 },
  { id: '10000000-0000-4000-8000-000000000002', email: 'martin@example.com', laboratory_enabled: false, laboratory_global_enabled: true, is_active: true, created_at: '2026-10-03T14:00:00Z', last_activity_at: '2026-10-16T14:25:00Z', notes_count: 24 },
  { id: '10000000-0000-4000-8000-000000000003', email: 'sofia@example.com', laboratory_enabled: false, laboratory_global_enabled: true, is_active: true, created_at: null, last_activity_at: '2026-10-16T14:00:00Z', notes_count: 17 },
  { id: '10000000-0000-4000-8000-000000000004', email: 'nicolas@example.com', laboratory_enabled: false, laboratory_global_enabled: true, is_active: false, created_at: '2026-10-08T14:00:00Z', last_activity_at: '2026-10-15T21:42:00Z', notes_count: 9 },
  { id: '10000000-0000-4000-8000-000000000005', email: 'valentina@example.com', laboratory_enabled: false, laboratory_global_enabled: true, is_active: true, created_at: '2026-10-11T14:00:00Z', last_activity_at: '2026-10-15T19:10:00Z', notes_count: 12 },
  ...Array.from({ length: 19 }, (_, index): AdminUser => ({
    id: `10000000-0000-4000-8000-${String(index + 6).padStart(12, '0')}`,
    email: `cuenta${String(index + 6).padStart(2, '0')}@example.com`,
    laboratory_enabled: false, laboratory_global_enabled: true, is_active: index !== 4,
    created_at: index % 4 === 0 ? null : `2026-10-${String(1 + index % 12).padStart(2, '0')}T14:00:00Z`,
    last_activity_at: index % 3 === 0 ? null : '2026-10-14T17:20:00Z',
    notes_count: index % 7 === 0 ? null : index + 2,
  })),
];

export function demoDashboard(period: Period): DashboardData {
  const all = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 8, 17 + index)).toISOString().slice(0, 10);
    return { date, accessed: 8 + Math.floor(index * .28) + (index % 4) * 2, wrote: 3 + Math.floor(index * .23) + (index % 3) };
  });
  const short = period === 7;
  return {
    summary: {
      period_days: period, timezone: 'America/Argentina/Buenos_Aires', updated_at: '2026-10-16T15:00:00Z',
      users_total: demoUsers.length, users_active: demoUsers.filter(user => user.is_active).length,
      users_accessed: short ? 19 : 22, users_wrote: short ? 12 : 18,
      notes_total: 342, notes_created: short ? 53 : 174,
      notes_by_source: { writing: short ? 35 : 114, audio: short ? 18 : 60, imported: short ? 4 : 12 },
      processing: { completed: short ? 56 : 183, failed: short ? 1 : 3, pending: 2, running: 1 },
      coverage: { activity_since: '2026-09-17T03:00:00Z', documents_complete: true },
    },
    activity: all.slice(-period).map(point => ({ ...point, accessed: Math.min(point.accessed, short ? 19 : 22), wrote: Math.min(point.wrote, short ? 12 : 18) })),
  };
}
