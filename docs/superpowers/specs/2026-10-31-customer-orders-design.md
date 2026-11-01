# Seguimiento y cancelación de pedidos del cliente

Diseño aprobado en el chat el 31 de octubre de 2026.

## Alcance

Ampliar el historial de Mi cuenta y la confirmación del checkout con seguimiento del pago y del envío, fechas y cronología. El cliente puede cancelar directamente mientras el pago no esté confirmado, tras una confirmación explícita en pantalla. Un pedido pagado indica contactar con la tienda; no se implementan devoluciones ni reembolsos.

## Enfoques considerados

- Cancelación directa sin pago confirmado, elegida por el usuario: respuesta inmediata y restitución transaccional del inventario y cupón.
- Solicitud con aprobación administrativa, descartada por el usuario: exigiría una cola y retrasaría la cancelación.

Se reutilizan modelos, eventos, sesiones y servicios de inventario existentes; no se añaden dependencias ni servicios externos.

## Acceso y privacidad

El usuario autenticado solo accede a sus pedidos. Un invitado necesita el identificador y la clave privada de su checkout, comprobada contra el hash existente. La clave se envía en JSON, nunca en una URL. El acceso de invitado se conserva en la pestaña actual, como ocurre hoy; perder esa clave requiere contactar con la tienda.

Las respuestas para clientes usan una lista explícita de campos públicos: referencia, productos y precios históricos, importes, estados, fechas y eventos comerciales permitidos. No incluyen claves, hashes, identidades internas de administradores, información de otros clientes ni marcadores de inventario.

## Cancelación y concurrencia

Solo pedidos WhatsApp listos, pendientes y sin pago confirmado admiten una nueva cancelación. Los ya cancelados devuelven éxito al repetirla sin duplicar eventos, stock o liberación de cupones. Un checkout en creación no es cancelable. Los pedidos vencidos se presentan como tales sin prometer disponibilidad ni pago.

La autorización ocurre antes de cualquier escritura. La transición se condiciona también dentro de la transacción: un pago concurrente impide la cancelación y una cancelación ganadora impide confirmar el pago. Se reutilizan los bloqueos y la restitución de inventario existentes con restricciones adicionales para el cliente, preservando el comportamiento administrativo y de mantenimiento.

## Interfaz y verificación

Componente compartido de seguimiento y cancelación, HTML semántico, fechas locales, mensajes accesibles y confirmación en línea con opción de volver. Botones bloqueados durante solicitudes, errores recuperables y actualización manual sin sondeo permanente.

Pruebas de acceso ajeno, clave de invitado errónea, proyección de campos, cancelación repetida, creación en curso, pago/cancelación concurrentes, restitución atómica de inventario y cupones, navegación y estados de interfaz. Pruebas de escritura exclusivamente con MongoDB temporal. Sin commit, push ni cambios en producción en esta tarea.
