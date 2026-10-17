# Dependencias: revisión inicial

2026-10-16: React-admin 5.15.4, React 19.3.1, MUI 7.3.11, Vite 8.3.4. Las versiones efectivas están fijadas en package-lock.json.

`npm audit` informa siete entradas moderadas derivadas de un mismo aviso en `decode-uri-component` 0.2.2, utilizado por `query-string` 7 dentro de React-admin: [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), denegación de servicio al decodificar entradas malformadas. Sin avisos altos/críticos en esa revisión.

La corrección disponible en decode-uri-component 0.5.0 usa ESM; query-string 7 consume CommonJS. No se aplica un override incompatible ni `npm audit fix --force` (que propone degradar React-admin a 0.0.6). Queda pendiente una actualización compatible upstream o una mitigación específica validada. La interfaz actual usa fixtures en desarrollo y un contrato de lectura preparado para LAN.

El build inicial de React-admin/MUI genera un chunk principal de aproximadamente 1,1 MB (350 KB gzip); una optimización de carga por módulos puede hacerse al ampliar el panel. No se modificó el umbral de advertencia para ocultarlo.
