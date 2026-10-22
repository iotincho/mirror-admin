import { HttpError } from 'react-admin';
import type { DataProvider, Identifier } from 'react-admin';
import type { AdminUser } from './contracts';
import { parseUserQuery } from './users-query';
import type { UserQuery } from './users-query';

type UserRepository = {
  list(query: UserQuery, signal?: AbortSignal): Promise<{ items: AdminUser[]; total: number }>;
  get(id: Identifier, signal?: AbortSignal): Promise<AdminUser>;
  setLaboratory?(id: Identifier, enabled: boolean): Promise<AdminUser>;
};

export function createUserProvider(repository: UserRepository): DataProvider {
  const requireUsers = (resource: string) => { if (resource !== 'users') throw new HttpError('Recurso no disponible.', 404); };
  const readOnly = async () => { throw new HttpError('Esta operación no está disponible en el panel.', 405); };
  return {
    getList: async (resource, params) => { requireUsers(resource); const result = await repository.list(parseUserQuery(params), params.signal); return { data: result.items, total: result.total }; },
    getOne: async (resource, params) => { requireUsers(resource); return { data: await repository.get(params.id, params.signal) }; },
    getMany: async (resource, params) => { requireUsers(resource); return { data: await Promise.all(params.ids.map(id => repository.get(id, params.signal))) }; },
    getManyReference: async () => { throw new HttpError('Las referencias no están disponibles en esta etapa.', 405); },
    create: readOnly,
    update: async (resource, params) => {
      requireUsers(resource);
      const data = params.data as Record<string, unknown>;
      if (!data || Object.keys(data).length !== 1 || typeof data.laboratory_enabled !== 'boolean' || !repository.setLaboratory) {
        throw new HttpError('Solo se puede modificar el acceso a Laboratorio.', 405);
      }
      return { data: await repository.setLaboratory(params.id, data.laboratory_enabled) };
    },
    updateMany: readOnly, delete: readOnly, deleteMany: readOnly,
    supportAbortSignal: true,
  } as DataProvider;
}
