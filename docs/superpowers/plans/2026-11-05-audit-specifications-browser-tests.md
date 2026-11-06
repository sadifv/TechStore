# Implementación aprobada

Especificación: `../specs/2026-11-05-audit-specifications-browser-tests.md`, aprobada por el usuario.
Trabajar en developer actual, conservando cambios existentes. Sin commits ni despliegue.

- [x] Especificaciones: normalizador de pares, esquema Product, serialización pública, formulario administrativo y ficha semántica. Probar límites, HTML, duplicados, omisión y lista vacía antes de integrar.
- [x] Historial backend: modelo de eventos con lista cerrada de acciones/campos, servicio de registro integrado a mutaciones, transacciones donde corresponda, consulta owner/MFA paginada y filtros limitados. Probar permisos, redacción, rollback y persistencia con replica set temporal. No indexar Atlas.
- [x] Historial frontend: página owner, carga/error/vacío, filtros y paginación con API común. Añadir ruta y enlace exclusivo owner; backend verifica permisos independientemente.
- [x] Playwright: dependencia de desarrollo, configuración JavaScript, fixtures ficticias, servidor local Vite y escenarios de navegación/sesión/carrito/checkout/temas/especificaciones/historial. Ajustar npm test para no ejecutar specs Playwright con node:test. Añadir trabajo Chromium en CI.
- [x] Integración: revisar conflictos entre producto/auditoría y contratos de fixtures; pruebas completas backend/frontend, integración local, lint/build, Playwright; revisión independiente y diff --check.
- [x] Documentar arquitectura, límites de auditoría, uso de especificaciones y comandos reproducibles. Informar servicios y producción no comprobados.

Verificación final 2026-11-06: backend 149 correctas (46 casos de integración omitidos en la suite normal), integración aislada 58 correctas, frontend 30 correctas, Playwright Chromium 14 correctas, lint/build correctos y auditorías npm sin vulnerabilidades reportadas. Revisión independiente sin hallazgos pendientes tras reparar una prueba interrumpida. Sin commits, despliegue ni aplicación de índices en Atlas.
