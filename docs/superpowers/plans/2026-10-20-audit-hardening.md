# Remediación integral de TechStore — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. El usuario ya eligió ejecución nativa en esta conversación; conservar ese método.

**Goal:** Corregir los once hallazgos de la auditoría sin alterar el checkout por WhatsApp ni perder datos históricos.
**Architecture:** Reforzar las sesiones existentes con evidencia MFA y revocación uniforme. Hacer atómicos los efectos comerciales mediante transacciones MongoDB, coordinar reservas con leases separados de Product y archivar productos. Centralizar precios vigentes y snapshots; después ajustar índices y frontend.
**Tech Stack:** JavaScript, React/Vite, Express, Mongoose, Node Test Runner, mongod local.
**Spec:** docs/superpowers/specs/2026-10-20-audit-hardening-design.md

## Global Constraints

- Conservar React/Vite/JavaScript, Express, sesiones MongoDB y checkout por WhatsApp.
- No incorporar JWT, servicios externos ni dependencias nuevas de producción.
- Trabajar en developer conservando el cambio de formato existente de CatalogPage.jsx.
- La publicación y los cambios de índices en Atlas quedan para una acción de release/aplicación explícita posterior.
- No registrar claves, contraseñas, TOTP, códigos de recuperación ni detalles personales durante estos flujos.
- No modificar datos históricos de producción por suposiciones.
- No hacer commit/push/promoción ni desplegar durante esta implementación.
- Usar transacciones secuenciales: no ejecutar Promise.all sobre una ClientSession.
- No introducir sinks HTML inseguros ni manipulación manual de nodos controlados por React.

## Review Focus

1. Reset de contraseña entre validar el desafío y consumir TOTP/recuperación: el filtro atómico debe rechazarlo. Pruebas en tarea 1.
2. Pérdida de lease o respuesta de commit incierta: abortar de forma segura o recuperar el pedido por clave, sin duplicar stock/cupón. Pruebas en tareas 3 y 5.
3. Convivencia con pedidos anteriores y marcadores de restitución ya aplicados: no sumar inventario dos veces. Pruebas en tarea 6.
4. Producto archivado/borrado mientras existe una orden: historial legible y cancelación completa para los demás artículos/cupón. Pruebas en tareas 2 y 6.
5. Oferta que vence durante un reintento y URL que falla durante render: preservar precio del pedido persistido y mostrar 404/fallback. Pruebas en tareas 5 y 9.

## Organización y entregables

El plan se ejecuta en bloques revisables: identidad (1), disponibilidad y preparación de transacciones (2–4), atomicidad comercial (5–6), precios/contratos/índices (7–8), frontend y revisión (9–10). Cada bloque deja contratos comprobables; no se requiere publicar bloques intermedios.

Nuevos módulos:

- backend/services/productPricing.js: precio efectivo y normalización pública de oferta.
- backend/services/productAvailability.js: criterios compartidos de producto activo.
- backend/services/inventoryTransaction.js: transacción y validación del lease, sin fallback no atómico.
- backend/services/checkoutService.js: unidad comercial del checkout, independiente de req/res.
- backend/tests/helpers/localReplicaSet.js: ciclo de vida de Mongo temporal.
- backend/scripts/runIntegrationTests.js: ejecución explícita de pruebas con replica set.
- backend/scripts/ensureCatalogIndexes.js: vista previa/aplicación controlada de índices.
- frontend/src/routeSegments.js: decodificación de segmentos.
- frontend/src/components/AppErrorBoundary.jsx: recuperación de render/chunks.
- frontend/src/components/account/orderItemDisplay.js: presentación histórica por snapshot.

No crear un framework de repositorios ni reorganizar módulos ajenos a estos flujos.

---

### Tarea 1: MFA, revocación y autenticación opcional

**Archivos:** modificar backend/controllers/authController.js, backend/middleware/authMiddleware.js, backend/routes/orderRoutes.js; ampliar backend/tests/adminMfaAuth.test.js, backend/tests/authMiddleware.test.js y backend/tests/whatsappRoutes.test.js.

**Interfaces:**

- requireOptionalAuth(req, res, next): invitado continúa; identidad presente revocada/borrada obtiene 401.
- requireAdminMfaPreauth(req, res, next): consulta usuario/rol/versión, publica req.adminMfaPreauth validado.
- Sesión autorizada admin: session.authLevel = 'mfa', fuera de session.user para que loadCurrentUser no lo sobrescriba.
- Preauth: { userId, authVersion, mode, expiresAt, pendingSecret? }; conservar límite de diez minutos.

- [ ] Escribir pruebas que rechacen sesión admin legacy, cliente promovido, desafío expirado y desafío cuya authVersion cambió. Afirmaciones centrales: next no se llama; estado 401/403; no aparece session.user.
- [ ] Ejecutar desde backend: node --test tests/adminMfaAuth.test.js tests/authMiddleware.test.js tests/whatsappRoutes.test.js. Confirmar fallo por controles ausentes.
- [ ] Implementar authLevel solo en éxito MFA/enrolamiento y limpiar desafíos inválidos. Incluir authVersion en todos los filtros atómicos de confirmación, replay TOTP, recuperación y recuperación tras rotación.
- [ ] Montar requireOptionalAuth antes de checkout/success y derivar usuario solo de identidad validada; preservar invitado y checkoutKey.
- [ ] Añadir carrera simulada: la versión cambia después del middleware pero antes de findOneAndUpdate; no emitir sesión. Actualizar fixture HTTP para marcar explícitamente al admin que completó MFA.
- [ ] Repetir pruebas enfocadas. Login cliente, recuperación de un uso y rechazo de replay deben seguir pasando.

### Tarea 2: Archivado y precio efectivo como contratos compartidos

**Archivos:** crear backend/services/productPricing.js, backend/services/productAvailability.js y pruebas respectivas; modificar backend/models/Product.js, backend/controllers/productController.js, backend/controllers/adminController.js, backend/controllers/aiController.js, backend/routes/cartRoutes.js, frontend/src/components/admin/DashboardPage.jsx y sus pruebas de backend existentes.

**Interfaces:**

- getEffectivePrice(product, nowMs = Date.now()) -> number.
- toPublicProduct(product, nowMs) -> copia con price efectivo y metadatos de oferta coherentes; no muta documento/snapshot.
- activeProductFilter() -> { archivedAt: null }, compatible con documentos sin campo.
- isProductArchived(product) -> boolean.
- Product.archivedAt: Date opcional; DELETE /admin/products/:id archiva y conserva respuesta success.

- [ ] Escribir pruebas de oferta vigente/vencida/sin oferta, precio original igual a cero y ausencia de originalPrice. Afirmar que no muta input ni cambia precios de órdenes existentes.
- [ ] Ejecutar node --test tests/productPricing.test.js tests/productAvailability.test.js y comprobar fallo esperado.
- [ ] Añadir archivedAt y helpers. Cambiar borrado físico por actualización de archivedAt; rechazar edición/reoferta de archivados como activos.
- [ ] Filtrar archivados en catálogo/detalle/home/bot/dashboard normal y nuevas reservas. En carrito devolverlos como no disponibles y mantener identificador eliminable; no perder el snapshot de pedidos.
- [ ] Aplicar precio efectivo a respuestas públicas/carrito/bot. Mantener consulta de oferta activa y agregar descripción solo a la proyección de oferta.
- [ ] Repetir pruebas nuevas y productHome, productControllerBatch, cart, aiInputValidation, adminDashboard. Verificar que no reaparece un producto archivado por un query alternativo.
- [ ] Ajustar copia del panel de eliminar a archivar. Revisar el diff de CatalogPage.jsx para confirmar que no se tocó.

### Tarea 3: Leases de inventario separados de Product

**Archivos:** modificar backend/services/productReservationLock.js, backend/models/MaintenanceLock.js solo si fuese necesario, backend/routes/cartRoutes.js, backend/controllers/orderCheckoutController.js, backend/services/orderInventory.js y backend/tests/productReservationLock.test.js; adaptar mocks afectados.

**Interfaces:**

- acquireProductReservationLocks(productIds) -> Promise<lease>.
- lease = { assertOwned(options = {}): Promise<void>, release(): Promise<void> }; options.session permite participar en transacción.
- withProductReservationLock(productId, operation) -> Promise<resultado>; operation recibe lease.
- Usar maintenance_locks con \_id = product-reservation:<id>, ownerToken y leaseUntil; adquisición ordenada, lease 30 s, espera 2 s, reintento 25 ms y renovación cada 10 s.

- [ ] Escribir pruebas: mismo producto serializado, productos diferentes independientes, adquisición ordenada, expiración, pérdida de token y liberación por dueño; assertOwned rechaza lease perdido.
- [ ] Ejecutar node --test tests/productReservationLock.test.js y confirmar fallo por la interfaz/comportamiento nuevo.
- [ ] Mover almacenamiento del lease al modelo existente y adaptar callers. No borrar campos legacy ni colecciones.
- [ ] assertOwned con sesión realizará una escritura condicional del lease dentro de la transacción, para que una pérdida/transferencia concurrente fuerce conflicto o rechazo. Renovaciones externas y reintentos no pueden autorizar un token ajeno.
- [ ] Revisar retorno de errores y finally: liberar todos los leases adquiridos aunque falle uno; no enmascarar silenciosamente una pérdida de exclusividad.
- [ ] Repetir pruebas de locks, cart, orderController y whatsappCheckout; no afirmar garantías transaccionales todavía.

### Tarea 4: Pruebas de integración con Mongo temporal y unidad transaccional

**Archivos:** crear backend/tests/helpers/localReplicaSet.js, backend/tests/inventoryTransaction.integration.test.js, backend/services/inventoryTransaction.js y backend/scripts/runIntegrationTests.js; modificar backend/package.json.

**Interfaces:**

- startLocalReplicaSet() -> Promise<{ uri, stop() }>.
- withInventoryTransaction(operation, { lease } = {}) -> Promise<resultado>; operation(session) es reintentable y no tiene efectos externos.
- npm run test:integration ejecuta los archivos .integration.test.js con TECHSTORE_INTEGRATION=1. La suite normal informa skip explícito cuando falta esa bandera.

- [ ] Crear prueba real: escribir dos colecciones y lanzar error entre escrituras; tras abortar, ambas conservan estado original. Confirmar fallo antes de implementar el helper transaccional.
- [ ] Lanzar únicamente mongod identificado en la exploración, con bind_ip 127.0.0.1, puerto libre, dbPath de mkdtemp y replica set de un nodo. Usar spawn con windowsHide en Windows.
- [ ] Inicializar replica set y esperar PRIMARY con plazo acotado. No leer .env ni usar MONGO_URI de aplicación.
- [ ] stop debe cerrar conexiones, terminar solo el proceso creado y comprobar la ruta absoluta bajo el directorio temporal antes de borrarla; debe funcionar también tras fallo de bootstrap.
- [ ] Implementar transaction de Mongoose con guard del lease, propagación de errores y ausencia de fallback. No ejecutar escrituras en paralelo en la misma sesión.
- [ ] Ejecutar npm run test:integration. Esperado: Mongo real confirma commit, rollback y limpieza de recursos.
- [ ] Si el sandbox bloquea sockets/procesos locales, pedir escalación de ese comando; no cambiar destino a Atlas ni usar la base de desarrollo.

### Tarea 5: Checkout atómico, precios e idempotencia

**Archivos:** crear backend/services/checkoutService.js y backend/tests/checkoutTransactions.integration.test.js; modificar backend/controllers/orderCheckoutController.js, backend/services/couponService.js, backend/models/Reservation.js y pruebas/harness de órdenes existentes.

**Interfaces:**

- createCheckout({ items, userId, guestInfo, shippingAddress, couponCode, checkoutKey, checkoutRequestHash }) -> Promise<Order>.
- Añadir options = { session } a helpers de cupones y consultas de reservas que lo necesiten; callers existentes sin options conservan contrato.
- Consumir getEffectivePrice y activeProductFilter de tarea 2 y lease de tarea 3.
- Dejar hashes/validación HTTP en controlador; la respuesta conserva orderId y whatsappUrl.

- [ ] Escribir integración que provoque un error en la persistencia del pedido después de descontar stock: afirmar stock original, cupón sin uso nuevo, reservas activas originales y ausencia de pedido confirmado.
- [ ] Ejecutar npm run test:integration y observar fallo de atomicidad con implementación previa.
- [ ] Mover creación, precio, descuento de stock, marca inventoryReserved, cupón y reservas a la misma sesión. Guardar checkoutState ready dentro de la unidad confirmada.
- [ ] Sustituir compensación de errores de transacción por rollback; recuperar resultado persistido ante duplicado/commit incierto por checkoutKey. Conservar 409 si payload difiere.
- [ ] Añadir carreras reales de última unidad, reserva de otro usuario y dos claves iguales. Afirmar un solo pedido/descuento y stock no negativo. Añadir reintento después de vencer oferta: reutiliza el snapshot del pedido ya creado.
- [ ] Coordinar mutaciones de reservas del carrito que afectan disponibilidad con el mismo lease y transacción corta; incluir guard transaccional antes de confirmar para evitar reservas excesivas si se pierde el lease.
- [ ] Ejecutar suites enfocadas y test:integration. Verificar checkout invitado, autenticado, cupón al límite y rollback por cupón agotado.

### Tarea 6: Pago, cancelación y compatibilidad histórica

**Archivos:** modificar backend/services/orderInventory.js, backend/services/orderPayment.js, backend/services/couponService.js, backend/models/Order.js, backend/services/maintenanceJobs.js y pruebas de órdenes; crear backend/tests/orderLifecycle.integration.test.js.

**Interfaces:**

- Conservar markOrderAsPaid(orderId, actor), restoreOrderInventory(orderId, items?, reason?, actor) y reconciliación del carrito.
- Las operaciones internas de cupón aceptan la sesión de tarea 5.
- Evento inventory_product_missing con product opcional en schema events identifica la referencia ausente.
- maintenanceJobs importa directamente orderInventory, sin atravesar controladores.

- [ ] Escribir pruebas de rollback de cancelación y de confirmación cuando falla el cupón; ninguna colección puede quedar en estado comercial distinto.
- [ ] Ejecutar pruebas antes de implementar y confirmar fallo de atomicidad.
- [ ] Transaccionar transición de estado, restitución/consumo de cupón e inventario. Mantener predicados excluyentes pending/paid/failed.
- [ ] Conservar compatibilidad con inventoryRestorationKeys anteriores: si el marcador ya existe, no sumar otra vez. Limpiar marcadores únicamente tras confirmar la operación correspondiente.
- [ ] Añadir carreras pago/cancelación y cancelaciones repetidas. Afirmar una sola transición válida y un único efecto en stock/cupón.
- [ ] Añadir producto archivado, producto físicamente ausente y pedido mixto: restaurar artículos existentes, registrar ausencia y liberar cupón una sola vez. No recrear productos.
- [ ] Verificar que reconciliación del carrito respeta snapshot y conserva cambios posteriores; cron no actúa sobre un pago ya confirmado.
- [ ] Ejecutar orderController, whatsappCheckout, couponService, whatsappRoutes y test:integration.

### Tarea 7: Presentación histórica por snapshots

**Archivos:** crear frontend/src/components/account/orderItemDisplay.js y su prueba; modificar ProfilePage.jsx, admin/OrderPages.jsx y admin/CheckoutSuccessPage.jsx donde exista lectura histórica; ampliar prueba productHome.

**Interfaces:**

- getOrderItemName(item) -> string: productName, luego product.name, luego fallback legible.
- Precio histórico siempre item.price cuando existe, sin sustituirlo por una oferta actual.

- [ ] Escribir pruebas con producto renombrado/borrado y pedido antiguo sin snapshot; afirmar nombre de compra y precio histórico. Ejecutar node --test src/components/account/orderItemDisplay.test.js desde frontend y observar fallo.
- [ ] Implementar helper y usarlo en historial, detalle e impresión. Revisar otras vistas de pedidos para evitar criterios diferentes.
- [ ] Confirmar contrato de descripción de oferta y que home mantiene máximo de ocho destacados.
- [ ] Repetir pruebas frontend y productHome de backend; inspeccionar ejemplo visual con snapshot y referencia ausente.

### Tarea 8: Índices y migración controlada

**Archivos:** crear backend/services/catalogIndexes.js, backend/scripts/ensureCatalogIndexes.js, backend/tests/catalogIndexes.test.js y backend/tests/catalogIndexes.integration.test.js; modificar backend/package.json y README.md.

**Interfaces:**

- ensureCatalogIndexes(db, { apply = false } = {}) -> Promise<lista de acciones>.
- Índices candidatos alineados con archivedAt: products { archivedAt: 1, createdAt: -1 }; products { archivedAt: 1, flashSale: 1, flashSaleEndsAt: 1 }; reservations { product: 1, status: 1, expiresAt: 1 }.
- Script db:ensure-catalog-indexes; dry-run por defecto, --apply explícito. No dropIndex ni cambios de datos.

- [ ] Escribir pruebas de dry-run sin escrituras, aplicación e idempotencia; no recrear equivalentes por distinto nombre y detectar conflictos sin borrar índices.
- [ ] Ejecutar node --test tests/catalogIndexes.test.js antes y después de implementar.
- [ ] En replica set temporal, sembrar catálogo representativo sin datos reales y comparar explain antes/después para recientes activos y próxima oferta. Si no mejora, ajustar claves según consultas de tarea 2 y registrar decisión.
- [ ] Centralizar las nuevas definiciones en catalogIndexes.js, consumido por migración y pruebas. No añadirlas a schema.index si autoIndex puede crearlas al desplegar: su aplicación debe pasar únicamente por --apply. No forzar syncIndexes ni arrancar app contra Atlas para verificarlas.
- [ ] Documentar comandos de vista previa y aplicación; dejar producción pendiente de autorización explícita.
- [ ] Ejecutar test:integration y comprobar que otros índices siguen presentes.

### Tarea 9: Semántica y recuperación del frontend

**Archivos:** modificar frontend/src/components/FormsSections.jsx, Cart.jsx, account/ProfilePage.jsx, frontend/public/css/styles.css, frontend/src/App.jsx y main.jsx; crear routeSegments.js, routeSegments.test.js, components/AppErrorBoundary.jsx y fixture navegador frontend/tests/errorBoundary.html con errorBoundary.browser.jsx si hace falta.

**Interfaces:**

- decodeRouteSegment(value) -> string | null, sin lanzar URIError.
- AppErrorBoundary envuelve App desde main.jsx y ofrece recargar/volver al inicio; cubre errores de descendientes y lazy imports.
- Colección de órdenes: ul/li con article; cabecera con h3 y time. Cantidad: fieldset con legend accesible, sin landmark nav.

- [ ] Escribir prueba funcional del parser con %ZZ, UTF-8 incompleto y segmento válido codificado; ejecutar node --test src/routeSegments.test.js y observar fallo esperado.
- [ ] Implementar parser y devolver NotFoundPage en todas las rutas con segmento inválido. Añadir boundary externo a App.
- [ ] Añadir label visible del newsletter y autoComplete; ajustar cantidad/historial y resets CSS para fieldset/listas sin alterar foco.
- [ ] Verificar en navegador /producto/%ZZ muestra 404. En fixture de desarrollo, lanzar error desde un hijo y comprobar que aparece fallback y que funcionan acciones de recuperación; no añadir rutas de prueba a producción.
- [ ] Inspeccionar DOM y teclado: nombre del email, grupo de cantidad, encabezados y lista de órdenes; no crear tests que solo busquen strings en fuente.
- [ ] Ejecutar npm test, npm run lint y npm run build desde frontend. Confirmar ausencia de sinks HTML inseguros en el diff y conservación de prefers-reduced-motion.

### Tarea 10: Verificación completa y revisión final

**Archivos:** solo documentación mínima README.md y correcciones justificadas; no nuevas funcionalidades.

- [ ] Ejecutar npm test en backend y frontend. Ejecutar npm run test:integration en backend; registrar cantidad de pruebas reales y skips por separado.
- [ ] Ejecutar npm run lint y npm run build desde frontend. No repetir suites completas después salvo nuevos cambios/fallos.
- [ ] Revisar diff y contratos: sesiones legacy rechazadas, invitados conservados, oferta vencida sin descuento, transacciones sin efectos externos, archivedAt aplicado en todos los lectores públicos.
- [ ] Hacer una revisión independiente de todo el conjunto conforme a executing-plans; dar al revisor spec, plan y evidencia de pruebas. Corregir hallazgos materiales y repetir las pruebas afectadas.
- [ ] Confirmar que no se incluyeron valores de entorno, dependencias de producción nuevas, binarios Mongo ni directorios temporales; verificar estado de CatalogPage.jsx.
- [ ] Entregar resumen por hallazgo, evidencia de Mongo real, límites de navegador/producción y comandos de migración pendientes. Dejar cambios sin commit/publicación, como exige la spec.

## Cierre de ejecución — 2026-10-21

Las diez tareas se implementaron y verificaron. Evidencia final:
- Backend: `npm test`, 109 aprobadas, 17 omitidas por integración optativa, 0 fallos.
- MongoDB temporal real: `npm run test:integration`, 17 aprobadas, 0 omitidas/fallos. Incluye rollback, concurrencia, pérdida de lease tras escrituras, commit incierto, versiones MFA históricas y reset durante consumo TOTP/recuperación.
- Frontend: `npm test`, 20 aprobadas; `npm run lint` y `npm run build` correctos.
- Edge local: 404 con segmento inválido al renderizar; fallback con recarga/enlace funcionales; etiqueta newsletter; fieldset y teclado de cantidad; historial ul/li/article/h3 y snapshot de producto borrado. Respuestas API simuladas, sin servicios externos. Vite rechaza algunas URLs malformadas antes de React: se inyectó el pathname al cargar la SPA para comprobar su decoder.
- Explain Mongo sintético: recientes 1511→8 documentos examinados; próxima oferta 501→1. Atlas no modificado.
- Revisión independiente: corregidos archivado que devolvía 404, precio de TechBot, orden/paginación por precio efectivo y compatibilidad MFA sin authVersion. Regresiones reproducidas antes de corregir; suites finales verdes.

### Decisiones de ejecución
- Ledger y herramientas nativas PowerShell en lugar de scripts Bash no disponibles; coste: registro manual equivalente.
- Implementación en developer por autorización previa; inicialmente sin publicación. La petición explícita posterior de release autoriza commit/push/promoción y sustituye esa restricción; se conserva el cambio de formato de CatalogPage y otros formatos sin cambio de comportamiento.
- createCheckout devuelve `{order, created}` para distinguir 201/replay sin cambiar respuesta pública; coste: contrato interno compuesto.
- Casos de integración reunidos en un archivo/replica set con fixtures separados; coste: se ejecutan secuencialmente.
- Pago de pedidos legacy admite ausencia de checkoutState, manteniendo exclusión de creating; coste: compatibilidad con registros anteriores, cubierta por regresiones.
- Claves de checkout siguen opcionales para clientes antiguos; coste: esos clientes no tienen deduplicación garantizada si reenvían sin clave.
- Producción/índices de Atlas quedan fuera de la aplicación automática; coste: aplicar los índices posteriormente con el comando documentado.

Publicación solicitada: commit en español, developer → origin/developer, fast-forward main → origin/main, regresar a developer. Un push no confirma que Render/Netlify hayan terminado su despliegue.
