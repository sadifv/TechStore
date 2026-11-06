# Historial administrativo, especificaciones y pruebas de navegador

Estado: aprobado por el usuario e implementado; verificación local completada el 2026-11-06.

## Objetivo

Mejorar trazabilidad operativa y fichas de productos; incorporar pruebas de navegador reproducibles al repositorio y a GitHub Actions. Conservar React, Express, JavaScript, sesiones/MFA y flujos actuales.

## Historial administrativo

- Historial consultable solo por el owner con MFA; las acciones de owner y administradores se registran.
- Cubrir cambios de productos (incluidos precio, stock y ofertas), pago/envío/cancelación de pedidos, roles, tema global, cupones, moderación y eliminaciones administrativas.
- Cada entrada identifica responsable por ID, fecha, acción y recurso por ID, con cambios de campos permitidos cuando corresponda. No almacenar cuerpos HTTP completos, contraseñas, tokens, secretos MFA, cookies ni texto personal de clientes.
- No exponer API de edición o eliminación del historial. Consulta paginada con filtros acotados de fecha y acción, e índices explícitos.
- Registrar las mutaciones de datos junto con el evento mediante transacciones cuando correspondan; evitar operaciones paralelas en una sesión MongoDB. No ejecutar migraciones ni crear índices en Atlas durante el desarrollo.
- El historial no reconstruye acciones anteriores ni garantiza resistencia a un administrador de la base de datos. La interfaz debe explicar desde cuándo hay registros.

## Especificaciones técnicas

- Campos opcionales de nombre y valor, editables por owner/admin con MFA en el formulario de producto.
- Máximo 20 pares; nombre hasta 40 caracteres y valor hasta 200, texto plano, sin HTML, objetos anidados, nombres vacíos o duplicados.
- Validación en servidor y esquema; mantener campos públicos en lista explícita. Rechazar datos extraños sin coerción silenciosa.
- Ficha pública con lista semántica de características; productos existentes sin características siguen funcionando y no muestran una sección vacía.
- Conservar especificaciones si un cliente administrativo anterior omite el campo; una lista vacía explícita permite retirarlas.
- No incluir filtros técnicos ni comparador en esta entrega.

## Playwright

- Añadir @playwright/test como dependencia de desarrollo del frontend, configuración JavaScript y scripts de ejecución documentados.
- Casos reproducibles para navegación, sesión (incluidos 401/429), carrito, checkout/error/reintento, tema owner, ficha/especificaciones y consulta del historial.
- Tests de presentación con APIs simuladas y fixtures ficticias; permisos, persistencia y atomicidad permanecen cubiertos por pruebas HTTP/backend e integración MongoDB aislada.
- Chromium en CI, capturas/trazas ante fallos, sin probar mutaciones sobre producción ni depender de sesiones de personas reales.
- Mantener Node 22/24 existentes; acotar instalación de navegadores y ejecución de navegador a un trabajo de CI para evitar duplicación innecesaria.

## Verificación

Pruebas negativas de permisos, validación y privacidad; pruebas de persistencia/auditoría atómica con replica set temporal; lint, tests y build del frontend, suite Playwright y revisión de diff. Actualizar arquitectura, seguridad y documentación de uso. Sin commits ni publicación sin petición expresa.
