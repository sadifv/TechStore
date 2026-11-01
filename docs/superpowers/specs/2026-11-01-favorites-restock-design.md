# Favoritos y avisos de disponibilidad

Diseño aprobado en el chat el 1 de noviembre de 2026. Se implementa primero favoritos y después avisos, sin nuevas dependencias ni servicios externos.

## Favoritos

Solo usuarios autenticados. Guardar/quitar desde catálogo y ficha, consultar y quitar en Mi cuenta. Máximo 100 productos por usuario, sin duplicados. Autorización basada en la sesión actual, nunca en un userId aportado por el navegador. El límite se comprueba de forma atómica, incluso con solicitudes simultáneas. Los productos archivados o eliminados dejan una entrada removible marcada como no disponible.

Se reutilizan React, requestJson y el catálogo; una consulta compartida por sesión evita una solicitud por tarjeta. Lista y respuestas privadas sin caché.

## Avisos

Usuarios con cuenta e invitados pueden pedir un aviso desde una ficha agotada con consentimiento explícito. La respuesta pública es genérica y no revela si un correo ya tiene solicitudes. Validar producto activo y disponibilidad efectiva (stock menos reservas), correo y tamaños en el servidor.

Un correo de confirmación contiene un token aleatorio de 32 bytes. Solo se guarda su hash. Caduca a las 24 horas. Abrir el enlace muestra una página con confirmación explícita; solo POST activa el aviso. Un correo ya confirmado no pierde su consentimiento por solicitudes anónimas posteriores.

Se enviará un único aviso por solicitud cuando el producto vuelva a estar disponible. El aviso no reserva inventario ni garantiza disponibilidad al abrirlo. Cada aviso incorpora una baja específica para esa solicitud, también con token aleatorio almacenado como hash. Abrir el enlace no cambia preferencias: requiere confirmación explícita por POST. Una solicitud finalizada puede volver a iniciarse con nuevo consentimiento y nueva confirmación.

Se reutilizan Gmail API/SMTP y EJS. La confirmación se envía sin persistir el token original; los fallos no se presentan como entrega confirmada. No se usan tokens ni correos en logs. Los enlaces se construyen con el origen frontend configurado y no con cabeceras de la solicitud.

## Cola y privacidad

Colección persistente independiente de campañas comerciales, con una solicitud por producto y correo normalizado. Worker con procesamiento acotado, arranque tras MongoDB y revisión periódica de solicitudes confirmadas. Comprobaciones de disponibilidad y estado antes de reclamar y enviar; reclamación atómica evita dos emisores.

Si un proceso se interrumpe después de iniciar un envío o el proveedor no confirma su resultado, la solicitud queda con resultado desconocido y no se reenvía automáticamente. No es posible garantizar entrega exactamente una vez con Gmail; este diseño prioriza evitar duplicados. Una baja impide nuevos envíos no iniciados; no puede retirar un correo que el proveedor ya está procesando.

Decisiones de implementación: confirmación 24 horas, solicitud pendiente de aviso máximo 90 días, límite de 10 solicitudes por IP y operación cada 15 minutos; reenvío de confirmación no antes de 15 minutos para la misma solicitud; máximo 20 avisos pendientes por correo, sin revelar el cupo en la respuesta. Limpieza de datos personales tras finalización y vencimiento; conservar solo metadatos operativos mínimos. La limitación de cupo por correo debe ser atómica y no permitir que direcciones sin confirmar bloqueen las solicitudes confirmadas.

## Alternativas

Se eligió avisos para invitados con confirmación del correo frente a exigir cuenta. Los favoritos requieren cuenta para tener una lista privada entre dispositivos. No se incorporan notificaciones push, correo masivo externo, reservas automáticas ni suscripciones generales al boletín.

## Verificación

Pruebas MongoDB temporal de propiedad, límite concurrente, deduplicación, consentimiento, tokens vencidos/usados, GET sin mutación, baja, disponibilidad efectiva, dos workers y recuperación tras interrupción. Pruebas de plantillas con correo simulado y navegador móvil/escritorio con datos aislados. No enviar correos reales, crear índices en Atlas ni publicar sin autorización específica.
