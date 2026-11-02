# Seguridad de TechStore

## Reportar una vulnerabilidad

Comunicar los hallazgos sensibles de forma privada al mantenedor del repositorio. Si GitHub ofrece **Security → Report a vulnerability**, utilizar ese canal. Si no está habilitado, acordar un canal privado con el mantenedor antes de enviar detalles. No existe un correo de seguridad dedicado documentado en este repositorio.

Incluir la versión o commit afectado, una descripción, pasos mínimos de reproducción y el impacto observado. Usar cuentas y datos de prueba. No adjuntar contraseñas, sesiones, tokens de recuperación, secretos MFA, cadenas MongoDB o datos personales de clientes en issues públicos.

La referencia mantenida es `main`. No se promete soporte de seguridad para versiones antiguas ni un plazo fijo de respuesta. El mantenimiento actual comprueba Node.js 22 y 24 mediante CI.

## Controles implementados

- **Sesiones:** `express-session` con almacenamiento MongoDB mediante `connect-mongo`. La cookie es `HttpOnly`, `SameSite=Lax` y `Secure` en producción. No se usa JWT para el inicio de sesión de la tienda.
- **Contraseñas:** hashing con bcryptjs; el registro y la recuperación validan sus límites. Los campos de autenticación sensibles se excluyen por defecto en el modelo de usuario.
- **Permisos:** el servidor vuelve a cargar la identidad y el rol. `owner` puede gestionar administradores; `admin` gestiona las operaciones de la tienda; `user` accede a funciones de cliente. Las cuentas administrativas están protegidas contra eliminación por la API de usuarios.
- **Segundo factor:** `owner` y `admin` requieren TOTP o recuperación MFA. Los códigos de recuperación se guardan como hashes y se consumen una sola vez. El secreto TOTP se almacena cifrado. El registro público siempre crea `user`.
- **Revocación:** los cambios de contraseña o rol incrementan `authVersion`, invalidando las sesiones y los desafíos MFA anteriores.
- **Solicitudes:** CORS con orígenes explícitos, comprobaciones CSRF de contexto/origen del navegador, Helmet y cabeceras del frontend. No sustituir estas comprobaciones por CORS únicamente.
- **Validación:** las reglas reconocen las mismas variantes de mayúsculas que Express; los campos de texto no admiten arrays/objetos y los numéricos deben ser finitos. Los permisos siguen comprobándose de forma independiente.
- **Caché privada:** las rutas de autenticación (incluido MFA), administración, carrito, pedidos, direcciones, favoritos, reseña propia, presencia e historial del asistente emiten `Cache-Control: no-store`, también ante errores. No afecta a las imágenes públicas inmutables ni al catálogo.
- **Abuso:** límites de API y de operaciones sensibles. Login, checkout y MFA usan contadores persistentes MongoDB. Algunos límites generales son locales al proceso y por IP; no constituyen una garantía de capacidad distribuida.
- **Datos comerciales:** el backend calcula importes, valida cupones y controla inventario mediante transacciones, actualizaciones condicionadas e idempotencia.
- **Catálogo público:** `toPublicProduct` solo devuelve campos permitidos, también para agregaciones ordenadas por precio que no aplican `select:false` de Mongoose. Omite marcadores internos de restitución, bloqueos y campos nuevos no autorizados.
- **Archivos:** las imágenes de producto se validan por tamaño, tipo y firma; su contenido se almacena en MongoDB.

Estos controles describen el código; no equivalen a una certificación de seguridad ni garantizan la configuración de los proveedores.

## Credenciales y operación

Las reseñas requieren una compra propia pagada y entregada/completada, verificada en el servidor. No se acepta autor, estado aprobado ni prueba de compra enviados por el navegador. Solo reseñas aprobadas aparecen públicamente; sus ediciones vuelven a pendiente y las decisiones se condicionan a versión. Owner y admin requieren MFA y no pueden aprobar su propia reseña. La auditoría interna no se devuelve en el listado público.

Las direcciones pertenecen exclusivamente al usuario de la sesión, incluso si quien consulta es personal administrativo. El límite de cinco y la predeterminada se mantienen mediante actualizaciones atómicas/CAS. Se recopilan destinatario, calle, ciudad, país y referencia opcional; no se añade documento, teléfono ni geolocalización. La dirección puntual de un invitado no crea libreta. Cambiar/borrar una dirección no modifica datos históricos de pedidos.

El seguimiento y la cancelación de pedidos verifican la propiedad en el servidor. Los invitados necesitan la clave privada del checkout, enviada por JSON y comprobada contra su hash; conocer la referencia del pedido no concede acceso. Las respuestas públicas omiten credenciales, datos internos de inventario y actores de administración, y deshabilitan almacenamiento en caché.

La cancelación del cliente tiene un límite persistente específico y conserva las comprobaciones CSRF del servidor. La transacción vuelve a condicionar la actualización a pedido propio, listo y pendiente: no puede restituir inventario de un pedido pagado ni duplicar devoluciones de stock o liberaciones de cupón en reintentos.

- Usar `.env.example` como referencia. Guardar secretos locales en archivos ignorados y los de producción en el proveedor correspondiente. No versionarlos.
- Separar usuarios MongoDB por finalidad y aplicar el mínimo privilegio necesario. Una cuenta de revisión de solo lectura no sirve como cuenta operativa de la aplicación.
- Conservar `SESSION_SECRET` de forma segura y estable: participa en las sesiones y en el cifrado MFA. Planificar su rotación junto con la recuperación y el nuevo enrolamiento MFA.
- Si se expone una credencial, revocarla o rotarla en el proveedor, revisar el alcance e invalidar sesiones cuando corresponda. Borrar una captura o editar `.env` no revoca una credencial.
- No registrar contraseñas, cookies, URI completas, secretos MFA o enlaces de recuperación. Revisar los logs antes de compartirlos.
- Los enlaces de recuperación de contraseña caducan en una hora. La respuesta genérica del formulario no confirma que el correo se haya enviado.
- El restablecimiento consume el token, cambia el hash de contraseña e incrementa `authVersion` en una única actualización condicionada. Dos solicitudes concurrentes con el mismo token solo permiten un cambio; los intentos rechazados no consumen un token vigente.
- Verificar copias de seguridad y restauraciones con procedimientos del proveedor. El repositorio no demuestra por sí solo que exista un respaldo válido.

## Dependencias y verificación

Favoritos y avisos mantienen controles independientes del boletín. Los favoritos solo se consultan y modifican para la sesión actual y tienen un límite atómico de 100. Los avisos requieren consentimiento y verificación del correo por token; no se activan ni cancelan por GET. La cuota de 20 avisos confirmados es transaccional; los límites por IP/operación y por dirección reducen el abuso de correo sin divulgar solicitudes existentes. Las respuestas públicas no prometen que el correo haya sido enviado.

Los tokens de aviso se almacenan como hashes; el navegador los recibe en fragmentos para evitar incluirlos en peticiones HTTP y los retira de la barra. No registrarlos ni incluirlos en capturas. Una baja antes de iniciar el envío cancela la preparación; una entrega ya iniciada no puede retirarse. Ante un resultado ambiguo no se reenvía automáticamente. Las pruebas usan destinatarios ficticios y transporte simulado.

Los lockfiles de `backend/` y `frontend/` forman parte del proyecto; usar `npm ci` para instalaciones reproducibles. Consultar `npm audit` en ambos directorios y revisar notas, compatibilidad y pruebas antes de actualizar. No resolver alertas desactivando la auditoría o usando `--force` sin analizar el cambio.

El frontend fija mediante `overrides` la rama corregida de `minimatch` (>=11.0.1) usada por ESLint y su configuración, por GHSA-g3hv-75wg-m249. Es una dependencia de desarrollo; no forma parte del JavaScript del cliente. El lockfile resuelve la versión concreta y lint/build verifican compatibilidad. Revisar si se puede retirar este override cuando los paquetes superiores incorporen la corrección.

CI ejecuta pruebas en Node.js 22 y 24; la auditoría de ambos proyectos se ejecuta en el trabajo de Node.js 24. Un trabajo verde de Node.js 22, por sí solo, no confirma el resultado de la auditoría. Consultar [AGENTS.md](AGENTS.md) para los comandos de verificación.
