# mirror-admin

Panel administrativo de El Espejo con React-admin, TypeScript y Vite. Dashboard, listado y detalle de Usuarios, con acceso experimental a Laboratorio por cuenta, conectados a la API administrativa de mirror-core.

## Desarrollo

Requiere Node.js 22.12 o posterior (recomendado Node 22 LTS) y npm.

```sh
npm ci
npm run dev
```

Abrir http://127.0.0.1:5176. Por defecto se consulta la API en http://127.0.0.1:8001 mediante el proxy de Vite. Primero iniciar la API y sincronizar el inventario según los pasos siguientes. Incluye períodos de 7/30 días, gráfico y tabla diaria, búsqueda por correo/ID, estado, ordenamiento, paginación y detalle.

Para acceder desde la LAN, habilitar el host explícitamente:

```sh
npm run dev -- --host 0.0.0.0
```

Esta etapa no incorpora autenticación, roles ni claves administrativas, según el alcance acordado para uso local/LAN. Las variables VITE_* son públicas: no colocar contraseñas ni claves de administrador en ellas. Si luego se agrega una clave desde entorno, se verifica en el servidor.

## Iniciar la API y los datos

```sh
# Desde mirror-core, con DATABASE_URL y WORKSPACES_PATH configurados:
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m src.administration.sync
.venv/bin/python -m uvicorn src.admin_main:app --host 127.0.0.1 --port 8001

# En otro proceso de mirror-core, mantener el inventario actualizado:
.venv/bin/python -m src.administration.sync --interval 30
```

El adaptador consume `/api/admin` en el mismo origen; el proxy de desarrollo apunta a http://127.0.0.1:8001. Copiar `.env.example` a `.env.local` si se necesita ajustar `ADMIN_API_PROXY_TARGET` (solo servidor) o `VITE_ADMIN_API_BASE` (ruta pública relativa).

Los endpoints están implementados en mirror-core. Una falla se muestra como error, nunca se reemplaza por fixtures. El [contrato](docs/api-contract.md) documenta DTO y consultas. El inventario tiene actualización eventual; el dashboard muestra su fecha de sincronización y la cobertura de actividad. Consultas de dashboard/listado se actualizan cada 30 segundos.

Para revisar la interfaz sin backend: `VITE_DATA_MODE=demo npm run dev`. La demo se identifica como **Demo · Datos ficticios**, tiene 24 cuentas example.com y solo existe en desarrollo.

Actividad de la PWA: habilitar `PLATFORM_ACTIVITY_ENABLED=true` en la API pública junto con la PWA actualizada. Es opt-in y comienza a medir desde la primera observación; los períodos anteriores no se inventan. La configuración predeterminada no registra actividad.

## Verificaciones

```sh
npm run check
npm run verify:build
```

Incluye lint, tipos, pruebas de contratos/adaptadores y build. CI ejecuta los mismos checks en PR. El build utiliza el modo API y elimina los fixtures; intentar compilar con VITE_DATA_MODE=demo falla explícitamente.

```sh
npm run build
npm run preview
```

Preview sirve el build en http://127.0.0.1:4176 y requiere la API detrás de un proxy del mismo origen. El proxy de Vite es solo para desarrollo; el proxy de contenedores está configurado en mirror-deploy.

## Organización

- `src/app`: React-admin, layout, navegación y traducciones.
- `src/features/dashboard`: métricas, gráfico accesible y tabla diaria.
- `src/features/users`: listado, detalle y permiso de Laboratorio por cuenta.
- `src/providers`: contratos validados, adaptador HTTP y demo aislada.
- `src/theme`: tokens de El Espejo y ajustes MUI.

La identidad de usuario se muestra con correo e ID, sin nombres inventados. Valores desconocidos se muestran como **Sin datos**; no se convierten a cero. El almacenamiento de preferencias es temporal en memoria, sin persistir datos de cuentas en localStorage.

Implementado en mirror-core: API separada, proyección SQL de metadatos, reconciliación y actividad opt-in. Implementados también imagen compilada, proxy y servicios LAN en el Compose principal. El destino local ya está iniciado. Pendiente: publicar imágenes para otros destinos y desarrollar operaciones administrativas posteriores. La autenticación sigue diferida; no se publicaron imágenes en registry.


## Contenedor y LAN

```sh
docker build -f Dockerfile.prod -t mirror-admin:lan-validation .
```

La imagen sirve el build con Nginx sin root en el puerto 8080. Requiere
`ADMIN_ALLOWED_HOSTS` con hosts exactos separados por espacios y resolver
`admin-api:8000` en su red Docker. Preserva `/api/admin/*`; admite GET/HEAD y, exclusivamente para `/api/admin/users/{id}/laboratory`, PATCH.
Conserva el host y el puerto del navegador para comprobar el origen de la mutación. No contiene demo, credenciales ni servidor de desarrollo.
HTML/API tienen `no-store`; assets con hash tienen caché inmutable.

El [runbook de mirror-deploy](../mirror-deploy/ADMIN-LAN.md) configura el frontend,
API y sincronizador dentro del Compose principal de la plataforma, con PostgreSQL
y volúmenes compartidos y redes separadas, filesystem de solo lectura y tmpfs.
Incluye arranque, migración, volumen de originales, selección de IP/DNS local,
actualización y recuperación. El perfil `admin-lan` activa el panel en ese mismo stack.
No hay autenticación en esta entrega; el destino acordado es local/LAN.

CI de PR agrega build Docker y una prueba HTTP del runtime sin root. El workflow
`publish-production-image.yml` publica al fusionar un PR a `main`, con tags
`YYYY.MM.DD-NNN` y `latest`. Configurar `DOCKERHUB_IMAGE` como variable del repositorio
(por ejemplo, `martinbarrera/mirror-admin`) y los secrets `DOCKERHUB_USERNAME` y
`DOCKERHUB_TOKEN`. Desplegar el tag inmutable fijado en Compose. Esta entrega
prepara el workflow; no publica imágenes ni configura secretos remotos.


## Acceso experimental a Laboratorio

En **Usuarios → Ver cuenta → Laboratorio**, habilitar o quitar el permiso de esa
cuenta. Se guarda al cambiar el interruptor y muestra errores de confirmación.
El panel muestra el permiso en la lista y advierte si el interruptor global está apagado.

Aplicar `alembic upgrade head` (revisión `20261021_17`) en mirror-core antes de
arrancar las nuevas versiones. `PERSONAL_AXES_ENABLED=true` debe compartirse entre
API pública, workers, dispatcher y admin-api. La capacidad efectiva requiere el
interruptor global y `user.laboratory_enabled=true`; por defecto todas las cuentas
quedan sin acceso. El permiso no habilita una cuenta desactivada.

La única escritura habilitada en el panel y en su proxy es
`PATCH /api/admin/users/{id}/laboratory` con `{"laboratory_enabled": true|false}`.
El backend rechaza campos extra, booleanos convertidos y solicitudes de otro origen.
Se mantiene el aislamiento local/LAN y la API pública no registra rutas de admin.
Deshabilitar no borra datos: impide nuevas pruebas y reservas automáticas de ejes,
mientras los trabajos aceptados antes del cambio pueden terminar.


Validación de la extensión: 14 pruebas de proveedor, lint, tipos, build y
`verify:build`. La revisión de Chrome cubrió persistencia tras recarga, errores de
guardado, aviso global apagado y anchos 320/390/768/1440. Capturas con datos
sintéticos en [docs/validation/laboratory-access-2026-10-21](docs/validation/laboratory-access-2026-10-21).
El proxy se verificó además en un contenedor Nginx aislado sin root: PATCH exclusivo,
bloqueo de otras mutaciones y preservación de Host/puerto.

Para repetir el recorrido visual con Playwright instalado y el panel de desarrollo
abierto, ejecutar `node tests/integration/laboratory-browser.cjs`. Acepta
`ADMIN_LABORATORY_ORIGIN`, `LABORATORY_PLAYWRIGHT_MODULE`,
`LABORATORY_CHROMIUM_PATH` y `ADMIN_LABORATORY_SCREENSHOTS`. La API se simula en ese
recorrido; las pruebas de SQL/autorización reales pertenecen a mirror-core.
