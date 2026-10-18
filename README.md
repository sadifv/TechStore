# 🛒 TechStore - Dropshipping E-Commerce & Admin Panel

TechStore es una plataforma e-commerce full-stack moderna y accesible orientada al comercio electrónico y dropshipping. Incluye catálogo dinámico con filtros, ofertas relámpago con temporizador (*Flash Sales*), asistente virtual interactivo potenciado por IA (OpenAI), gestión de carrito persistente y panel de administración para control de catálogo y pedidos.

---

## 🛠️ Tecnologías Utilizadas

- **Backend:** Node.js y Express.js (las plantillas EJS se conservan para correos).
- **Base de Datos:** MongoDB con Mongoose y sesiones persistentes vía `connect-mongo`.
- **Seguridad & Middleware:** Helmet, CORS, Express Rate Limit, Express Slow Down, Express Validator, Bcryptjs.
- **Integraciones:** Stripe API (Checkout y Webhooks), OpenAI API (Asistente TechBot), Winston (Logging estructurado).
- **Frontend:** React, Vite, CSS y Remix Icon.

---

## 📋 Requisitos Previos

Asegúrate de tener instalado en tu sistema:
- **Node.js** (v18.0.0 o superior)
- **npm** (v9.0.0 o superior)
- **MongoDB** (Instancia local corriendo en `mongodb://127.0.0.1:27017/` o URI de MongoDB Atlas)

---

## 🚀 Instalación y Puesta en Marcha

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/sadifv/TechStore.git
   cd TechStore
   ```

2. **Configurar el backend:** copia `backend/.env.example` a `backend/.env` y completa las credenciales necesarias. En producción, define `ALLOWED_ORIGINS` con los dominios exactos de la tienda, separados por comas y sin espacios; si queda vacío, el navegador bloqueará las solicitudes de esos orígenes.

   Para enviar correos, configura `SMTP_USER` y `SMTP_PASS` con credenciales válidas de Gmail y una contraseña de aplicación. Si aparece `getaddrinfo ENOTFOUND smtp.gmail.com`, revisa la conexión DNS/red del servidor o utiliza un proveedor SMTP accesible desde ese entorno.

3. **Instalar dependencias:** ejecuta `npm ci` dentro de `backend/` y dentro de `frontend/`.

4. **Iniciar en desarrollo:** abre dos terminales. En una ejecuta `npm run dev` desde `backend/`; en la otra ejecuta `npm run dev` desde `frontend/`. React corre en `http://localhost:5173` y Express en `http://localhost:3001`.

## Pruebas

- Ejecuta `npm test` desde `backend/` para las pruebas automatizadas del servidor.
- Ejecuta `npm test`, `npm run lint` y `npm run build` desde `frontend/` para comprobar React.
- `npm run test:integration` desde `backend/` ejecuta un flujo real de checkout contra MongoDB y Stripe en modo test. Requiere MongoDB accesible, `MONGO_TEST_URI` apuntando a una base aislada cuyo nombre termine en `_test`, y `STRIPE_SECRET_KEY` con una clave `sk_test_`. El test crea una sesión de Checkout sin cobrar, la expira y comprueba que la orden y el stock se hayan actualizado; al finalizar elimina únicamente el producto y la orden creados por esa prueba.
- La integración también comprueba la creación de la suscripción VIP mensual en Stripe test y el estado de una sesión VIP expirada; nunca confirma ni cobra una suscripción.
- Nunca configures `MONGO_TEST_URI` con la base de desarrollo/producción ni uses una clave Stripe `sk_live_` para esta prueba.
- `npm run db:ensure-reservation-ttl` desde `backend/` muestra una vista previa del índice TTL de `reservations`; no cambia nada por defecto. Para aplicarlo explícitamente, ejecuta `npm run db:ensure-reservation-ttl -- --apply`. MongoDB eliminará automáticamente documentos con `expiresAt` vencido; revisa el conteo antes de aplicar.

## Seguridad y despliegue

- `backend/.env` y las variantes `.env.*` (excepto `backend/.env.example`) se excluyen de Git. Si una captura, log o commit revela una contraseña o clave, revócala o rótala desde el proveedor correspondiente; cambiar el archivo local no invalida la credencial expuesta.
- La aplicación rechaza claves Stripe `sk_test_` en producción y claves `sk_live_` fuera de producción para evitar pruebas accidentales con dinero real o un checkout de producción que no cobre.
- Para habilitar cobros VIP, establece `MEMBERSHIP_PAYMENT_MODE=stripe`, configura `STRIPE_WEBHOOK_SECRET` y `APP_URL` HTTPS, y usa una clave `sk_test_` en desarrollo o `sk_live_` en producción. Configura el endpoint `/api/orders/webhook` para recibir `checkout.session.completed`, `checkout.session.expired`, `customer.subscription.*`, `invoice.paid` e `invoice.payment_failed`. Activa el Customer Portal en Stripe para que los clientes puedan actualizar su tarjeta. En producción el checkout consulta a Stripe y se bloquea si la cuenta no tiene `charges_enabled` y `payouts_enabled`; esto debe comprobarse antes de anunciar la membresía.
- GitHub Actions comprueba backend y frontend en Node.js 22 y 24 y audita las dependencias de producción del backend en cada push y pull request.

## Membresía VIP y campañas

- La página `/vip` ofrece una suscripción de **$4.99 al mes** con Stripe Checkout cuando `MEMBERSHIP_PAYMENT_MODE=stripe`. En Stripe, el webhook y la confirmación de Checkout mantienen el estado de la suscripción; los cobros fallidos pasan a `past_due`, los pagos recuperados reactivan el acceso, y se puede cancelar al final del período o administrar el método de pago desde el portal Stripe.
- En desarrollo, `MEMBERSHIP_PAYMENT_MODE=mock` habilita una pantalla de confirmación sin tarjeta ni cobro. El simulador se rechaza fuera de `NODE_ENV=development`.
- La activación de prueba genera un cupón de bienvenida (15%, máximo $10) y uno mensual (10%, máximo $8); ambos requieren una compra mínima de $50, son de un solo uso y vencen al terminar el período VIP. Estos valores se pueden ajustar con `VIP_MONTHLY_PRICE`, `VIP_COUPON_MIN_ORDER`, `VIP_WELCOME_DISCOUNT_PERCENT`, `VIP_WELCOME_MAX_DISCOUNT`, `VIP_MONTHLY_DISCOUNT_PERCENT` y `VIP_MONTHLY_MAX_DISCOUNT`.
- La simulación mock dura 30 días y no se renueva. La suscripción Stripe se renueva mensualmente y genera un cupón VIP de un uso por período, además del cupón de bienvenida inicial. Los cupones se validan en el servidor y su uso se reserva durante el checkout; si el pago se cancela o vence, el cupón queda disponible otra vez.
- El boletín sigue siendo gratuito e independiente. La página `/admin/marketing` permite administrar cupones y enviar campañas al boletín, a miembros VIP que dieron consentimiento, o a ambos. Los mensajes incluyen un enlace de baja. Sin credenciales SMTP, se registran como simulados y no se envían.
