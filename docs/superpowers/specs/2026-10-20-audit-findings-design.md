# Diseño: corrección de cinco hallazgos de TechStore

## Objetivo

Corregir los cinco hallazgos priorizados en la auditoría del 20 de octubre de 2026: abuso de checkout, autenticación administrativa, carga excesiva del inicio, retorno del foco del carrito y un índice MongoDB heredado de Stripe.

## Restricciones

- No añadir servicios externos ni dependencias de producción.
- Conservar el flujo de pedidos por WhatsApp y sus claves de idempotencia.
- Mantener los límites compartidos entre instancias de Render mediante el almacén MongoDB existente.
- Aplicar MFA solo a cuentas con rol `admin`; las cuentas de cliente conservan el inicio actual.
- No registrar contraseñas, códigos TOTP, códigos de recuperación, secretos TOTP ni datos personales en logs.
- Retirar únicamente el índice exacto `paymentStatus_1_stripeExpiresAt_1` de `TechStore.orders`, y solo después de confirmar que no existe uso de `stripeExpiresAt` en código o datos que deban conservar ese índice.

## Diseño

### 1. Limitar checkout

Añadir un limitador dedicado a `POST /api/orders/checkout`, con máximo de 10 solicitudes por IP cada 15 minutos, usando `MongoRateLimitStore`. El limitador general de API permanece como defensa adicional. La clave y el almacén deben compartir cuota entre instancias; la respuesta de exceso conserva el formato JSON existente y devuelve HTTP 429. Los reintentos idempotentes válidos siguen permitidos dentro de ese límite.

### 2. MFA y auditoría de acceso administrativo

El login administrativo pasa a dos pasos con TOTP RFC 6238 (seis dígitos, periodo de 30 segundos) y diez códigos de recuperación de un solo uso. No se crea una sesión autenticada tras validar solo la contraseña.

En el primer login correcto de un administrador sin MFA, el servidor crea un estado de sesión de preautenticación de 10 minutos, limitado a enrolamiento MFA. La interfaz permite mostrar el secreto TOTP y su URI `otpauth` para configurar una aplicación autenticadora; no envía el secreto a un generador QR externo. El enrolamiento se activa solo después de validar el primer código. Los diez códigos de recuperación se muestran una sola vez; se almacenan como hashes SHA-256 y se consumen atómicamente.

En logins posteriores, el usuario completa el segundo paso con un código TOTP o un código de recuperación válido. Solo entonces se regenera la sesión y se asigna `session.user`. Rutas protegidas nunca aceptan el estado de preautenticación como autenticación. Se cifra el secreto TOTP con AES-256-GCM y una clave derivada de `SESSION_SECRET` mediante HKDF. Rotar `SESSION_SECRET` requiere volver a enrolar MFA; esta condición se documentará.

El limitador de login existente se mueve al almacén MongoDB compartido para mantener el máximo de cinco intentos por ventana entre instancias. Se registran eventos estructurados de éxito, fallo y enrolamiento MFA; los eventos omiten los secretos y códigos, y no guardan el correo enviado por el usuario en el mensaje del log.

### 3. Reducir la consulta del inicio

Añadir `GET /api/products/home`, que devuelve como máximo ocho productos recientes para destacados y la oferta activa que termina primero. Ambas lecturas son selectivas y concurrentes; la consulta de oferta filtra `flashSale` y `flashSaleEndsAt > ahora`, ordena por expiración ascendente y limita a uno. `HomePage` deja de descargar 100 productos y de seleccionar la oferta en el navegador. El contrato público de `GET /api/products` no cambia.

### 4. Restaurar foco al cerrar checkout

Al cerrar el diálogo de checkout, devolver el foco al botón visible que abre el carrito, en lugar del botón de checkout que queda dentro del panel cerrado. La lógica debe respetar el retorno al navegar y evitar enfocar nodos desconectados o invisibles. La apertura/cierre del drawer y el uso de Escape mantienen sus destinos de foco actuales.

### 5. Retirar el índice Stripe

Crear una migración idempotente que, por defecto, solo inspeccione e informe si existe el índice exacto `paymentStatus_1_stripeExpiresAt_1` en `orders`. La aplicación requiere `--apply` explícito y elimina ese índice por nombre; no borra documentos ni otros índices. Añadir pruebas para ausencia del índice, modo de solo lectura y aplicación. Ejecutar la migración controlada sobre Atlas después de revisar su salida de previsualización.

## Manejo de errores y compatibilidad

- Una base de datos no disponible debe hacer fallar el limitador compartido de forma cerrada en login y checkout; no debe cambiar silenciosamente a una cuota local por instancia.
- Un código TOTP inválido o vencido no crea sesión. Un código de recuperación inválido o ya consumido tampoco crea sesión.
- Una sesión de preautenticación expirada debe volver al formulario de login y no habilitar rutas privadas.
- Si falla la carga del endpoint del inicio, se mantiene el estado de error actual del frontend.
- La migración es segura al repetirse; no modifica datos de pedidos.

## Verificación

- Backend: pruebas para límite compartido de checkout, login administrativo en dos pasos, sesión no autenticada durante enrolamiento, TOTP válido/inválido/vencido, consumo único de recuperación, logs sin secretos y migración dry-run/aplicación idempotente.
- Frontend: pruebas del contrato de productos del inicio, flujo de MFA/enrolamiento y retorno de foco al botón del carrito.
- Ejecutar todas las suites existentes, lint y build de producción.
- Verificar metadata del índice en Atlas antes y después de la migración, sin leer datos de clientes.
- Revisar en navegador el inicio, enrolamiento y recuperación con teclado; la revisión de contraste y lector de pantalla se reporta por separado si el entorno de AT no está disponible.

## Fuera de alcance

- Cambiar límites de stock, política de caducidad de reservas o proceso de confirmación por WhatsApp.
- Añadir proveedores de autenticación, entrega de MFA o monitoreo externos.
- Eliminar campos de documentos, pedidos ni colecciones.
- Desplegar o publicar cambios.
