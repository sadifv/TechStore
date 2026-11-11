# Guía animada de compra

**Objetivo:** explicar la compra por WhatsApp desde la portada sin ejecutar operaciones comerciales.

**Diseño aprobado:** acceso «Cómo comprar» junto al catálogo; diálogo con cuatro escenas, reproducción, pausa, navegación manual y cierre. Datos ficticios identificados como demostración. Colores de los tres temas mediante tokens existentes. Movimiento reducido: pasos estáticos. Abrir WhatsApp no envía mensajes ni confirma pagos.

**Decisión técnica:** React y CSS permiten mantener textos, accesibilidad y colores sincronizados con la tienda. Un MP4 exigiría regenerar capturas ante cambios y no permite recorrer los pasos. No se añaden dependencias, APIs ni enlaces externos a la demostración.

## Implementación

- [x] Crear prueba de navegador: recorrido manual, aislamiento de carrito/pedidos, Escape/foco y movimiento reducido.
- [x] Crear `components/home/PurchaseGuide.jsx` con diálogo nativo y escenas de ejemplo. Desmontar al cerrar para limpiar temporizadores. Pausar al ocultar la pestaña y al navegar manualmente; terminar al llegar a WhatsApp, sin bucle.
- [x] Integrar el acceso en `HeroSection.jsx` y los estilos móviles/tokens en `styles.css`; colocar adaptación de escritorio en el bloque existente de media queries.
- [x] Comprobar lint, build, pruebas y presentación móvil/escritorio/temas. Documentar comportamiento.

No crear commits ni publicar como parte de esta tarea.
