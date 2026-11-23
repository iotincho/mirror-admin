# Journals · Prototipo de administración

Estado: diseño del 3 de noviembre de 2026, **aprobado por el usuario** para
implementar la interfaz de etapa 5. Se mantuvo el alcance completo; el usuario
señaló su complejidad y aprobó avanzar. La implementación conectada a la API vive
en `src/features/users/journals/`; este artefacto conserva la propuesta revisada.
Es un prototipo HTML navegable con datos sintéticos y estado sólo en memoria.

Abrir [index.html](index.html) directamente en el navegador. También se puede servir
desde este directorio:

```sh
python3 -m http.server 8768 --bind 127.0.0.1
```

Luego abrir <http://127.0.0.1:8768/>. No requiere npm, backend, credenciales ni
conexión a servicios externos. Recargar restablece los datos ficticios.

## Propuesta para revisar

La entrada es **Usuarios → Cuenta → Journals**. Mantiene la tipografía, paleta,
sidebar y controles del panel actual. La vista principal presenta propósito,
estado, calendario y origen del recorrido; debajo, etapas ordenadas y foco actual.
En móvil, el foco actual precede al calendario y el editor ocupa la pantalla.

1. **Activación en tres pasos:** template, calendario y confirmación. Se explican
   inicio inmediato, primer día parcial, zona fija y avance automático. La
   activación no cambia las preferencias ni crea otra pregunta ese día.
2. **Edición sobre la copia personal:** nombre, objetivo, indicaciones y duración
   de una etapa, junto al calendario resultante. Se pueden agregar, quitar y
   reordenar etapas futuras. Las completadas se consultan en modo lectura.
   Propósito e indicaciones generales tienen una entrada separada.
3. **Revisión antes del guardado:** comparación antes/después, desplazamiento de
   fechas y efecto sobre las preguntas. Sólo se informa éxito al confirmar.
4. **Preguntas de respaldo:** tres temas y sus tres profundidades. Cambiar
   objetivo o indicaciones exige revisión editorial explícita; cambiar sólo
   duración no. Se conserva la identidad de los temas y los límites del usuario.
   Se puede guardar y revisar después, reconociendo expresamente que esas etapas
   no emitirán la pregunta del journal mientras estén pendientes. Las preguntas
   de respaldo se identifican como tales; no se muestran como una pregunta personal generada.
5. **Pausa, reanudación, avance y cierre:** confirmaciones con su efecto concreto.
   Pausar congela tiempo; reanudar desplaza fechas; avanzar cambia la frontera a
   ese instante; cerrar conserva historia y no permite reanudar esa instancia.
   Completar no activa integración. Repetir usa una copia nueva del template.
6. **Conflictos recuperables:** un guardado fallido mantiene el borrador; una
   revisión concurrente muestra ambas versiones. Los campos diferentes se
   combinan; si cambia un mismo campo se elige cuál conservar antes de revisar
   y guardar. Una confirmación perdida se comprueba como la misma solicitud.
7. **Historial de configuración:** fecha, revisión, tipo de cambio y consulta
   del snapshot. No incorpora notas, audio, intención privada ni identidades
   ficticias de operadores.

La barra inferior pertenece sólo a la revisión del diseño. Permite recorrer
vacío, activo, pausado, completado, cerrado, respaldo pendiente, carga, errores,
conflictos, cuenta inexistente y funcionalidad/cuenta deshabilitadas. Las fechas
son simuladas: el escenario pausado adelanta dos días para mostrar la reanudación.
También se puede abrir `index.html?scenario=empty`, `?scenario=conflict` o cualquier
valor del selector.

## Relación con la implementación

La referencia de comportamiento es el
[contrato de Journals](../../../../mirror-core/docs/journals-contract.md).
La etapa que habilita este diseño está en el
[plan del core](../../../../mirror-core/docs/journals-implementation-plan.md#5-api-y-panel-administrativo).
Los contenidos de template y preguntas se tomaron de su v2 versionada.

El prototipo se mantiene fuera de `src/`, `public/` y de los entrypoints de Vite;
no agrega rutas, proveedores HTTP ni código a la aplicación administrativa.
Los botones simulan resultados, sin persistencia, API, proveedores o notificaciones.
La selección de zona ofrece Buenos Aires y UTC para explorar el flujo; no pretende
reemplazar el selector IANA de la interfaz futura. La resolución de conflictos
simula cambios en una misma etapa; la atomicidad, autorización y recuperación
reales se verificarán al implementar la API y el proveedor HTTP.

## Revisión técnica realizada

Chrome local con perfil efímero, datos sintéticos y sin solicitudes externas.
Ver [resultado](screenshots/result.json). Incluye flujos de activación, edición,
revisión editorial, calendario, etapas futuras, pausa/reanudación, avance/cierre,
repetición, errores, conflictos y consulta histórica. Se comprobaron anchos de
320, 390, 768 y 1440 px sin desbordamiento horizontal y sin errores de JavaScript.
No sustituye la revisión del diseño con el usuario ni la validación de la app real.

Capturas para revisión:

- [Vista de escritorio](screenshots/active-desktop.png).
- [Vista móvil](screenshots/active-mobile.png).
- [Editor móvil](screenshots/stage-editor-mobile.png).
- [Calendario de activación](screenshots/activation-calendar.png).
- [Conflicto de un mismo campo](screenshots/revision-conflict.png).

Para repetir la comprobación, con el servidor local abierto y Playwright disponible:

```sh
JOURNALS_PLAYWRIGHT_MODULE=/ruta/a/playwright \
  node review.cjs
```

Acepta también `JOURNALS_PROTOTYPE_ORIGIN`, `JOURNALS_CHROMIUM_PATH` y
`JOURNALS_PROTOTYPE_SCREENSHOTS`. No instala dependencias. Se verificaron sintaxis
de JavaScript y enlaces de la documentación afectada.

## Revisión acordada

Se aprobaron la ubicación dentro de la cuenta, la edición en panel lateral,
la revisión del respaldo y las confirmaciones. La implementación mantiene los
ajustes avanzados dentro del editor y usa el calendario autoritativo del servidor.
Las pruebas conectadas y sus capturas están en
[validación de etapa 5](../../validation/journals-2026-11-03/result.json).
La etapa 6 tendrá un
prototipo independiente para la experiencia de la PWA.
