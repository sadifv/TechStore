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

## Seguimiento y cancelación del cliente

Mi cuenta y la confirmación del checkout comparten el seguimiento de pago, envío y cronología pública. El listado y las respuestas individuales usan `customerOrderView`; no devuelven claves de checkout, hashes, actores internos ni marcadores de inventario. Los nombres históricos tienen prioridad; los pedidos antiguos sin instantánea conservan el nombre disponible del producto.

`POST /api/orders/track` recibe `orderId` y, para invitados, `checkoutKey` en JSON. Reutiliza la comprobación privada de `/api/orders/success`. La clave de invitado permanece en sessionStorage de la pestaña que hizo el checkout, nunca en la URL. Si se pierde, el cliente debe contactar con la tienda. Las respuestas de pedidos usan `Cache-Control: no-store`.

`POST /api/orders/cancel` permite cancelar pedidos propios de WhatsApp listos, pendientes y no vencidos, antes de confirmar el pago. Requiere confirmación explícita en la interfaz y tiene un límite persistente independiente de 20 solicitudes cada 15 minutos por IP. Un pedido ya cancelado con inventario restituido admite reintentos sin repetir stock, cupón ni eventos. Un pago confirmado requiere contactar con la tienda; no hay reembolso automático.

La restitución reutiliza las transacciones y bloqueos existentes, con condiciones adicionales de estado y propiedad comprobadas dentro de la transición. Pago y cancelación concurrentes producen un único resultado; un fallo en la restitución o el cupón revierte la operación. La interfaz ofrece actualización manual y reintentos tras errores, sin sondeo periódico. Un vencimiento se distingue de una cancelación voluntaria incluso después de restituir inventario.

## Reseñas verificadas y direcciones

La ficha del producto muestra solo reseñas aprobadas, paginadas de diez en diez, y un promedio calculado sobre aprobadas. `ProductReview` usa `_id=producto:usuario` canónico para impedir duplicados sin índices secundarios automáticos. El backend comprueba un pedido propio pagado y entregado/completado, valida nota entera1–5 y texto plano10–2000. Las creaciones y ediciones quedan pendientes; el autor puede retirar su reseña. La respuesta pública omite usuario, correo, pedido y auditoría; muestra únicamente un nombre mínimo, nota, texto, fecha y compra verificada.

`/api/reviews` gestiona la reseña propia, `/api/products/:id/reviews` sirve el listado público y `/api/admin/reviews` atiende moderación. Owner y admin requieren sesión vigente y MFA. Cualquiera puede tomar una decisión, sin doble aprobación; un moderador no aprueba su propia reseña. Edición, retiro y moderación usan versión/CAS para impedir aprobar texto anterior tras una edición concurrente. La auditoría guarda las últimas50 decisiones con actor/fecha. La escritura del cliente tiene límite propio y la moderación conserva el presupuesto administrativo. `/admin/reviews` se abre desde el dashboard.

`AddressBook` es un documento privado `_id=usuario`, con máximo cinco entradas y referencia a una predeterminada. `/api/addresses` permite alta/listado y rutas por ID para editar, borrar y marcar predeterminada. Las altas usan CAS y deduplican entradas idénticas; las otras mutaciones exigen la versión vigente. Nunca se acepta un propietario aportado por el cliente. Eliminar la predeterminada elige otra existente o deja null si la libreta queda vacía. La respuesta privada usa no-store.

El checkout admite `savedAddressId` propio o `shippingAddress` puntual, nunca ambos. La dirección es opcional y no se guarda implícitamente. `checkoutService` resuelve y valida dentro de la transacción después de buscar un checkout idempotente existente; copia campos permitidos al pedido y marca `shippingAddressProvided`. Un reintento recupera el pedido aunque se haya editado/borrado la libreta, y un ID ajeno o eliminado se rechaza sin reservar inventario. No ejecutar consultas paralelas en la sesión transaccional.

La copia se muestra solo en rutas autorizadas del cliente, personal y comprobante administrativo; se incorpora al mensaje WhatsApp codificado. Abrirlo sigue sin acreditar envío ni pago. Los pedidos legacy sin `shippingAddressProvided` indican entrega por coordinar y no presentan los valores por defecto como una dirección real.

Ambos modelos nuevos tienen autoIndex:false. La unicidad y privacidad no dependen de índices secundarios. `npm run db:ensure-review-indexes` inspecciona sin escribir; aplicar requiere autorización específica y `-- --apply --database=TechStore`, con nombre exacto del destino. Durante desarrollo solo se aplicaron en MongoDB temporal.

## Integraciones y mantenimiento

### Favoritos y avisos de disponibilidad

`/api/favorites` y `/api/favorites/:productId` requieren sesión vigente. `FavoriteList` usa el ID del usuario como `_id`, admite hasta 100 productos mediante actualización condicional atómica y no duplica favoritos. El listado calcula disponibilidad por lotes y deja removibles los productos retirados. React comparte una consulta por sesión mediante `FavoritesProvider`; catálogo, ficha y Mi cuenta usan el mismo estado privado.

Los invitados y usuarios pueden solicitar un aviso en `/api/restock-alerts` con consentimiento explícito. Se responde 202 genérico antes de consultar cuentas o enviar correo, por lo que no acredita entrega ni revela solicitudes anteriores. El correo de confirmación caduca en 24 horas. `/api/restock-alerts/confirm` y `/unsubscribe` cambian preferencias únicamente por POST con un token aleatorio de 32 bytes; MongoDB almacena su hash. Los enlaces frontend `/avisos/confirmar` y `/avisos/baja` llevan el token en el fragmento, se retira de la barra al abrir y se conserva en sessionStorage para permitir reintentar en la misma pestaña.

`RestockAlert` usa un `_id` determinista a partir del hash del correo y el ObjectId canónico del producto. La cuota de 20 solicitudes confirmadas por correo se reserva y libera mediante transacciones sobre `RestockQuota`; solicitudes sin confirmar no consumen ese cupo. Hay limitadores persistentes por IP y operación, espera de 15 minutos por reenvío y un máximo de 10 confirmaciones por hora por dirección para reducir abuso.

`restockQueue` revisa lotes de hasta 50 solicitudes al arrancar y cada 60 segundos sin bloquear la escucha HTTP. Rota candidatos para que los productos agotados no bloqueen a otros. Comprueba producto activo y stock menos reservas por lote y antes del envío. La reclamación pasa por `claimed`, aún cancelable, y luego por una transición atómica a `sending` inmediatamente antes de entregar al transporte. Un envío incierto o interrumpido queda `delivery_unknown` y no se reenvía automáticamente. El aviso no reserva stock ni garantiza su disponibilidad al abrirlo.

Los avisos vencen a los 90 días; las confirmaciones no completadas a las 24 horas. Los estados terminales eliminan correo y referencias de cuota en una transacción; los metadatos restantes y hashes se eliminan tras 24 horas, y los documentos de cuota vacíos antiguos se limpian. La baja no puede retirar un correo cuyo envío ya comenzó.

Los modelos nuevos tienen `autoIndex:false`; la unicidad crítica depende de `_id` nativo, no de una migración automática. Los índices secundarios de consulta se preparan con `node scripts/ensureRestockIndexes.js` desde backend en modo lectura por defecto. Aplicarlos requiere autorización de destino y `--apply --database=TechStore` (nombre exacto de la base configurada). Este desarrollo solo los verificó/aplicó en MongoDB temporal.

- **Correo:** `EMAIL_TRANSPORT` selecciona Gmail API por HTTPS con OAuth o Gmail SMTP. Nodemailer compone el mensaje y EJS genera bienvenida, recuperación y campañas. Las campañas se procesan en una cola persistida en MongoDB. Gmail API requiere configuración completa y no recurre a SMTP si falla; solo SMTP sin credenciales en desarrollo permite simulación. Véase [docs/gmail-api.md](docs/gmail-api.md).
- **TechBot:** usa el SDK `openai` para Chat Completions contra la configuración de Gemini. Requiere la clave del proveedor; las pruebas sin proveedor no acreditan respuestas reales.
- **Imágenes:** el backend valida los archivos y guarda bytes en `ProductImage`; sirve URLs opacas bajo `/uploads/products/`.
- **Mantenimiento:** las tareas programadas gestionan estados y vencimientos. Sus bloqueos y actualizaciones condicionadas evitan repetir operaciones críticas.
- **Presencia:** heartbeat cada 20 segundos; las páginas de usuarios y marketing refrescan cada 60 segundos. El límite general de API es compartido por IP, de modo que varias pestañas o personas de la misma red consumen el mismo presupuesto.

## Despliegue y observación

Render instala desde `backend/` con `npm ci` e inicia con `npm start`, según `render.yaml`. Netlify publica el resultado de `npm run build` en `frontend/dist/`. GitHub Actions verifica código en Node.js 22 y 24. [AGENTS.md](AGENTS.md) documenta comandos y publicación.

`GET /health` devuelve 200 cuando Mongoose está conectado y 503 cuando no lo está; no comprueba correo, IA ni todos los procesos de negocio. Winston emite logs y archivos rotados. Un HTTP 502 exige correlacionar la hora con los registros del proxy y del backend; por sí solo no demuestra suspensión por inactividad, un error MongoDB ni un fallo SMTP.

Un push a `main` no acredita el estado de producción. Verificar el commit desplegado en cada proveedor. Las migraciones y cambios de datos no forman parte automática del push.
