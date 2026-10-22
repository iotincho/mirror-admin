import { describe, expect, it, vi } from 'vitest';
import { createApiServices } from './api';
import { createDemoServices } from './demo';
import { demoDashboard, demoUsers } from './demo/fixtures';
import { parseUserQuery, selectUsers } from './users-query';
import { resolveApiBase, resolveDataMode } from '../config/settings';

const listParams = { pagination: { page: 1, perPage: 10 }, sort: { field: 'email', order: 'ASC' as const }, filter: {} };

describe('separación entre demo y API', () => {
  it('solo habilita fixtures en desarrollo explícito o por defecto', () => {
    expect(resolveDataMode(undefined, true)).toBe('api');
    expect(resolveDataMode(undefined, false)).toBe('api');
    expect(resolveDataMode('api', true)).toBe('api');
    expect(() => resolveDataMode('demo', false)).toThrow();
    expect(() => resolveDataMode('typo', true)).toThrow();
  });
  it('mantiene la API en el mismo origen', () => {
    expect(resolveApiBase('/api/admin/')).toBe('/api/admin');
    for (const invalid of ['https://other.example', '//other.example', '/api?key=123']) expect(() => resolveApiBase(invalid)).toThrow();
  });
  it('no transforma una caída de API en datos de demo', async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    const services = createApiServices('/api/admin', request);
    await expect(services.dashboardService.getDashboard(30)).rejects.toThrow('Failed to fetch');
  });
});

describe('lectura de usuarios', () => {
  it('combina búsqueda/estado, pagina sin duplicar y conserva el total filtrado', () => {
    const query = parseUserQuery({ ...listParams, pagination: { page: 1, perPage: 3 }, filter: { q: 'cuenta', is_active: true } });
    const first = selectUsers(demoUsers, query);
    const second = selectUsers(demoUsers, { ...query, page: 2 });
    expect(first.items).toHaveLength(3);
    expect(first.total).toBe(18);
    expect(second.total).toBe(first.total);
    expect(new Set([...first.items, ...second.items].map(user => user.id)).size).toBe(6);
    expect(first.items.every(user => user.is_active && user.email.includes('cuenta'))).toBe(true);
  });
  it('preserva el filtro booleano false al construir la petición real', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ items: [], total: 0 }));
    const { dataProvider } = createApiServices('/api/admin', request);
    const signal = new AbortController().signal;
    await dataProvider.getList('users', { ...listParams, filter: { q: 'a+b@example.com', is_active: false }, signal });
    const url = new URL(String(request.mock.calls[0][0]), 'http://localhost');
    expect(url.searchParams.get('q')).toBe('a+b@example.com');
    expect(url.searchParams.get('is_active')).toBe('false');
    expect(url.searchParams.get('per_page')).toBe('10');
    expect(request.mock.calls[0][1]?.signal).toBe(signal);
  });
  it('rechaza respuestas incompatibles y no convierte faltantes en cero', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ items: [{ ...demoUsers[0], notes_count: 'unknown' }], total: 1 }));
    await expect(createApiServices('/api/admin', request).dataProvider.getList('users', listParams)).rejects.toMatchObject({ status: 502 });
    const demo = createDemoServices();
    const user = await demo.dataProvider.getOne('users', { id: demoUsers[5].id });
    expect(user.data.notes_count).toBeNull();
  });
  it('ordena fechas desconocidas al final en ambos sentidos', () => {
    for (const order of ['ASC', 'DESC'] as const) {
      const result = selectUsers(demoUsers, { page: 1, perPage: 100, sort: 'created_at', order, q: '' });
      const firstNull = result.items.findIndex(user => user.created_at === null);
      expect(result.items.slice(firstNull).every(user => user.created_at === null)).toBe(true);
    }
  });
  it('rechaza ordenamientos y tamaños fuera del contrato', () => {
    expect(() => parseUserQuery({ ...listParams, sort: { field: 'hashed_password', order: 'ASC' } })).toThrow();
    expect(() => parseUserQuery({ ...listParams, pagination: { page: 1, perPage: 101 } })).toThrow();
  });
  it('rechaza mutaciones antes de emitir solicitudes y devuelve 404 para recursos desconocidos', async () => {
    const request = vi.fn<typeof fetch>();
    const provider = createApiServices('/api/admin', request).dataProvider;
    await expect(provider.delete('users', { id: demoUsers[0].id })).rejects.toMatchObject({ status: 405 });
    await expect(provider.getList('secrets', listParams)).rejects.toMatchObject({ status: 404 });
    expect(request).not.toHaveBeenCalled();
    await expect(createDemoServices().dataProvider.getOne('users', { id: 'missing' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('períodos y errores del dashboard', () => {
  it('no acepta un resumen correspondiente a otro período', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async url => String(url).includes('/summary') ? Response.json(demoDashboard(30).summary) : Response.json({ items: demoDashboard(7).activity }));
    await expect(createApiServices('/api/admin', request).dashboardService.getDashboard(7)).rejects.toMatchObject({ status: 502 });
  });
  it('rechaza JSON inválido sin mostrar el body del servidor', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('private-body', { headers: { 'Content-Type': 'text/plain' } }));
    await expect(createApiServices('/api/admin', request).dataProvider.getOne('users', { id: demoUsers[0].id })).rejects.toMatchObject({ status: 502, message: 'La API devolvió una respuesta que no es JSON válido.' });
  });
  it('propaga errores HTTP sin exponer mensajes libres del servidor', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ secret: 'private-body' }, { status: 500 }));
    await expect(createApiServices('/api/admin', request).dataProvider.getOne('users', { id: demoUsers[0].id })).rejects.toMatchObject({ status: 500, message: 'La API administrativa respondió 500.' });
  });
});


describe('acceso experimental por cuenta', () => {
  it('solo emite PATCH del permiso y mantiene separadas las cuentas', async () => {
    const user = { ...demoUsers[0], laboratory_enabled: true };
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(user));
    const provider = createApiServices('/api/admin', request).dataProvider;
    const result = await provider.update('users', { id: user.id, data: { laboratory_enabled: true }, previousData: demoUsers[0] });
    expect(result.data.laboratory_enabled).toBe(true);
    expect(request.mock.calls[0][0]).toBe(`/api/admin/users/${user.id}/laboratory`);
    expect(request.mock.calls[0][1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ laboratory_enabled: true }), headers: { 'Content-Type': 'application/json' } });
    for (const data of [{ is_active: true }, { laboratory_enabled: true, is_superuser: true }, { laboratory_enabled: 'true' }]) {
      await expect(provider.update('users', { id: user.id, data, previousData: demoUsers[0] })).rejects.toMatchObject({ status: 405 });
    }
    expect(request).toHaveBeenCalledTimes(1);
    const demo = createDemoServices().dataProvider;
    await demo.update('users', { id: user.id, data: { laboratory_enabled: true }, previousData: demoUsers[0] });
    expect((await demo.getOne('users', { id: user.id })).data.laboratory_enabled).toBe(true);
    expect((await demo.getOne('users', { id: demoUsers[1].id })).data.laboratory_enabled).toBe(false);
    expect(demoUsers[0].laboratory_enabled).toBe(false);
  });
  it('expone un guardado fallido sin simular un permiso concedido', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}, { status: 503 }));
    await expect(createApiServices('/api/admin', request).dataProvider.update('users', {
      id: demoUsers[0].id, data: { laboratory_enabled: true }, previousData: demoUsers[0],
    })).rejects.toMatchObject({ status: 503 });
  });
});
