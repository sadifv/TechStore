# Correo de TechStore mediante Gmail API

## Motivo y alcance

Render Free bloquea conexiones SMTP salientes en los puertos 25, 465 y 587. El transporte `gmail-api` envía por HTTPS mediante Gmail API y conserva las plantillas de bienvenida, recuperación de contraseña y campañas. No modifica el inicio de sesión de los clientes ni solicita acceso a sus cuentas Gmail.

El remitente es una cuenta Gmail autorizada por su propietario. No es una clave API de Gemini ni una contraseña de aplicación SMTP. Los secretos OAuth se guardan únicamente en el backend o en Render, nunca en variables `VITE_*`, Git, capturas o mensajes del chat.

## Preparar Google Cloud

1. Elegir o crear un proyecto propio en Google Cloud y habilitar **Gmail API**.
2. Configurar Google Auth Platform: nombre de la aplicación, correo de soporte y audiencia apropiada. Si la aplicación está en pruebas, añadir como usuario de prueba la cuenta que enviará los correos.
3. Declarar únicamente el permiso `https://www.googleapis.com/auth/gmail.send`. No se necesitan permisos para leer o eliminar mensajes.
4. Crear un cliente OAuth de tipo **Aplicación web**. Para la autorización manual con OAuth 2.0 Playground, registrar exactamente `https://developers.google.com/oauthplayground` como URI de redirección autorizada.
5. Abrir el [OAuth 2.0 Playground oficial](https://developers.google.com/oauthplayground). En sus ajustes activar **Use your own OAuth credentials**, introducir el ID y secreto del cliente en esa página de Google y solicitar acceso offline.
6. Autorizar el scope `gmail.send` con la cuenta remitente. Intercambiar el código de autorización por tokens. Guardar el **refresh token** en el gestor de secretos o directamente en Render; no compartirlo. El access token temporal no es la variable que necesita TechStore.

Los tokens de aplicaciones externas en estado Testing pueden caducar a los siete días con este scope. Revisar la audiencia, el estado de publicación y los requisitos de verificación de Google antes de usarlo como correo permanente. No presentar una configuración temporal de pruebas como un servicio de producción duradero. Revocar la autorización en Google invalida el refresh token y exige autorizar de nuevo.

## Configurar Render

Después de publicar la versión que admite Gmail API, añadir estas variables en **Environment** del servicio backend:

```dotenv
EMAIL_TRANSPORT=gmail-api
GMAIL_USER=<correo de la cuenta autorizada>
GMAIL_OAUTH_CLIENT_ID=<ID del cliente OAuth>
GMAIL_OAUTH_CLIENT_SECRET=<secreto del cliente OAuth>
GMAIL_OAUTH_REFRESH_TOKEN=<refresh token de esa cuenta y cliente>
```

Son marcadores descriptivos: reemplazarlos directamente en Render. No guardar los valores reales en este documento. `GMAIL_USER` debe corresponder a la cuenta autorizada; la API envía como `users/me`. El código no cambia de cuenta por escribir otro correo en esa variable.

Mantener `APP_URL` y `FRONTEND_URL` apuntando al sitio HTTPS público de React. Con `gmail-api`, `SMTP_USER` y `SMTP_PASS` no se utilizan. No usar la contraseña habitual de Gmail como secreto OAuth.

Guardar la configuración y comprobar el despliegue. El mensaje de transporte configurado solo acredita que hay parámetros; no demuestra que el consentimiento o el refresh token sean válidos. La biblioteca oficial de Google obtiene y renueva el access token al enviar. El token y el mensaje no se escriben en logs.

## Comprobar la entrega

Con una cuenta de prueba propia y autorización para enviarle un mensaje, comprobar bienvenida, recuperación y una campaña dirigida exclusivamente a destinatarios de prueba. Confirmar bandeja de entrada y spam, asunto, enlaces al dominio correcto y baja de campañas. No usar una lista real de suscriptores para probar.

El transporte exige un ID de mensaje de Gmail antes de informar éxito. Ese ID acredita aceptación por Gmail, no entrega en bandeja de entrada. Los errores se registran con códigos seguros; la respuesta genérica de recuperación tampoco confirma que el envío haya ocurrido.

Las solicitudes tienen tiempo de espera. El envío no se reintenta automáticamente ante fallos de red para evitar duplicar mensajes de resultado incierto; la renovación de credenciales la gestiona la biblioteca de Google. Un error OAuth `invalid_grant`, revocación, permisos insuficientes, API deshabilitada o cuota agotada requiere revisar Google Cloud y la autorización del remitente. Nunca publicar el objeto completo de error del proveedor: puede incluir credenciales y el mensaje.

## Alternativa SMTP

`EMAIL_TRANSPORT=smtp` conserva el transporte anterior para entornos que permiten SMTP. En desarrollo sin credenciales se puede simular el correo; en producción una configuración incompleta falla. Seleccionar `gmail-api` sin sus cuatro variables falla en cualquier entorno y no utiliza SMTP como respaldo.

## Referencias

- [Restricciones de Render Free](https://render.com/docs/free)
- [Envío de mensajes mediante Gmail API](https://developers.google.com/workspace/gmail/api/guides/sending)
- [Scopes de Gmail API](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [OAuth de servidor y acceso offline](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Caducidad y revocación de tokens](https://developers.google.com/identity/protocols/oauth2#expiration)
