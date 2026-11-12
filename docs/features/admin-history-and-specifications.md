# Historial administrativo y especificaciones

## Uso

El owner con MFA abre **Historial administrativo** desde el dashboard (`/admin/audit`). Puede filtrar por acción y fechas UTC, consultar páginas y reintentar una carga fallida. Los administradores también generan registros, pero no pueden consultar este historial.

Cada evento conserva ID del responsable, fecha, acción e ID del recurso. Los detalles contienen únicamente valores posteriores permitidos: precios, stock, descuentos, estados, rol o tema, según la acción. No son una copia completa del recurso ni una comparación de todos sus campos. El historial comienza con las nuevas operaciones; no reconstruye acciones anteriores.

Se registran creación/edición/archivo de productos y ofertas, confirmación de contacto/pago, cambios de envío, cancelación administrativa, roles, tema, cupones, moderación y eliminación de cuentas de clientes, mensajes y suscriptores. Los reintentos sin un cambio de estado no duplican los eventos de pedidos.

Las mutaciones auditadas y sus eventos se confirman juntos en MongoDB. Si falla la inserción del evento, se revierte el cambio y la API no informa éxito. Las operaciones de inventario conservan su propia transacción. Se requiere un replica set, como para el checkout existente. No hay API de edición o eliminación del historial; un administrador de la base de datos sí puede modificar los datos directamente.

## Especificaciones de productos

En **Nuevo producto** o **Editar**, añadir características con nombre y valor. Se permiten hasta 20 pares, nombres de 1–40 caracteres y valores de 1–200, sin HTML, caracteres de control ni nombres duplicados (ignorando mayúsculas y normalizando Unicode). Los productos anteriores siguen funcionando sin características.

En la API, `specifications` es una lista de objetos `{ name, value }`. Los formularios multipart envían esa lista como JSON en un campo. Omitir el campo al editar conserva lo anterior; `[]` lo elimina explícitamente. La ficha pública usa una lista semántica y no muestra un bloque vacío. El catálogo ya permite seleccionar productos para compararlos mediante `frontend/src/components/catalog/ProductComparison.jsx`; la comparación reutiliza estas especificaciones.

## Índices del historial

El modelo no crea automáticamente sus índices secundarios. Desde `backend`, `npm run db:ensure-audit-indexes` revisa el destino configurado y muestra un plan sin modificar índices. Para aplicar se requiere `--apply --database=<nombre-exacto>` además de la autorización del destino correspondiente. La existencia de índices en Atlas debe comprobarse en el destino autorizado; esta guía y el código del modelo no acreditan su estado en producción.

## Pruebas

Desde `backend`: `npm test` y `npm run test:integration`. La segunda suite crea replica sets temporales e incluye permisos owner/MFA, límites y privacidad de eventos, índices aislados y fallos inyectados de auditoría para comprobar rollback.

Desde `frontend`: `npm run lint`, `npm test`, `npm run build` y `npm run test:browser`. La preparación de Chromium, el aislamiento de red y las limitaciones de las pruebas están en [las instrucciones de navegador](../../frontend/tests/browser/README.md). Las pruebas de navegador usan APIs ficticias; las pruebas de integración del backend verifican persistencia y permisos reales en datos locales.
