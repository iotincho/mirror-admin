import { HttpError } from 'react-admin';
import type { DashboardService } from '../contracts';
import { createUserProvider } from '../users-provider';
import { selectUsers } from '../users-query';
import { demoDashboard, demoUsers } from './fixtures';

export function createDemoServices() {
  const users = demoUsers.map(user => ({ ...user }));
  return {
    dataProvider: createUserProvider({
      async list(query) { return selectUsers(users, query); },
      async setLaboratory(id, enabled) {
        const user = users.find(item => item.id === id);
        if (!user) throw new HttpError('La cuenta de ejemplo no existe.', 404);
        user.laboratory_enabled = enabled;
        return { ...user };
      },
      async get(id) {
        const user = users.find(item => item.id === id);
        if (!user) throw new HttpError('La cuenta de ejemplo no existe.', 404);
        return { ...user };
      },
    }),
    dashboardService: { async getDashboard(period) { return demoDashboard(period); } } satisfies DashboardService,
  };
}
