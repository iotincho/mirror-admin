export type DataMode = 'demo' | 'api';

export function resolveDataMode(requested: string | undefined, development: boolean): DataMode {
  const mode = requested || 'api';
  if (mode !== 'demo' && mode !== 'api') throw new Error('VITE_DATA_MODE debe ser demo o api.');
  if (mode === 'demo' && !development) throw new Error('La demo solo está disponible en desarrollo.');
  return mode;
}

export function resolveApiBase(requested: string | undefined): string {
  const base = (requested || '/api/admin').replace(/\/+$/, '');
  if (!base.startsWith('/') || base.startsWith('//') || /[?#\\]/.test(base) || base === '') {
    throw new Error('VITE_ADMIN_API_BASE debe ser una ruta relativa al mismo origen.');
  }
  return base;
}

export const settings = {
  dataMode: resolveDataMode(import.meta.env.VITE_DATA_MODE, import.meta.env.DEV),
  apiBase: resolveApiBase(import.meta.env.VITE_ADMIN_API_BASE),
};
