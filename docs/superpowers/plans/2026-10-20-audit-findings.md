# Corrección de hallazgos de auditoría — Plan de implementación

> **Para agentes de implementación:** usa `superpowers:executing-plans` para ejecutar este plan tarea por tarea. Las tareas usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** Corregir los cinco hallazgos priorizados sin añadir servicios externos, conservando el checkout por WhatsApp.

**Arquitectura:** Se reutiliza el almacén MongoDB para límites distribuidos, se añade TOTP con estado de preautenticación y recuperación de un solo uso, se concentra la consulta de inicio en un endpoint y se aisla la migración del índice por nombre exacto. Cada cambio conserva los contratos existentes salvo el paso MFA administrativo y el nuevo endpoint de inicio.

**Stack:** Node.js, Express, MongoDB/Mongoose, `express-rate-limit`, React, Node Test Runner y ESLint.

**Especificación:** `docs/superpowers/specs/2026-10-20-audit-findings-design.md`

## Restricciones globales

- No añadir dependencias ni servicios de producción.
- MFA obligatorio solo para usuarios con rol `admin`; clientes mantienen el flujo actual.
- Nunca asignar `session.user` antes de completar TOTP o recuperación.
- Login y checkout usan límites persistidos en MongoDB y fallan cerrados si el almacén falla.
- Retirar únicamente `paymentStatus_1_stripeExpiresAt_1`; no eliminar documentos ni otros índices.
- No desplegar, publicar ni modificar secretos de Render durante esta implementación.

## Enfoque de revisión

1. Dos procesos comparten el contador de límites y el límite no se reinicia al cambiar de instancia; probar con el almacén Mongo compartido.
2. Si Mongo no está disponible, login y checkout responden con error y no aceptan solicitudes sin límite.
3. Contraseña correcta sin segundo factor, TOTP expirado, replay o sesión de preautenticación expirada nunca da acceso administrativo.
4. Un código de recuperación solo se acepta una vez y los logs no contienen códigos, secretos, correo ni contraseña.
5. La migración no elimina un índice parecido ni modifica datos y es segura al ejecutarse más de una vez.

---

### Tarea 1: Límites persistentes para login y checkout

**Archivos:**

- Modificar: `backend/middleware/rateLimiter.js`
- Modificar: `backend/routes/orderRoutes.js`
- Modificar: `backend/tests/rateLimiterIsolation.test.js`
- Crear o modificar: `backend/tests/checkoutRateLimit.test.js`

**Interfaces:**

- Producir export `checkoutLimiter` con 10 solicitudes por IP en 15 minutos y `MongoRateLimitStore` con bucket propio.
- Cambiar `loginLimiter` a `MongoRateLimitStore` conservando cinco intentos por IP cada diez minutos.
- Montar `checkoutLimiter` solo en `POST /checkout`; conservar `apiLimiter` general.

- [ ] **Paso 1: Escribir pruebas fallidas.** Verificar que checkout aplica el límite dedicado, que login y checkout tienen buckets separados, que dos instancias comparten cuota y que un fallo del store no permite pasar la solicitud.
- [ ] **Paso 2: Ejecutar pruebas enfocadas y confirmar fallo esperado.** Ejecutar `node --test tests/checkoutRateLimit.test.js tests/rateLimiterIsolation.test.js` desde `backend`.
- [ ] **Paso 3: Implementar los limitadores.** Reutilizar `MongoRateLimitStore`; mantener respuestas 429 con JSON y nombres de bucket estables.
- [ ] **Paso 4: Repetir pruebas enfocadas.** Esperado: todos los casos pasan sin advertencias de configuración de `express-rate-limit`.

### Tarea 2: Primitivas TOTP, cifrado y modelo de usuario

**Archivos:**

- Crear: `backend/services/adminMfa.js`
- Modificar: `backend/models/User.js`
- Crear: `backend/tests/adminMfa.test.js`
- Modificar: `backend/tests/userSensitiveFields.test.js`

**Interfaces:**

- Exportar funciones puras para generar secreto y códigos de recuperación, formar URI `otpauth`, cifrar/descifrar TOTP, verificar código dentro de ±1 intervalo de 30 segundos y hash de recuperación.
- Añadir campos opcionales de secreto cifrado, fecha de activación, último intervalo TOTP aceptado y hashes de recuperación; excluirlos de proyecciones públicas.

- [ ] **Paso 1: Escribir pruebas fallidas.** Cubrir código válido, inválido, vencido, tolerancia de reloj, cifra/descifra AES-GCM, rechazo ante clave incorrecta y formato de diez códigos de recuperación aleatorios.
- [ ] **Paso 2: Ejecutar `node --test tests/adminMfa.test.js tests/userSensitiveFields.test.js` y confirmar los fallos esperados.**
- [ ] **Paso 3: Implementar las primitivas con `node:crypto`.** Derivar la clave con HKDF desde `SESSION_SECRET`; comparar códigos en tiempo constante y no incluir secretos en errores.
- [ ] **Paso 4: Repetir pruebas enfocadas y comprobar que las proyecciones de usuarios no revelan campos MFA.**

### Tarea 3: Flujo administrativo de login, enrolamiento y auditoría

**Archivos:**

- Modificar: `backend/controllers/authController.js`
- Modificar: `backend/routes/apiRoutes.js`
- Modificar: `backend/middleware/authMiddleware.js` o crear middleware dedicado de preautenticación
- Modificar: `backend/models/User.js`
- Crear: `backend/tests/adminMfaAuth.test.js`
- Modificar: `backend/tests/authRecovery.test.js` y `backend/tests/authMiddleware.test.js` cuando corresponda

**Interfaces:**

- `POST /api/auth/login` devuelve, para administradores, `mfaRequired` o `mfaEnrollmentRequired` y crea únicamente una sesión preautenticada de diez minutos.
- `POST /api/auth/admin/mfa/enroll` entrega secreto y URI solo a la sesión preautenticada sin MFA.
- `POST /api/auth/admin/mfa/confirm` valida TOTP, persiste MFA, regenera sesión y devuelve los diez códigos de recuperación una sola vez.
- `POST /api/auth/admin/mfa/verify` valida TOTP o consume atómicamente un hash de recuperación; regenera sesión y devuelve usuario.
- Las rutas protegidas siguen requiriendo `session.user`; estado preautenticado no concede ningún rol.

- [ ] **Paso 1: Escribir pruebas de integración fallidas.** Cubrir enrolamiento, login de administrador con TOTP, recuperación de un solo uso, TOTP repetido en el mismo intervalo, expiración de preautenticación, usuario cliente sin MFA y ausencia de sesión tras contraseña sola.
- [ ] **Paso 2: Ejecutar `node --test tests/adminMfaAuth.test.js tests/authMiddleware.test.js tests/authRecovery.test.js` y confirmar los fallos esperados.**
- [ ] **Paso 3: Implementar transiciones de sesión.** Regenerar la sesión al entrar en preautenticación y al terminar MFA; consumir códigos de recuperación con una actualización condicional atómica; impedir reuso del intervalo TOTP.
- [ ] **Paso 4: Añadir logs estructurados para éxito, fallo y enrolamiento.** Registrar solo evento, resultado y actor autenticado cuando exista; no registrar correo, contraseña, TOTP, secreto o recuperación.
- [ ] **Paso 5: Ejecutar de nuevo las pruebas enfocadas.** Esperado: ninguna ruta privada acepta la sesión preautenticada y ningún código se puede reutilizar.

### Tarea 4: Interfaz de MFA para administradores

**Archivos:**

- Modificar: `frontend/src/components/account/AuthPages.jsx`
- Modificar: `frontend/src/api.test.js` si cambia el contrato de respuesta
- Crear: `frontend/src/components/account/adminMfaFlow.js` y `frontend/src/components/account/adminMfaFlow.test.js` para transiciones comprobables

**Interfaces:**

- Login de cliente conserva la redirección actual.
- Login de administrador muestra el formulario de TOTP; al primer acceso muestra instrucciones, secreto/URI y formulario de confirmación.
- Después del enrolamiento muestra códigos de recuperación una sola vez, con confirmación explícita de que se guardaron.
- Permite volver al login desde un estado pendiente; la sesión pendiente expira en el servidor.

- [ ] **Paso 1: Escribir pruebas fallidas para las transiciones de UI.** Cubrir login normal, segundo factor requerido, enrolamiento inicial, error de código, confirmación de códigos guardados y recuperación.
- [ ] **Paso 2: Ejecutar `node --test src/components/account/adminMfaFlow.test.js` desde `frontend` y confirmar el fallo esperado.**
- [ ] **Paso 3: Implementar los estados y formularios accesibles.** Etiquetar entradas, anunciar errores/estados, enfocar el encabezado del siguiente paso y no persistir secreto ni códigos en almacenamiento web.
- [ ] **Paso 4: Ejecutar pruebas frontend y `npm run lint`.**

### Tarea 5: Endpoint eficiente para el inicio

**Archivos:**

- Modificar: `backend/controllers/productController.js`
- Modificar: `backend/routes/apiRoutes.js`
- Modificar: `backend/tests/productControllerBatch.test.js` o crear `backend/tests/homeProducts.test.js`
- Modificar: `frontend/src/pages/HomePage.jsx`
- Crear: `frontend/src/pages/homeProducts.test.js`

**Interfaces:**

- Añadir `GET /api/products/home`, respuesta `{ products, flashSale }`.
- `products` contiene como máximo ocho productos recientes; `flashSale` contiene la oferta vigente que vence primero o `null`.
- La ruta se registra antes de `GET /api/products/:id` para evitar interpretar `home` como id.

- [ ] **Paso 1: Escribir pruebas fallidas para paginación de ocho productos, ausencia de ofertas, expiradas y selección de la próxima oferta.**
- [ ] **Paso 2: Ejecutar las pruebas enfocadas y confirmar el fallo esperado.**
- [ ] **Paso 3: Ejecutar las dos consultas selectivas en paralelo y actualizar `HomePage` para consumir el nuevo contrato.**
- [ ] **Paso 4: Repetir pruebas backend/frontend y revisar que `GET /api/products` conserve su contrato.**

### Tarea 6: Retorno de foco del checkout

**Archivos:**

- Modificar: `frontend/src/components/Cart.jsx`
- Modificar: `frontend/src/components/modalFocus.js` o crear helper pequeño de foco
- Modificar: `frontend/src/components/modalFocus.test.js`

- [ ] **Paso 1: Escribir prueba fallida para cerrar checkout con drawer cerrado y devolver foco a `#cart-btn`; cubrir también nodo desconectado.**
- [ ] **Paso 2: Ejecutar `node --test src/components/modalFocus.test.js` y confirmar el fallo esperado.**
- [ ] **Paso 3: Guardar destino de retorno explícito en el diálogo; no enfocar `#cart-checkout-btn` dentro del drawer cerrado.**
- [ ] **Paso 4: Repetir pruebas y validar flujo con teclado en navegador.**

### Tarea 7: Migración idempotente del índice Stripe y Atlas

**Archivos:**

- Crear: `backend/scripts/removeLegacyStripeIndex.js`
- Modificar: `backend/package.json`
- Crear: `backend/tests/removeLegacyStripeIndex.test.js`
- Modificar: `README.md` para documentar previsualización y aplicación

- [ ] **Paso 1: Escribir pruebas fallidas.** Sin `--apply` no llama a `dropIndex`; con `--apply` solo elimina `paymentStatus_1_stripeExpiresAt_1`; ausencia del índice es éxito; repetición no altera otros índices.
- [ ] **Paso 2: Ejecutar `node --test tests/removeLegacyStripeIndex.test.js` y confirmar el fallo esperado.**
- [ ] **Paso 3: Implementar CLI con dry-run por defecto y conexión cerrada en `finally`; añadir `npm run db:remove-legacy-stripe-index`.**
- [ ] **Paso 4: Ejecutar prueba dry-run contra la metadata de Atlas y comprobar que no hay uso de `stripeExpiresAt` en código ni documentos que dependan de ese índice.**
- [ ] **Paso 5: Aplicar la migración solo al índice confirmado; volver a consultar índices de `TechStore.orders` y comprobar que el índice desapareció sin cambios de documentos.**

### Tarea 8: Verificación integral y revisión

**Archivos:**

- No crear archivos adicionales salvo correcciones necesarias descubiertas en la verificación.

- [ ] Ejecutar backend: `npm test`.
- [ ] Ejecutar frontend: `npm test`, `npm run lint` y `npm run build`.
- [ ] Comprobar el flujo de login de cliente y el flujo admin: contraseña → enrolamiento/segundo factor → recuperación, con teclado.
- [ ] Comprobar checkout normal, reintento idempotente y respuesta 429; sin crear pedidos reales en producción.
- [ ] Confirmar que `/api/products/home` devuelve hasta ocho destacados y una sola oferta válida.
- [ ] Revisar `git diff`, confirmar que ningún secreto quedó en frontend/logs y que no se añadieron dependencias.
- [ ] Revisar el cambio completo con un revisor independiente antes de reportar finalización.

## Ejecución recomendada

Implementación nativa por una sola persona, seguida de revisión independiente. El flujo de MFA cruza modelo, sesiones, API y UI; mantener una sola implementación reduce divergencias entre esos contratos. Ejecutar la migración de Atlas solo después de que la suite y la previsualización estén correctas.
