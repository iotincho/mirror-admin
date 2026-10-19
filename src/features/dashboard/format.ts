export const formatCount = (value: number | null): string => value === null ? 'Sin datos' : new Intl.NumberFormat('es-AR').format(value);
export const formatInstant = (value: string | null): string => value === null ? 'Sin datos' : new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(value));
export const formatDay = (value: string): string => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
