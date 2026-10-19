import { HttpError } from 'react-admin';
import type { GetListParams } from 'react-admin';
import type { AdminUser } from './contracts';

export const sortFields = ['email', 'id', 'is_active', 'created_at', 'last_activity_at', 'notes_count'] as const;
export type UserSort = typeof sortFields[number];
export type UserQuery = { page: number; perPage: number; sort: UserSort; order: 'ASC' | 'DESC'; q: string; isActive?: boolean };

export function parseUserQuery(params: GetListParams): UserQuery {
  const { page, perPage } = params.pagination ?? { page: 1, perPage: 10 };
  const { field, order } = params.sort ?? { field: 'email', order: 'ASC' };
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(perPage) || perPage < 1 || perPage > 100) {
    throw new HttpError('La paginación debe usar páginas positivas y entre 1 y 100 resultados.', 400);
  }
  if (!sortFields.includes(field as UserSort) || !['ASC', 'DESC'].includes(order)) {
    throw new HttpError('Ordenamiento no permitido.', 400);
  }
  const filter = params.filter as Record<string, unknown> | undefined;
  const active = filter?.is_active;
  if (active !== undefined && active !== '' && typeof active !== 'boolean') {
    throw new HttpError('Filtro de estado inválido.', 400);
  }
  if (filter?.q !== undefined && typeof filter.q !== 'string') throw new HttpError('Búsqueda inválida.', 400);
  return { page, perPage, sort: field as UserSort, order: order as 'ASC' | 'DESC', q: ((filter?.q as string) || '').trim(), isActive: typeof active === 'boolean' ? active : undefined };
}

export function queryString(query: UserQuery): string {
  const params = new URLSearchParams({ page: String(query.page), per_page: String(query.perPage), sort: query.sort, order: query.order.toLowerCase() });
  if (query.q) params.set('q', query.q);
  if (query.isActive !== undefined) params.set('is_active', String(query.isActive));
  return params.toString();
}

export function selectUsers(users: AdminUser[], query: UserQuery): { items: AdminUser[]; total: number } {
  const search = query.q.toLocaleLowerCase('es');
  const filtered = users.filter(user => `${user.email} ${user.id}`.toLocaleLowerCase('es').includes(search) && (query.isActive === undefined || user.is_active === query.isActive));
  filtered.sort((a, b) => {
    const av = a[query.sort], bv = b[query.sort];
    if (av === null || bv === null) return av === bv ? a.id.localeCompare(b.id) : av === null ? 1 : -1;
    const compare = typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv, 'es') : Number(av) - Number(bv);
    return (query.order === 'ASC' ? compare : -compare) || a.id.localeCompare(b.id);
  });
  const start = (query.page - 1) * query.perPage;
  return { items: filtered.slice(start, start + query.perPage), total: filtered.length };
}
