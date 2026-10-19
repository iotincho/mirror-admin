import { settings } from '../config/settings';
import { createApiServices } from './api';

// El import de fixtures solo se conserva en desarrollo. Nunca es fallback de la API.
export const services = import.meta.env.DEV && settings.dataMode === 'demo'
  ? (await import('./demo')).createDemoServices()
  : createApiServices(settings.apiBase);
