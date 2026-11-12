# 🛒 TechStore - Dropshipping E-Commerce & Admin Panel

TechStore es una plataforma e-commerce full-stack moderna y accesible orientada al comercio electrónico y dropshipping. Incluye catálogo dinámico con filtros, ofertas relámpago con temporizador (_Flash Sales_), asistente virtual interactivo conectado a Google Gemini, gestión de carrito persistente y panel de administración para control de catálogo y pedidos.

---

## 🛠️ Tecnologías Utilizadas

- **Backend:** Node.js y Express.js (las plantillas EJS se conservan para correos).
- **Base de Datos:** MongoDB con Mongoose y sesiones persistentes vía `connect-mongo`.
- **Seguridad & Middleware:** Helmet, CORS, Express Rate Limit, Express Slow Down, Express Validator, Bcryptjs.
- **Integraciones:** pedidos por WhatsApp, Google Gemini API (Asistente TechBot), Gmail API por HTTPS o SMTP para correos, Winston (logging estructurado).
- **Frontend:** React, Vite, CSS y Remix Icon.

---

## 📋 Requisitos Previos

Asegúrate de tener instalado en tu sistema:

- **Node.js** 22.13.0 o superior de la rama 22, o la rama 24. Usar el parche vigente de una de esas ramas. Ambos paquetes declaran este rango en `engines`.
- **npm** (v9.0.0 o superior)
- **MongoDB** en replica set (local) o MongoDB Atlas. Checkout, carrito y cambios de inventario requieren transacciones; una instancia standalone no es suficiente.

---

## 🚀 Instalación y Puesta en Marcha

1. **Clonar el repositorio:**

   ```bash
   git clone https://github.com/sadifv/TechStore.git
   cd TechStore
   ```

2. **Configurar el backend:** copia `backend/.env.example` a `backend/.env` y completa las credenciales necesarias. En producción, `APP_URL` y `FRONTEND_URL` deben ser la URL pública de React, `API_URL` la URL pública de Express y `ALLOWED_ORIGINS` debe incluir el origen exacto de React (por ejemplo, `https://tienda.tu-dominio.com`). Configura `TRUST_PROXY_HOPS=1` si Express solo recibe tráfico desde un Nginx confiable; mantén el puerto de Express inaccesible desde Internet.

   Para enviar correos desde Render Free, configura `EMAIL_TRANSPORT=gmail-api` y las credenciales OAuth del remitente siguiendo [docs/operations/gmail-api.md](docs/operations/gmail-api.md). Ese plan bloquea SMTP. En entornos que lo permiten, `EMAIL_TRANSPORT=smtp` usa `SMTP_USER` y `SMTP_PASS` con una contraseña de aplicación Gmail.

3. **Instalar dependencias:** ejecuta `npm ci` dentro de `backend/` y dentro de `frontend/`.

4. **Iniciar en desarrollo:** abre dos terminales. En una ejecuta `npm run dev` desde `backend/`; en la otra ejecuta `npm run dev` desde `frontend/`. React corre en `http://localhost:5173` y Express en `http://localhost:3001`.

## Despliegue frontend/backend

Para alojar el frontend en Vercel manteniendo Render y Atlas, seguir la [guía de transición](docs/operations/vercel-deployment.md). La configuración versionada está en `frontend/vercel.json`.

- Compila React con `npm run build` desde `frontend/` y publica `frontend/dist/` en un hosting estático. Express se despliega como servicio Node.js independiente desde `backend/`.
- Para Netlify y Render, `frontend/public/_redirects` contiene el destino de respaldo actual. Configura `NETLIFY_BACKEND_URL` en el entorno de build de Netlify con el origen HTTPS público de Render. `npm run build` valida ese origen y sustituye únicamente los destinos de `/api/*` y `/uploads/*` en `dist/_redirects`. Conserva al final la regla SPA. Al cambiar de servicio Render, actualizar esa variable y recompilar basta. En Netlify (`NETLIFY=true`), la variable es obligatoria: si falta, el build falla para evitar publicar un proxy obsoleto. Solo los builds locales conservan el destino del archivo fuente cuando falta la variable. En Netlify deja `VITE_API_BASE_URL` vacío para las llamadas relativas con cookies del mismo sitio.
- En Render, configura `FRONTEND_URL`, `APP_URL` y `ALLOWED_ORIGINS` con el origen HTTPS exacto del sitio Netlify. `API_URL` debe seguir siendo el origen público HTTPS de Render (`RENDER_EXTERNAL_URL`). Las reglas de Netlify envían las solicitudes API a Render y mantienen las llamadas bajo el origen de la tienda para las cookies `SameSite=Lax`.
- Si React y Express usan subdominios separados del mismo dominio (por ejemplo, `tienda.tu-dominio.com` y `api.tu-dominio.com`), define `VITE_API_BASE_URL=https://api.tu-dominio.com` **antes de compilar**. En Express, `API_URL` apunta a `https://api.tu-dominio.com`, `ALLOWED_ORIGINS` contiene `https://tienda.tu-dominio.com`, y `APP_URL` y `FRONTEND_URL` apuntan a React. Mantén HTTPS y ambos subdominios bajo el mismo sitio para que las cookies de sesión `SameSite=Lax` funcionen.
- No despliegues React y API en dominios de sitios distintos sin cambiar y validar la política de cookies: los navegadores pueden bloquear esas cookies en solicitudes entre sitios.
- `BACKEND_PROXY_TARGET` solo configura el proxy de desarrollo de Vite. No cambia la URL del backend en el bundle de producción.
- Tras desplegar, comprobar el commit en el proveedor, la raíz de la tienda, `/api/products/home` y una imagen `/uploads/...` existente. Un build correcto no demuestra que el destino de Render esté disponible. La sincronización del carrito invitado usa el mismo cliente, base API y cookies que el resto del frontend.

## Pruebas

- Desde `frontend/`, prepara Chromium con `npx playwright install chromium` y ejecuta `npm run test:browser`. La suite usa APIs ficticias y bloquea destinos externos; detalles en [las instrucciones de navegador](frontend/tests/browser/README.md). GitHub Actions tiene un trabajo Chromium independiente.
- El uso del historial owner/MFA, las especificaciones de productos y la preparación explícita de índices se documentan en [historial y especificaciones](docs/features/admin-history-and-specifications.md).

- Ejecuta `npm test` desde `backend/` para las pruebas automatizadas del servidor.
- Ejecuta `npm run test:integration` desde `backend/` para las pruebas con un replica set temporal real. Requiere `mongod` disponible (en Windows busca MongoDB Server 9.0; puedes indicar su ejecutable con `MONGOD_BINARY`). Crea y elimina su propia base temporal; no utiliza `MONGO_URI` ni datos de Atlas. La suite normal omite estos casos. CI instala MongoDB 8.0 en Ubuntu 24.04 y ejecuta integración con Node.js 24.
- Ejecuta `npm test`, `npm run lint` y `npm run build` desde `frontend/` para comprobar React.
- `npm run db:ensure-reservation-ttl` desde `backend/` muestra una vista previa del índice TTL de `reservations`; no cambia nada por defecto. Para aplicarlo explícitamente, ejecuta `npm run db:ensure-reservation-ttl -- --apply`. MongoDB eliminará automáticamente documentos con `expiresAt` vencido; revisa el conteo antes de aplicar.
- `npm run db:ensure-catalog-indexes` desde `backend/` muestra los índices propuestos para productos activos y reservas. Solo `npm run db:ensure-catalog-indexes -- --apply` los crea en la base configurada. No borra índices existentes; si un nombre está ocupado por otra definición, aborta. Su aplicación en Atlas es una operación posterior al release.

## Seguridad y despliegue

- Las sesiones administrativas anteriores sin evidencia de MFA deben volver a iniciar sesión. Restablecer la contraseña revoca también los desafíos MFA pendientes.
- Eliminar un producto desde administración ahora lo archiva: desaparece del catálogo y no admite nuevos checkouts. Los pedidos conservan nombre/precio originales y las cancelaciones restituyen inventario incluso si el producto está archivado. Si ya fue borrado físicamente, se registra la referencia ausente y se procesan los otros artículos y el cupón.
- El acceso administrativo requiere una aplicación autenticadora TOTP. En el primer inicio de sesión, guarda los diez códigos de recuperación que se muestran una sola vez. `SESSION_SECRET` debe mantenerse estable: al rotarlo, inicia sesión con un código de recuperación para volver a enrolar MFA; si se pierden el autenticador y todos los códigos, un operador debe restablecer MFA desde la base de datos tras verificar la identidad del administrador.
- El límite de login (5 intentos/10 min) y el de checkout (10 solicitudes/15 min por IP) se comparten entre instancias mediante MongoDB. Si falla MongoDB, esas rutas fallan cerradas.
- Usuarios y marketing refrescan automáticamente cada 60 segundos; el heartbeat conserva sus 20 segundos. Una pestaña visible consume unas 60 solicitudes periódicas por 15 minutos, dejando margen dentro del límite general de 100. Este límite sigue siendo por IP y se comparte entre pestañas y personas de la misma red.
- El índice heredado de Stripe se puede revisar con `npm run db:remove-legacy-stripe-index` desde `backend/`; el comando solo hace una vista previa. La aplicación requiere `npm run db:remove-legacy-stripe-index -- --apply` y aborta si encuentra documentos con `stripeExpiresAt`.
- `backend/.env` y las variantes `.env.*` (excepto `backend/.env.example`) se excluyen de Git. Si una captura, log o commit revela una contraseña o clave, revócala o rótala desde el proveedor correspondiente; cambiar el archivo local no invalida la credencial expuesta.
- `WHATSAPP_BUSINESS_PHONE` debe incluir el código de país y solo dígitos, por ejemplo `593963976623`. El checkout crea un pedido pendiente, reserva temporalmente el inventario y abre WhatsApp con el resumen listo para que el cliente lo envíe. Si el cliente no termina el contacto en 24 horas, el pedido vence y el inventario se libera.
- El pago no se confirma al abrir WhatsApp. Un administrador debe verificarlo con el cliente y usar **Confirmar pago recibido** en el detalle del pedido antes de prepararlo o enviarlo.
- El número de contacto, los enlaces de WhatsApp y el checkout comparten `WHATSAPP_BUSINESS_PHONE`, expuesto como configuración pública en `/api/store/config`. No es necesario recompilar React para cambiar el número; reinicia el backend y recarga la página.
- En el detalle administrativo, **Registrar contacto recibido** deja constancia de que la tienda recibió el mensaje; no se detecta automáticamente desde el enlace. El historial conserva fechas y responsables de contacto, pago, cancelación y avance del envío. Las órdenes anteriores pueden no tener historial.
- Los pedidos pendientes se pueden cancelar desde el panel, liberando inventario y cupón. El plazo de 24 horas se cuenta desde la creación, aunque se registre contacto. Después de ese plazo no se acepta la confirmación de pago, incluso antes de la siguiente ejecución del cron.
- El navegador conserva una clave por intento de checkout para recuperar una respuesta perdida sin crear otra orden. El backend espera la inicialización del índice único de `checkoutKey` antes de aceptar tráfico. Si el navegador bloquea la ventana, la página del pedido permite abrir WhatsApp de nuevo.
- Las pruebas cubren checkout, reintentos, permisos de administrador, confirmaciones, cancelaciones, inventario y ventanas bloqueadas. Combinan persistencia simulada con integración opcional en MongoDB temporal y no envían mensajes reales a WhatsApp.
- GitHub Actions comprueba backend y frontend en Node.js 22 y 24. En el job 24 ejecuta integración y `npm audit --audit-level=high` en ambos proyectos. Las vulnerabilidades altas y críticas bloquean el job. Revisar también las alertas bajas y moderadas, registrar su tratamiento y comprobar compatibilidad antes de actualizar.
- El procedimiento de respaldo, restauración aislada y registro de evidencia está en [docs/operations/backup-and-restore.md](docs/operations/backup-and-restore.md). La política propuesta requiere ejecución y verificación por el propietario.

## Boletín, campañas y cupones

- El boletín es gratuito; la página `/admin/marketing` permite administrar cupones promocionales y enviar campañas a suscriptores que dieron consentimiento. Los mensajes incluyen un enlace de baja.
- Solo en desarrollo, usando el transporte SMTP sin credenciales, se simulan los envíos. En producción o al seleccionar Gmail API, la configuración incompleta falla explícitamente.
- Los cupones se validan en el servidor y su uso se reserva durante el checkout; si un pedido vence o se cancela, el cupón vuelve a estar disponible.

## Documentación

El [índice de documentación](docs/README.md) reúne las guías vigentes de operación, funcionalidades, frontend y marca. Los planes históricos de implementación se consultan en el historial de Git.
