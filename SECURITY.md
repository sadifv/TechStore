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
- **Abuso:** límites de API y de operaciones sensibles. Login, checkout y MFA usan contadores persistentes MongoDB. Algunos límites generales son locales al proceso y por IP; no constituyen una garantía de capacidad distribuida.
- **Datos comerciales:** el backend calcula importes, valida cupones y controla inventario mediante transacciones, actualizaciones condicionadas e idempotencia.
- **Archivos:** las imágenes de producto se validan por tamaño, tipo y firma; su contenido se almacena en MongoDB.

Estos controles describen el código; no equivalen a una certificación de seguridad ni garantizan la configuración de los proveedores.

## Credenciales y operación

- Usar `.env.example` como referencia. Guardar secretos locales en archivos ignorados y los de producción en el proveedor correspondiente. No versionarlos.
- Separar usuarios MongoDB por finalidad y aplicar el mínimo privilegio necesario. Una cuenta de revisión de solo lectura no sirve como cuenta operativa de la aplicación.
- Conservar `SESSION_SECRET` de forma segura y estable: participa en las sesiones y en el cifrado MFA. Planificar su rotación junto con la recuperación y el nuevo enrolamiento MFA.
- Si se expone una credencial, revocarla o rotarla en el proveedor, revisar el alcance e invalidar sesiones cuando corresponda. Borrar una captura o editar `.env` no revoca una credencial.
- No registrar contraseñas, cookies, URI completas, secretos MFA o enlaces de recuperación. Revisar los logs antes de compartirlos.
- Los enlaces de recuperación de contraseña caducan en una hora. La respuesta genérica del formulario no confirma que el correo se haya enviado.
- Verificar copias de seguridad y restauraciones con procedimientos del proveedor. El repositorio no demuestra por sí solo que exista un respaldo válido.

## Dependencias y verificación

Los lockfiles de `backend/` y `frontend/` forman parte del proyecto; usar `npm ci` para instalaciones reproducibles. Consultar `npm audit` en ambos directorios y revisar notas, compatibilidad y pruebas antes de actualizar. No resolver alertas desactivando la auditoría o usando `--force` sin analizar el cambio.

CI ejecuta pruebas en Node.js 22 y 24; la auditoría de ambos proyectos se ejecuta en el trabajo de Node.js 24. Un trabajo verde de Node.js 22, por sí solo, no confirma el resultado de la auditoría. Consultar [AGENTS.md](AGENTS.md) para los comandos de verificación.
