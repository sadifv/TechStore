# Arquitectura de TechStore

## Estructura

TechStore tiene dos aplicaciones JavaScript desplegadas por separado y una base MongoDB. El frontend React se compila con Vite y se publica en Netlify. El backend Express se ejecuta en Node.js en Render. Mongoose modela los datos de MongoDB Atlas. Las plantillas EJS del backend generan correos; la interfaz de la tienda se renderiza con React.

- `frontend/src/main.jsx`: monta React y `AppErrorBoundary`.
- `frontend/src/App.jsx`: selecciona la página por `location.pathname`, consulta la sesión y compone encabezado, contenido, carrito y pie. Varias páginas se cargan con `lazy` y `Suspense`; no hay React Router.
- `frontend/src/api.js`: URLs, solicitudes JSON y propagación de errores. Las mutaciones del panel usan también `components/admin/shared.jsx`.
- `frontend/public/`: estilos, fuentes, imágenes estáticas y configuración de Netlify.
- `backend/server.js`: configura middleware, sesiones, rutas, salud y arranque de servicios.
- `backend/routes/`: conecta métodos HTTP con autorización, validación y controladores.
- `backend/controllers/`: atiende solicitudes y construye respuestas.
- `backend/services/`: inventario, reservas, precios, MFA, campañas y tareas de dominio.
- `backend/models/`: esquemas e índices Mongoose.
- `backend/config/`: conexiones, correo, logs y URLs.
- `backend/scripts/`: utilidades de mantenimiento y migraciones explícitas.
- `backend/tests/`, `frontend/tests/` y pruebas junto al código: verificación automatizada.

## Navegación y comunicación

El navegador abre una ruta de página como `/catalogo` o `/admin/users`. Netlify entrega `index.html` y React selecciona la pantalla. Las solicitudes de datos usan `/api/*`; Netlify las reenvía a Render conservando el prefijo. `/uploads/*` también se reenvía al backend para servir imágenes guardadas en MongoDB.

Los destinos se definen en `frontend/public/_redirects`; la regla SPA va al final. No usar `/admin/...` para una mutación del frontend: esas rutas son navegación del sitio. `backend/routes/adminMutationRoutes.js` comparte los controladores de escritura bajo `/api/admin` y las rutas anteriores del backend. Los endpoints específicos de roles y pedidos también se montan desde `apiRoutes.js`.

En desarrollo Vite realiza el proxy hacia Express mediante `BACKEND_PROXY_TARGET`. Esa variable no configura el proxy de producción. `VITE_API_BASE_URL` modifica el bundle al compilar; en el despliegue Netlify actual se mantiene vacío para usar el mismo origen del navegador y sus cookies. No cambiar esta topología sin revisar CORS, CSRF y cookies.

## Identidad y autorización

El registro crea un usuario con contraseña hasheada y rol `user`. Al iniciar sesión se comprueba el hash. Para clientes se crea una sesión; para `admin` y `owner` se abre primero un desafío MFA con caducidad y solo después se autentica la sesión administrativa.

Las sesiones se almacenan en la colección `sessions` mediante `connect-mongo`. La cookie tiene una duración configurada de 24 horas. En cada ruta protegida se vuelve a comprobar la cuenta y `authVersion`; una contraseña o permiso cambiado invalida sesiones anteriores. El rol `owner` solo se configura mediante una operación de mantenimiento explícita. Véase [docs/owner-roles.md](docs/owner-roles.md).

## Carrito, checkout e inventario

El frontend mantiene el carrito mediante `CartProvider` y sincroniza el carrito de cuenta con el backend. Los cambios del carrito y el checkout respetan las reservas activas. MongoDB necesita soportar transacciones: Atlas o un replica set local; una instancia standalone no satisface ese requisito.

El backend valida productos activos, cantidades, precios efectivos y cupones. Las ofertas vencidas recuperan su precio efectivo sin depender de que ya se haya ejecutado el mantenimiento. Los pedidos conservan el nombre y el precio de compra como datos históricos.

La reserva de inventario, el pedido y la reserva del cupón se coordinan mediante transacciones y bloqueos con vencimiento. La clave de idempotencia del checkout permite recuperar un intento sin duplicar pedidos o descuentos de stock. No lanzar operaciones paralelas sobre una misma sesión de transacción.

El checkout devuelve un pedido pendiente y un enlace a WhatsApp con el resumen. El cliente debe enviar el mensaje. Abrir WhatsApp no confirma el contacto ni el pago. Un administrador registra esas confirmaciones; los pedidos pendientes vencen según la política implementada de 24 horas. Cancelación o vencimiento restituyen inventario y liberan el cupón de forma idempotente. Archivar un producto lo retira del catálogo sin borrar el historial de pedidos.

## Integraciones y mantenimiento

- **Correo:** Nodemailer se conecta a Gmail SMTP; EJS genera bienvenida, recuperación y campañas. Las campañas se procesan en una cola persistida en MongoDB. En desarrollo sin SMTP se simula el envío; en producción no se considera un envío exitoso.
- **TechBot:** usa el SDK `openai` para Chat Completions contra la configuración de Gemini. Requiere la clave del proveedor; las pruebas sin proveedor no acreditan respuestas reales.
- **Imágenes:** el backend valida los archivos y guarda bytes en `ProductImage`; sirve URLs opacas bajo `/uploads/products/`.
- **Mantenimiento:** las tareas programadas gestionan estados y vencimientos. Sus bloqueos y actualizaciones condicionadas evitan repetir operaciones críticas.
- **Presencia:** heartbeat cada 20 segundos; las páginas de usuarios y marketing refrescan cada 60 segundos. El límite general de API es compartido por IP, de modo que varias pestañas o personas de la misma red consumen el mismo presupuesto.

## Despliegue y observación

Render instala desde `backend/` con `npm ci` e inicia con `npm start`, según `render.yaml`. Netlify publica el resultado de `npm run build` en `frontend/dist/`. GitHub Actions verifica código en Node.js 22 y 24. [AGENTS.md](AGENTS.md) documenta comandos y publicación.

`GET /health` devuelve 200 cuando Mongoose está conectado y 503 cuando no lo está; no comprueba correo, IA ni todos los procesos de negocio. Winston emite logs y archivos rotados. Un HTTP 502 exige correlacionar la hora con los registros del proxy y del backend; por sí solo no demuestra suspensión por inactividad, un error MongoDB ni un fallo SMTP.

Un push a `main` no acredita el estado de producción. Verificar el commit desplegado en cada proveedor. Las migraciones y cambios de datos no forman parte automática del push.
