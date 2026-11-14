# Controles y confirmaciones

## Diseño y alcance aprobado

Conservar los tres temas, contenido, permisos y contratos API. Los selectores
nativos comparten fondo, texto, foco y opciones legibles; en móvil conservan el
selector del sistema. No se añade una biblioteca ni se sustituye su semántica.

Las confirmaciones del navegador se sustituyen por un diálogo compartido de React
con título, explicación, Cancelar y una acción explícita. Cancelar recibe el foco;
Escape cancela y no hay escritura hasta confirmar. Al cerrar, el foco vuelve al
control de origen si sigue visible. Los errores permanecen en su formulario o
sección; los diálogos existentes de carrito, galería y compra se conservan.

## Implementación

1. Proveedor y hook de confirmación en `components/dialogs` y `hooks`, integrado en
   App, con una solicitud pendiente como máximo y cancelación al desmontar su dueño.
2. Confirmaciones nativas migradas en administración y TechBot; capturar FormData
   antes de esperar una confirmación. Sustituir alertas por mensajes accesibles.
3. Estilos globales de selectores y diálogo usando tokens, sin cambiar
   los comportamientos nativos ni la preferencia de movimiento reducido.
4. Verificar cancelar/Escape/foco/confirmar, conflictos y errores, formularios
   dentro de diálogos y tamaños móviles en los tres temas, con APIs simuladas.
5. Ejecutar lint, pruebas, build y revisiones Security/Bugbot/diseño/React. No
   publicar ni escribir en producción como parte de esta tarea.

Las confirmaciones que ya estaban integradas en la página (direcciones,
cancelación de pedidos, colecciones y moderación) conservan su interacción y sus
estilos existentes. Carrito, guía de compra y galería conservan sus propios
diálogos. No se añaden dependencias, peticiones ni cambios al backend.
