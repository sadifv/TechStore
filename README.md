# 🛒 TechStore - Dropshipping E-Commerce & Admin Panel

TechStore es una plataforma e-commerce full-stack moderna y accesible orientada al comercio electrónico y dropshipping. Incluye catálogo dinámico con filtros, ofertas relámpago con temporizador (*Flash Sales*), asistente virtual interactivo potenciado por IA (OpenAI), gestión de carrito persistente y panel de administración para control de catálogo y pedidos.

---

## 🛠️ Tecnologías Utilizadas

- **Backend:** Node.js, Express.js, EJS (Motor de plantillas con `express-ejs-layouts`).
- **Base de Datos:** MongoDB con Mongoose y sesiones persistentes vía `connect-mongo`.
- **Seguridad & Middleware:** Helmet, CORS, Express Rate Limit, Express Slow Down, Express Validator, Bcryptjs.
- **Integraciones:** Stripe API (Checkout y Webhooks), OpenAI API (Asistente TechBot), Winston (Logging estructurado).
- **Frontend:** Semantic HTML5, CSS Variables, JavaScript vanilla asíncrono (`fetch`), Remix Icon.

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

2. **Configurar el entorno:** copia `.env.example` a `.env` y completa las credenciales necesarias. En producción, define `ALLOWED_ORIGINS` con los dominios exactos de la tienda, separados por comas y sin espacios; si queda vacío, el navegador bloqueará las solicitudes de esos orígenes.

   Para enviar correos, configura `SMTP_USER` y `SMTP_PASS` con credenciales válidas de Gmail y una contraseña de aplicación. Si aparece `getaddrinfo ENOTFOUND smtp.gmail.com`, revisa la conexión DNS/red del servidor o utiliza un proveedor SMTP accesible desde ese entorno.

## Pruebas

- `npm test` ejecuta las pruebas automatizadas unitarias con dependencias simuladas.
- `npm run test:integration` ejecuta un flujo real de checkout contra MongoDB y Stripe en modo test. Requiere MongoDB accesible, `MONGO_TEST_URI` apuntando a una base aislada cuyo nombre termine en `_test`, y `STRIPE_SECRET_KEY` con una clave `sk_test_`. El test crea una sesión de Checkout sin cobrar, la expira y comprueba que la orden y el stock se hayan actualizado; al finalizar elimina únicamente el producto y la orden creados por esa prueba.
- Nunca configures `MONGO_TEST_URI` con la base de desarrollo/producción ni uses una clave Stripe `sk_live_` para esta prueba.
- `npm run db:ensure-reservation-ttl` repara/verifica el índice TTL de `reservations` en la base de `MONGO_URI`, sin borrar datos manualmente. En una base ya existente, ejecútalo solo cuando desees que MongoDB empiece a borrar automáticamente las reservas cuya fecha `expiresAt` venció.

## Membresía VIP y campañas

- La página `/vip` explica la membresía mensual de **$4.99**. En desarrollo, `MEMBERSHIP_PAYMENT_MODE=mock` habilita una pantalla de confirmación de prueba que activa el acceso por 30 días sin pedir tarjeta. El simulador se rechaza fuera de `NODE_ENV=development`; en producción el sitio informa que los pagos VIP aún no están disponibles.
- La activación de prueba genera un cupón de bienvenida (15%, máximo $10) y uno mensual (10%, máximo $8); ambos requieren una compra mínima de $50, son de un solo uso y vencen al terminar el período VIP. Estos valores se pueden ajustar con `VIP_MONTHLY_PRICE`, `VIP_COUPON_MIN_ORDER`, `VIP_WELCOME_DISCOUNT_PERCENT`, `VIP_WELCOME_MAX_DISCOUNT`, `VIP_MONTHLY_DISCOUNT_PERCENT` y `VIP_MONTHLY_MAX_DISCOUNT`.
- El modo de prueba no cobra ni renueva automáticamente. La membresía expira a los 30 días; la renovación queda para la integración futura con un proveedor compatible con Ecuador. Los cupones se validan en el servidor y su uso se reserva durante el checkout; si el pago se cancela o vence, el cupón queda disponible otra vez.
- El boletín sigue siendo gratuito e independiente. La página `/admin/marketing` permite administrar cupones y enviar campañas al boletín, a miembros VIP que dieron consentimiento, o a ambos. Los mensajes incluyen un enlace de baja. Sin credenciales SMTP, se registran como simulados y no se envían.