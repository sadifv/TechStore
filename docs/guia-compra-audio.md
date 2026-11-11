# Narraciones de «Cómo comprar»

Los cuatro MP3 se sirven desde `frontend/public/audio/como-comprar/`. La reproducción es manual y no requiere voces instaladas en Windows. No se precargan ni se solicitan servicios de síntesis durante el uso de la tienda.

## Procedencia

Audio sintético generado para TechStore con la voz `es-EC-AndreaNeural`, a velocidad `-5%`, mediante [edge-tts](https://github.com/rany2/edge-tts) 7.3.1 en un entorno Python temporal. Esta herramienta no forma parte de las dependencias del proyecto ni del despliegue. No se usaron voces clonadas ni datos de clientes.

Si cambia el flujo, actualizar el texto visible y regenerar el MP3 correspondiente. Conservar el aviso de demostración y la aclaración sobre envío del mensaje y pago. La suite de navegador comprueba que los cuatro archivos existen y se decodifican, además de los controles de reproducción.

## Transcripciones

### paso-1.mp3

Demostración de compra. Elige un producto. Explora el catálogo, revisa la ficha y pulsa Agregar al Carrito. Esta demostración no crea pedidos ni reserva productos.

### paso-2.mp3

Revisa tu carrito. Comprueba productos, cantidades y subtotal. Después pulsa Proceder al Pago.

### paso-3.mp3

Completa tus datos. Como invitado, indica tu nombre y correo de contacto. Revisa la dirección y, si tienes uno, tu cupón. Pulsa Continuar por WhatsApp para preparar el pedido y abrir el mensaje.

### paso-4.mp3

Coordina por WhatsApp. En la compra real se prepara un mensaje con tu pedido. Envíalo desde WhatsApp y coordina disponibilidad y pago con la tienda. Abrir WhatsApp no envía el mensaje ni confirma el pago.
