# Reseñas y direcciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Añadir reseñas verificadas con moderación por owner/admin y una libreta privada integrada con el checkout.

**Architecture:** Primero implementar reseñas como entregable independiente, después direcciones e integración transaccional del checkout. Reutilizar sesiones/MFA, requestJson/adminMutation, modelos de pedidos y componentes existentes. La unicidad y los límites se basan en IDs naturales y actualizaciones atómicas; las modificaciones se condicionan a versión.

**Tech Stack:** JavaScript, React/Vite, Express, Mongoose y node:test; sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-11-01-reviews-addresses-design.md` y aprobación del diseño en el chat.

## Global Constraints

- Una reseña por usuario/producto; compra propia pagada y entregada/completada verificada en el servidor.
- Puntuación entera1–5, texto plano10–2000; creación/edición vuelve a pendiente; solo aprobadas son públicas.
- Owner y admin moderan con MFA; un moderador no aprueba su propia reseña. Registrar actor/fecha, últimas50 decisiones.
- Cinco direcciones privadas máximo; una predeterminada; campos y límites exactos del diseño.
- Dirección opcional, sin guardado implícito; resolver y copiar en servidor, preservar idempotencia e historial.
- Sin cambios de producción, dependencias nuevas, commit ni push. Mantener developer y documentos actuales.

## Review Focus

- Edición concurrente no permite aprobar una versión anterior del texto.
- Reintentar no duplica reseñas ni altera una dirección histórica del pedido.
- Varias altas de dirección no superan cinco ni dejan dos predeterminadas.
- IDs ajenos, inyección de rol/autor y campos privados no se filtran ni autorizan acceso.
- Un fallo de API o una dirección borrada permite corregir el checkout sin perder el carrito o crear dos pedidos.

### 1. API de reseñas y moderación

**Files:** crear `backend/models/ProductReview.js`, `backend/services/productReviews.js`, `backend/controllers/reviewController.js`, `backend/routes/reviewRoutes.js`; integrar `apiRoutes.js`, limitadores y nuevas pruebas `productReviews.test.js`/`productReviews.integration.test.js`.

**Interfaces:** GET `/api/products/:id/reviews?page=N` devuelve reseñas públicas paginadas y promedio; GET `/api/reviews/mine?productId=...` devuelve la propia. PUT/DELETE `/api/reviews/:productId` crea/edita/retira reseña propia. GET `/api/admin/reviews?status=pending&page=N` lista para moderar; PATCH `/api/admin/reviews/:id` recibe decisión y versión mediante adminMutation.

- [x] Escribir y observar RED: compra no pagada/no entregada, otro usuario, dos creaciones, texto/nota inválidos, HTML, datos privados y ausencia de MFA.
- [x] Implementar `_id=productId:userId`, estados pending/approved/rejected/hidden y versión. Verificar compra con filtro user/paymentStatus/status/items.product. CAS para edición y moderación; auditoría acotada en la misma actualización. No confiar en autor, rol o estado enviados por cliente.
- [x] Proyectar solo texto/nota/fecha/nombre mínimo y sello de compra verificada al público. Promedio solo sobre aprobadas. Limitar páginas/tamaño y evitar N+1 de autores.
- [x] Ejecutar integración real Mongo: edición contra aprobación simultánea, reintentos, retiro, permisos owner/admin y rechazo de autopublicación. Índices de consulta preparados por procedimiento explícito, sin autoIndex.

### 2. Experiencia de reseñas y panel

**Files:** crear `frontend/src/components/reviews/ProductReviews.jsx` y `frontend/src/components/admin/ReviewModerationPage.jsx`; integrar `ProductPage.jsx`, navegación del dashboard y ruta `/admin/reviews` en `App.jsx`.

**Interfaces:** ProductReviews usa el contexto de sesión existente o usuario proporcionado por App para identificar cuenta; carga listado público y propia elegibilidad con requests independientes. Formulario autenticado maneja nota/texto/versión y estados; invitados ven acceso al login. El panel usa useAdminData/adminMutation y confirma cambios antes de enviar.

- [x] Probar primero estados pendiente/aprobado/rechazado/oculto, edición que vuelve a pendiente, invitado y error de versión409.
- [x] Implementar etiquetas, mensajes accesibles, paginación y reintentos. Mostrar texto por React sin HTML. No exponer correo, dirección ni referencia de compra.
- [x] Verificar navegador móvil/escritorio: publicación, edición, retiro y moderación, incluidos errores de red y foco.

### 3. Libreta privada y copia al checkout

**Files:** crear `backend/models/AddressBook.js`, `backend/services/customerAddresses.js`, `backend/controllers/addressController.js`, `backend/routes/addressRoutes.js` y pruebas unitarias/integración. Modificar `orderCheckoutController.js`, `checkoutService.js`, `models/Order.js`, `config/whatsapp.js` y vistas públicas/administrativas pertinentes.

**Interfaces:** GET/POST `/api/addresses`, PATCH/DELETE `/api/addresses/:id`, PUT `/api/addresses/:id/default`. Libreta única `_id=userId` con array acotado y defaultAddressId. Checkout admite `savedAddressId` o `shippingAddress`, nunca ambos; la resolución de una guardada pertenece al usuario autenticado.

- [x] Escribir y observar RED: acceso ajeno, validación/tamaños, cinco altas simultáneas, default/borrado concurrentes, invitados y payloads con userId arbitrario.
- [x] Implementar libreta de cinco con mutaciones atómicas/CAS y una predeterminada referenciada. Validar tipos, normalizar espacios y rechazar HTML/controles; lista privada no-store.
- [x] Resolver dirección guardada dentro de la creación transaccional tras comprobar si el checkout ya existe; copiar únicamente campos permitidos. Los reintentos con la misma clave recuperan la instantánea anterior aunque se haya editado o eliminado la dirección guardada. Un ID ajeno/eliminado devuelve error antes de crear pedido o cambiar stock.
- [x] Marcar si la dirección fue elegida expresamente, para no presentar los defaults de pedidos legacy como información real del cliente. Mantener compatibilidad con pedidos existentes.
- [x] Ejecutar integración de rollback, compra concurrente, edición/borrado de libreta y reintentos idempotentes. Comprobar mensaje WhatsApp codificado y visibilidad restringida de la instantánea.

### 4. Interfaz de direcciones, regresiones y entrega

**Files:** crear `frontend/src/components/account/AddressBookSection.jsx` y selector de checkout; integrar `ProfilePage.jsx`, `Cart.jsx`, detalle/confirmación de pedidos, estilos, documentación y `backend/scripts/runIntegrationTests.js`.

- [x] Probar formulario, predeterminada, borrar, máximo cinco, invitado, error de carga y dirección retirada antes del checkout.
- [x] Implementar gestión en Mi cuenta y selector guardada/puntual/sin dirección en checkout. Guardar libreta requiere acción explícita; no enviar datos de dirección a endpoints públicos de productos/reseñas. Mantener accesibilidad y retorno de foco de los diálogos existentes.
- [x] Revisar navegador móvil/escritorio con API aislada y pruebas completas backend/integración/frontend, lint/build y git diff --check.
- [x] Revisión independiente de seguridad, concurrencia y regresiones del checkout; corregir hallazgos demostrados y repetir comprobaciones afectadas.
- [x] Actualizar arquitectura, seguridad y sistema de diseño. Entregar en developer sin commit, push, migraciones Atlas ni mensajes reales.
