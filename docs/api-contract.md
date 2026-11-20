# Contrato de la API administrativa

API implementada en mirror-core mediante `src.bootstrap.administration:app`.
Lecturas de metadatos y escrituras declaradas para Laboratorio y Journals.
El acceso está pensado para LAN; autenticación y roles se posponen. No incluir
un secreto en VITE_* ni usar botones ocultos como autorización.

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
  "laboratory_enabled": false,
  "laboratory_global_enabled": false,
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


## Journals

Prefijo `/api/admin`. Schemas específicos y estrictos en
`src/providers/journals-contracts.ts`; el proveedor no convierte errores en fixtures
ni muestra bodies libres del servidor. Las consultas aceptan `AbortSignal` y
usan `cache: no-store`. Las rutas se componen sólo en la API administrativa del core.
Los templates y recorridos pueden incluir `short_description`, metadato opcional
de presentación de hasta 160 caracteres; su ausencia o `null` es compatible con
respuestas anteriores. La propiedad se copia al activar y no contiene la intención
personal. Los demás campos siguen sujetos a validación estricta.

| Método y ruta | Uso |
| --- | --- |
| `GET /journals/templates` | Definiciones instaladas y versionadas, con etapas y catálogos. |
| `GET /users/{id}/journals?limit=20&offset=0` | Configuraciones, total, flag global, acceso de cuenta/workspace y reloj SQL. |
| `GET /users/{id}/journals/{run}?revision=N` | Configuración vigente o histórica. |
| `GET /users/{id}/journals/{run}/revisions?limit=20&offset=0` | Metadatos de revisiones paginados. |
| `POST /users/{id}/journals/preview-activation` | Calendario de activación sin persistir. |
| `POST /users/{id}/journals` | Activar template/versión/zona IANA. |
| `POST /users/{id}/journals/{run}/preview` | Fechas y revisión de respaldo del ajuste propuesto, sin persistir. |
| `PATCH /users/{id}/journals/{run}` | Confirmar etapas restantes y orientación. |
| `POST /users/{id}/journals/{run}/actions` | Pausar/reanudar/avanzar/cerrar con revisión esperada. |

Límites: hasta 50 registros por página, offset hasta 100000. Mutaciones requieren
`Idempotency-Key` UUID, y ajuste/acciones `expected_revision`. Los POST de preview
no requieren clave porque no escriben; todos los POST/PATCH validan el mismo
origen exacto, incluido puerto. El proxy sólo permite estos métodos/rutas.

El PATCH contiene `remaining_stages`, propósito/indicaciones opcionales y
`reviewed_catalogs` con `stage_key` y preguntas revisadas, sin `goal_hash`. El core
calcula la aprobación contra el objetivo resultante y conserva catálogos no
modificados. El panel exige reconocimiento explícito si se guarda una etapa con
respaldo pendiente; mientras tanto no emitirá su pregunta dentro del journal.
Cambiar duración no invalida por sí solo la aprobación de un objetivo.

Las configuraciones incluyen calendario, etapa editable, estado efectivo y
revisión. No incluyen `owner_id`, referencia de captura, texto de intención,
notas o audio. El historial identifica tipo de cambio y origen; la edición de
intención no concede acceso a su texto. Cuentas deshabilitadas y flag apagado
conservan lectura de configuración, con escrituras bloqueadas.

El recibo confirmado devuelve `key`, `run_id`, `revision`, `operation` y
`recorded_at`. No incluye hashes de solicitud. Conflictos devuelven 409; recursos
inexistentes/ajenos 404; configuración inválida 422; persistencia no confirmada
503. Se consumen sólo códigos seguros conocidos; errores de validación no reflejan
los inputs. Ningún éxito optimista sustituye el recibo confirmado.

El editor compara el borrador con la revisión actual después de un conflicto:
combina campos distintos y exige elegir en colisiones. Si avanzó la etapa,
conserva el borrador consultable y bloquea aplicarlo automáticamente sobre una
etapa completada. El calendario lo previsualiza el servidor; JS sólo lo formatea.
Una petición ambigua se conserva por cuenta en memoria con su clave/cuerpo
congelados. Repetirla comprueba o completa el mismo intento; no inicia otro.
Se advierte antes de recargar/cerrar: no se promete recuperación durable del
borrador tras forzar la salida. Consultar configuración/historial antes de crear
otro cambio si se perdió esa sesión.

El contrato de dominio, las garantías SQL y las pruebas se mantienen en
`mirror-core/docs/journals-contract.md`.
