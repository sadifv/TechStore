# Propietario y administradores

El propietario (`owner`) conserva todas las funciones administrativas y es el único que puede cambiar usuarios entre `user` y `admin` desde Administración → Usuarios. Los cambios requieren una sesión con MFA; el servidor vuelve a cargar el rol y la versión de autenticación desde MongoDB.

No existe una API para asignar, retirar o transferir `owner`. El índice parcial único `singleton_owner` permite como máximo un propietario. Las cuentas `owner` y `admin` no pueden eliminarse mediante la API de usuarios. Para eliminar un administrador, el propietario debe retirarle primero ese rol. El registro público siempre crea `user`, aunque el cliente envíe otro rol.

Cada cambio de rol incrementa `authVersion`, invalidando sesiones y verificaciones MFA pendientes. Un usuario promovido debe iniciar sesión de nuevo y completar/configurar MFA. Se conserva el secreto MFA existente al retirar permisos; cualquier nueva promoción sigue requiriendo MFA. Los eventos `user_role_changed` registran actor, destinatario y roles, sin contraseñas ni secretos.

## Activación de la cuenta actual

1. Desplegar primero el backend y el frontend compatibles con `owner`. Cambiar el rol mientras corre la versión anterior bloquearía el acceso administrativo.
2. Desde `backend`, usando la conexión correcta, ejecutar `node scripts/promoteOwner.js`. Es una simulación que identifica por ID al único administrador existente y no escribe datos. Verificar ese ID en Atlas antes de aplicar.
3. Ejecutar `node scripts/promoteOwner.js --apply`. Crea/verifica el índice de propietario, convierte ese administrador y revoca sus sesiones anteriores. No cambia la contraseña ni la configuración MFA.
4. Iniciar sesión de nuevo con la misma cuenta y MFA. En Usuarios debe aparecer Propietario y los botones para gestionar administradores.

La migración se detiene si no existe exactamente un administrador. Si ya hay propietario, no modifica cuentas. Los administradores añadidos después nunca pueden gestionar roles, ni llamando directamente a la API.
