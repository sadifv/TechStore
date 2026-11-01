# Seguimiento y cancelación de pedidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Permitir consultar el seguimiento y cancelar pedidos propios sin pago confirmado.

**Architecture:** Extender las rutas de pedidos con controladores de cliente y una proyección pública compartida. Reutilizar la autorización de confirmación y la restitución transaccional con condiciones específicas de cancelación. Compartir interfaz entre Mi cuenta y confirmación del checkout.

**Tech Stack:** Express, Mongoose, React, JavaScript y node:test; sin nuevas dependencias.

**Spec:** `docs/superpowers/specs/2026-10-31-customer-orders-design.md` y aprobación del diseño en el chat.

## Global Constraints

- Pago no confirmado: cancelación directa con confirmación explícita.
- Pedidos pagados: contactar con la tienda, sin reembolsos automáticos.
- Reutilizar sesiones, clave privada de invitado y transacciones existentes.
- Solo pruebas con datos temporales; sin publicación ni migraciones.

## Review Focus

- Otro cliente o invitado sin clave no puede leer ni cancelar pedidos ajenos.
- La respuesta del cliente no expone checkoutKey, hashes ni actores internos.
- Pago y cancelación simultáneos producen un único resultado coherente.
- Reintentos no duplican restitución de stock, cupón ni eventos.
- Errores de red y checkout en creación no producen falsas confirmaciones.

### 1. Contrato de seguimiento y acceso

**Files:** crear `backend/services/customerOrderView.js`, `backend/controllers/customerOrderController.js`, `backend/tests/customerOrders.test.js`; modificar `backend/routes/orderRoutes.js` y `backend/controllers/orderController.js`.

**Interfaces:** `customerOrderView(order)` devuelve datos públicos y eventos comerciales sin actores; `getCustomerOrder(req,res,next)` recibe `body.orderId` y `body.checkoutKey` por POST `/api/orders/track`; el listado `/api/orders` usa la misma proyección.

- [x] Escribir y ejecutar pruebas que fallen: propietario autorizado, terceros rechazados, invitado con clave válida, campos privados ausentes y fechas/estados históricos preservados.
- [x] Implementar proyección explícita y acceso con `isOrderSuccessAccessible`; respuesta 404 uniforme para pedido inexistente o inaccesible, 400 para identificador mal formado y caché privada deshabilitada.
- [x] Ejecutar `node --test tests/customerOrders.test.js` y pruebas de acceso existentes.

### 2. Cancelación segura

**Files:** modificar controlador y rutas anteriores, `backend/services/orderInventory.js`, `backend/middleware/rateLimiter.js`; ampliar pruebas en `backend/tests/orderTransactions.integration.test.js`.

**Interfaces:** POST `/api/orders/cancel` recibe `{ orderId, checkoutKey }` y devuelve `{ success, data }` con la vista pública actualizada. `restoreOrderInventory` acepta condiciones opcionales de transición para el cliente manteniendo la firma anterior compatible.

- [x] Escribir y ejecutar pruebas que fallen para pago confirmado, propiedad ajena, creación en curso, repetición y clave de invitado inválida.
- [x] Condicionar tanto la lectura inicial como la actualización transaccional a pago pendiente y checkout listo; mantener idempotencia de un pedido ya cancelado. Registrar evento comercial de cancelación del cliente sin publicar su actor.
- [x] Aplicar límite específico persistente por IP a cancelación y conservar CSRF global; no reutilizar el cupo de checkout.
- [x] Añadir integración con MongoDB temporal: dos cancelaciones, carrera con pago, rollback y cupón liberado una sola vez. Ejecutar `npm run test:integration`.

### 3. Interfaz compartida y verificación final

**Files:** crear `frontend/src/components/account/OrderTracking.jsx` y pruebas del contrato/estados; modificar `frontend/src/components/account/ProfilePage.jsx`, `frontend/src/components/admin/CheckoutSuccessPage.jsx`, estilos compartidos y `ARCHITECTURE.md`/`SECURITY.md`.

**Interfaces:** componente recibe pedido público y callback de actualización; envía cancelación por `requestJson` y conserva credencial de invitado en sessionStorage como hoy. Seguimiento tiene actualización manual, cronología pública y estados separados de pago/envío.

- [x] Escribir y ejecutar pruebas que fallen para cancelación confirmada, error recuperable, solicitud ocupada y presentación de pago/envío/cancelación/vencimiento.
- [x] Implementar confirmación en línea accesible, bloqueo durante envío y regreso de foco a control visible. Actualizar datos desde respuesta del servidor; un fallo nunca se presenta como cancelación confirmada.
- [x] Verificar navegador en móvil/escritorio con API aislada; comprobar propietario e invitado y ausencia de credenciales en URLs.
- [x] Ejecutar backend `npm test` e integración; frontend `npm test`, `npm run lint`, `npm run build`; `git diff --check`. Revisar cambios y documentar límites de pruebas externas.
- [x] Actualizar documentación y entregar cambios sin commit ni push, preservando `developer`.
