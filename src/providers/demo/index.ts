import { HttpError } from 'react-admin';
import type { DashboardService } from '../contracts';
import { createReadOnlyProvider } from '../read-only';
import { selectUsers } from '../users-query';
import { demoDashboard, demoUsers } from './fixtures';

export function createDemoServices() {
  return {
    dataProvider: createReadOnlyProvider({
      async list(query) { return selectUsers(demoUsers, query); },
      async get(id) {
        const user = demoUsers.find(item => item.id === id);
        if (!user) throw new HttpError('La cuenta de ejemplo no existe.', 404);
        return { ...user };
      },
    }),
    dashboardService: { async getDashboard(period) { return demoDashboard(period); } } satisfies DashboardService,
  };
}
