# Reseñas verificadas y direcciones guardadas

Diseño aprobado en el chat: reseñas de compras pagadas y entregadas/completadas, una por usuario/producto; moderación indistinta por owner o admin con MFA; hasta cinco direcciones privadas por cuenta, una predeterminada y copia histórica al pedido. Sin dependencias nuevas, servicios externos ni publicación en esta tarea.

## Reseñas

La ficha muestra únicamente reseñas aprobadas y su promedio calculado solo sobre aprobadas, con paginación. El comprador autenticado puede crear/editar su reseña con puntuación entera 1–5 y texto plano de 10–2000 caracteres. El backend verifica un pedido propio pagado, entregado o completado que contenga el producto; no acepta la prueba de compra aportada por el navegador. Un invitado debe comprar con cuenta para poder publicar una reseña; no se vinculan pedidos por coincidencia de email.

Una creación o edición queda pendiente de moderación; editar una aprobada la retira del público hasta nueva aprobación. No se renderiza HTML y se rechazan etiquetas para mantener texto plano. Se muestra una identificación mínima del autor, sin correo, dirección, referencia del pedido ni IDs internos. El autor consulta el estado de su propia reseña y puede retirarla.

Owner y admin pueden aprobar, rechazar u ocultar reseñas con sesión/MFA comprobados por el backend. No se exige doble aprobación. Se registra actor y fecha de cada decisión; se conservan las últimas 50 decisiones por reseña para evitar crecimiento ilimitado. Como decisión de integridad, un moderador no aprueba su propia reseña; otro miembro del equipo puede revisarla. Las versiones evitan aprobar texto anterior después de una edición concurrente.

Enfoques: se eligió moderación previa por ambos roles frente a publicación automática o aprobación exclusiva del owner. No se añaden imágenes, respuestas públicas, votos útiles ni notificaciones por correo.

## Direcciones

Mi cuenta permite crear, editar, eliminar y marcar una dirección predeterminada. Máximo cinco por usuario, con límite y predeterminada coherentes bajo concurrencia. Campos mínimos: etiqueta opcional, destinatario, calle/detalle, ciudad y país; referencias opcionales acotadas. No pedir documento de identidad, geolocalización ni teléfono adicional. Límites propuestos: etiqueta40, destinatario100, calle200, ciudad100, país80 y referencia200 caracteres; texto plano sin caracteres de control ni HTML.

La autorización usa el usuario de la sesión y nunca un userId del cliente. Las respuestas son privadas y sin caché. La primera dirección se vuelve predeterminada; al borrar la predeterminada se elige otra existente de forma coherente. Invitados pueden introducir dirección puntual, pero no guardarla en cuenta.

El checkout permite elegir una dirección propia guardada o introducir una dirección puntual sin guardado implícito. La dirección sigue siendo opcional para conservar la coordinación por WhatsApp. El servidor valida y copia una instantánea al pedido; cambiar/borrar la libreta no modifica pedidos anteriores. Un ID ajeno o eliminado se rechaza antes de reservar inventario. La idempotencia incluye la selección de dirección y los reintentos recuperan el pedido histórico aunque después cambie la libreta.

La instantánea se muestra al propietario y al personal autorizado en el detalle de pedido y se incorpora al mensaje de WhatsApp para coordinar entrega. No aparece en el catálogo ni en reseñas. Los pedidos antiguos con direcciones por defecto no se presentan como una dirección elegida expresamente por el cliente.

Enfoques: libreta opcional integrada en el checkout frente a pedir dirección siempre o seguir solo con texto por WhatsApp. No se incorporan tarifas de envío, mapas, autocompletado externo ni validación postal de terceros.

## Verificación y operación

Pruebas aisladas de permisos, comprador no elegible, doble reseña, edición/moderación concurrentes, proyección pública, límite de cinco direcciones concurrentes, predeterminada, acceso ajeno, instantánea histórica y reintentos idempotentes. Verificar CSRF, límites de solicitudes, teclado, errores recuperables y móvil/escritorio. No modificar Atlas ni enviar mensajes reales por WhatsApp. Los nuevos modelos no crean índices secundarios automáticamente; la unicidad crítica usa _id natural o documentos atómicos.
