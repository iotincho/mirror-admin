# Contrato propuesto para la API administrativa

API de solo lectura implementada en mirror-core mediante src.admin_main:app. El acceso está pensado para LAN; autenticación y roles se posponen. No incluir un secreto en VITE_* ni usar el ocultamiento de botones como autorización futura.

## Usuarios

`GET /api/admin/users?page=1&per_page=10&sort=email&order=asc&q=lucia&is_active=true`

- page >= 1; per_page entre 1 y 100.
- sort: email, id, is_active, created_at, last_activity_at, notes_count.
- order: asc o desc. Desempate estable por ID y desconocidos al final.
- q opcional: búsqueda por correo o ID; is_active opcional: true/false.
- Respuesta: `{ "items": [User], "total": 24 }`; total es el conteo luego de filtrar, antes de paginar.
- `GET /api/admin/users/{id}` devuelve User; cuenta inexistente: 404.

```json
{
  "id": "10000000-0000-4000-8000-000000000001",
  "email": "lucia@example.com",
  "is_active": true,
  "created_at": null,
  "last_activity_at": null,
  "notes_count": null
}
```

Fechas ISO 8601 con zona horaria o null. Conteos enteros no negativos o null cuando se desconocen. No exponer nombre inexistente, hashes, OAuth, roles diferidos, secretos de workspace o campos libres de usuario.

## Dashboard

`GET /api/admin/dashboard/summary?period_days=30` (7 o 30).

```json
{
  "period_days": 30,
  "timezone": "America/Argentina/Buenos_Aires",
  "updated_at": "2026-10-16T15:00:00Z",
  "users_total": 24,
  "users_active": 22,
  "users_accessed": null,
  "users_wrote": null,
  "notes_total": null,
  "notes_created": null,
  "notes_by_source": { "writing": null, "audio": null, "imported": null },
  "processing": { "completed": 0, "failed": 0, "pending": 0, "running": 0 },
  "coverage": { "activity_since": null, "documents_complete": false, "inventory_synced_at": null, "notes_complete": false }
}
```

- Totales de usuarios/notas son inventario actual. users_active significa cuenta habilitada, no usuario con actividad.
- users_accessed y users_wrote son personas únicas del período. Escritura incluye notas de texto/audio; importaciones separadas.
- notes_created = writing + audio. imported cuenta incorporaciones por archivo, sin usar la fecha original como fecha de importación.
- processing cuenta workflows principales, sin duplicar extractores hijos. Tasa de éxito = completed/(completed+failed); sin finalizados, Sin datos.
- Conservar null para métricas no medidas. coverage informa cobertura de actividad e inventario; no inventar históricos de alta.

`GET /api/admin/dashboard/activity?period_days=30`

```json
{
  "items": [
    { "date": "2026-10-16", "accessed": null, "wrote": null }
  ]
}
```

Una fila por día, orden ascendente, agrupada en Buenos Aires. Días sin cobertura: null, sin actividad medida: 0. Una serie vacía muestra estado vacío. Resumen y serie deben corresponder al período solicitado.

## Comportamiento del cliente

El adaptador valida respuestas con Zod, respeta AbortSignal, propaga errores HTTP y rechaza formatos incompatibles. Los errores no muestran bodies arbitrarios del servidor. No hay fallback de API a demo. Mutaciones y recursos no soportados se rechazan sin emitir solicitudes. No se envían ni consumen notas, audios, tokens o credenciales.


## Cobertura y sincronización

`inventory_synced_at` es la fecha del snapshot más antiguo entre cuentas. `documents_complete` exige snapshots completos y recientes (300 segundos por defecto); sin ellos, los conteos de inventario se muestran como null. `notes_complete` también exige evidencia de llegada/procedencia para todas las notas indexadas: si falta, notas nuevas/orígenes/escritura se muestran como null. El inventario puede estar completo aunque la historia de incorporaciones sea desconocida.

La API conserva `/api/admin` como prefijo real, sin root_path ni reescritura. Solo el sincronizador independiente accede a originales. Las lecturas de la API usan una transacción PostgreSQL REPEATABLE READ READ ONLY; no incluyen contenido privado. Fallas SQL devuelven 503 genérico y respuestas no-store.

La actividad comienza con la primera señal de foreground de la PWA. El total es actividad observada desde activity_since y el primer día puede ser parcial. No representa histórico anterior ni períodos con la medición deshabilitada. Los procesamientos se agrupan por su fecha de creación en el período y su estado actual; no cuentan extractores hijos. `file_upload` se incluye en importaciones.
