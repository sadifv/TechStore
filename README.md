# 🛒 TechStore - Dropshipping E-Commerce & Admin Panel

TechStore es una plataforma e-commerce full-stack moderna y accesible orientada al comercio electrónico y dropshipping. Incluye catálogo dinámico con filtros, ofertas relámpago con temporizador (_Flash Sales_), asistente virtual interactivo conectado a Google Gemini, gestión de carrito persistente y panel de administración para control de catálogo y pedidos.

---

## 🛠️ Tecnologías Utilizadas

- **Backend:** Node.js y Express.js (las plantillas EJS se conservan para correos).
- **Base de Datos:** MongoDB con Mongoose y sesiones persistentes vía `connect-mongo`.
- **Seguridad & Middleware:** Helmet, CORS, Express Rate Limit, Express Slow Down, Express Validator, Bcryptjs.
- **Integraciones:** pedidos por WhatsApp, Google Gemini API (Asistente TechBot), correo SMTP para recuperación de contraseña y campañas, Winston (logging estructurado).
- **Frontend:** React, Vite, CSS y Remix Icon.

---

## 📋 Requisitos Previos

Asegúrate de tener instalado en tu sistema:

- **Node.js** (v20.19.0 o superior, o v22.12.0 o superior)
- **npm** (v9.0.0 o superior)
- **MongoDB** (Instancia local corriendo en `mongodb://127.0.0.1:27017/` o URI de MongoDB Atlas)

---

## 🚀 Instalación y Puesta en Marcha

1. **Clonar el repositorio:**

   ```bash
   git clone https://github.com/sadifv/TechStore.git
   cd TechStore
   ```

2. **Configurar el backend:** copia `backend/.env.example` a `backend/.env` y completa las credenciales necesarias. En producción, `APP_URL` y `FRONTEND_URL` deben ser la URL pública de React, `API_URL` la URL pública de Express y `ALLOWED_ORIGINS` debe incluir el origen exacto de React (por ejemplo, `https://tienda.tu-dominio.com`). Configura `TRUST_PROXY_HOPS=1` si Express solo recibe tráfico desde un Nginx confiable; mantén el puerto de Express inaccesible desde Internet.

   Para enviar correos, configura `SMTP_USER` y `SMTP_PASS` con credenciales válidas de Gmail y una contraseña de aplicación. Si aparece `getaddrinfo ENOTFOUND smtp.gmail.com`, revisa la conexión DNS/red del servidor o utiliza un proveedor SMTP accesible desde ese entorno.

3. **Instalar dependencias:** ejecuta `npm ci` dentro de `backend/` y dentro de `frontend/`.

4. **Iniciar en desarrollo:** abre dos terminales. En una ejecuta `npm run dev` desde `backend/`; en la otra ejecuta `npm run dev` desde `frontend/`. React corre en `http://localhost:5173` y Express en `http://localhost:3001`.

## Despliegue frontend/backend

- Compila React con `npm run build` desde `frontend/` y publica `frontend/dist/` en un hosting estático. Express se despliega como servicio Node.js independiente desde `backend/`.
- La opción recomendada es publicar ambos bajo el mismo dominio mediante un proxy inverso: `/` sirve `frontend/dist/`, mientras `/api/` y `/uploads/` se envían a Express. Así las sesiones usan cookies propias del sitio y no dependen de cookies de terceros.
- Para el despliegue actual con Netlify y Render, `frontend/public/_redirects` reenvía `/api/*` y `/uploads/*` al backend de Render y mantiene la regla SPA al final. El destino incluido corresponde al nombre `techstore-backend` de `render.yaml`; si el dominio público que muestra Render es distinto, actualiza esas dos reglas. En Netlify deja `VITE_API_BASE_URL` vacío o elimina esa variable para que el navegador use rutas relativas del mismo sitio. Después de cambiarlo, vuelve a desplegar el frontend.
- En Render, configura `FRONTEND_URL`, `APP_URL` y `ALLOWED_ORIGINS` con el origen HTTPS exacto del sitio Netlify. `API_URL` debe seguir siendo el origen público HTTPS de Render (`RENDER_EXTERNAL_URL`). Con el proxy, el navegador se comunica con Netlify y el servidor reenvía la solicitud a Render; así la cookie `SameSite=Lax` se usa en el mismo sitio.
- `deploy/nginx.conf.example` contiene una base para Nginx. Termina TLS/HTTPS en el proxy, conserva las cabeceras `X-Forwarded-*` y configura `TRUST_PROXY_HOPS=1` para ese salto confiable. Mantén Express inaccesible directamente desde Internet.
- En ese esquema deja `VITE_API_BASE_URL` vacío en el entorno de build del frontend; configura `APP_URL` y `FRONTEND_URL` con la URL pública de la tienda, `API_URL` con ese mismo origen y añade el origen a `ALLOWED_ORIGINS`. Usa HTTPS en producción.
- Si React y Express usan subdominios separados del mismo dominio (por ejemplo, `tienda.tu-dominio.com` y `api.tu-dominio.com`), define `VITE_API_BASE_URL=https://api.tu-dominio.com` **antes de compilar**. En Express, `API_URL` apunta a `https://api.tu-dominio.com`, `ALLOWED_ORIGINS` contiene `https://tienda.tu-dominio.com`, y `APP_URL` y `FRONTEND_URL` apuntan a React. Mantén HTTPS y ambos subdominios bajo el mismo sitio para que las cookies de sesión `SameSite=Lax` funcionen.
- Si usas subdominios separados con la configuración Nginx de ejemplo, añade también el origen de la API a `connect-src` en la política CSP.
- No despliegues React y API en dominios de sitios distintos sin cambiar y validar la política de cookies: los navegadores pueden bloquear esas cookies en solicitudes entre sitios.
- `BACKEND_PROXY_TARGET` solo configura el proxy de desarrollo de Vite. No cambia la URL del backend en el bundle de producción.

## Pruebas

- Ejecuta `npm test` desde `backend/` para las pruebas automatizadas del servidor.
- Ejecuta `npm test`, `npm run lint` y `npm run build` desde `frontend/` para comprobar React.
- `npm run db:ensure-reservation-ttl` desde `backend/` muestra una vista previa del índice TTL de `reservations`; no cambia nada por defecto. Para aplicarlo explícitamente, ejecuta `npm run db:ensure-reservation-ttl -- --apply`. MongoDB eliminará automáticamente documentos con `expiresAt` vencido; revisa el conteo antes de aplicar.

## Seguridad y despliegue

- El acceso administrativo requiere una aplicación autenticadora TOTP. En el primer inicio de sesión, guarda los diez códigos de recuperación que se muestran una sola vez. `SESSION_SECRET` debe mantenerse estable: al rotarlo, inicia sesión con un código de recuperación para volver a enrolar MFA; si se pierden el autenticador y todos los códigos, un operador debe restablecer MFA desde la base de datos tras verificar la identidad del administrador.
- El límite de login (5 intentos/10 min) y el de checkout (10 solicitudes/15 min por IP) se comparten entre instancias mediante MongoDB. Si falla MongoDB, esas rutas fallan cerradas.
- El índice heredado de Stripe se puede revisar con `npm run db:remove-legacy-stripe-index` desde `backend/`; el comando solo hace una vista previa. La aplicación requiere `npm run db:remove-legacy-stripe-index -- --apply` y aborta si encuentra documentos con `stripeExpiresAt`.
- `backend/.env` y las variantes `.env.*` (excepto `backend/.env.example`) se excluyen de Git. Si una captura, log o commit revela una contraseña o clave, revócala o rótala desde el proveedor correspondiente; cambiar el archivo local no invalida la credencial expuesta.
- `WHATSAPP_BUSINESS_PHONE` debe incluir el código de país y solo dígitos, por ejemplo `593963976623`. El checkout crea un pedido pendiente, reserva temporalmente el inventario y abre WhatsApp con el resumen listo para que el cliente lo envíe. Si el cliente no termina el contacto en 24 horas, el pedido vence y el inventario se libera.
- El pago no se confirma al abrir WhatsApp. Un administrador debe verificarlo con el cliente y usar **Confirmar pago recibido** en el detalle del pedido antes de prepararlo o enviarlo.
- El número de contacto, los enlaces de WhatsApp y el checkout comparten `WHATSAPP_BUSINESS_PHONE`, expuesto como configuración pública en `/api/store/config`. No es necesario recompilar React para cambiar el número; reinicia el backend y recarga la página.
- En el detalle administrativo, **Registrar contacto recibido** deja constancia de que la tienda recibió el mensaje; no se detecta automáticamente desde el enlace. El historial conserva fechas y responsables de contacto, pago, cancelación y avance del envío. Las órdenes anteriores pueden no tener historial.
- Los pedidos pendientes se pueden cancelar desde el panel, liberando inventario y cupón. El plazo de 24 horas se cuenta desde la creación, aunque se registre contacto. Después de ese plazo no se acepta la confirmación de pago, incluso antes de la siguiente ejecución del cron.
- El navegador conserva una clave por intento de checkout para recuperar una respuesta perdida sin crear otra orden. El backend espera la inicialización del índice único de `checkoutKey` antes de aceptar tráfico. Si el navegador bloquea la ventana, la página del pedido permite abrir WhatsApp de nuevo.
- Las pruebas cubren checkout, reintentos, permisos de administrador, confirmaciones, cancelaciones, inventario y ventanas bloqueadas. Usan persistencia simulada y no envían mensajes reales a WhatsApp.
- GitHub Actions comprueba backend y frontend en Node.js 22 y 24, y ejecuta `npm audit` en ambos proyectos en cada push y pull request.

## Boletín, campañas y cupones

- El boletín es gratuito; la página `/admin/marketing` permite administrar cupones promocionales y enviar campañas a suscriptores que dieron consentimiento. Los mensajes incluyen un enlace de baja.
- Sin credenciales SMTP, los envíos se registran como simulados y no se envían.
- Los cupones se validan en el servidor y su uso se reserva durante el checkout; si un pedido vence o se cancela, el cupón vuelve a estar disponible.
