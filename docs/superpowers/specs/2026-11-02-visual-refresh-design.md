# Actualización visual de TechStore

Dirección aprobada por el usuario tras revisar el prototipo de inicio y ficha: Manrope, paleta existente, jerarquía tipográfica más marcada, productos proporcionados, menos sombras y mejores espacios. Extender el mismo lenguaje al catálogo, cuenta, formularios, carrito, checkout y administración.

## Enfoque

Se consideró conservar Inter y ajustar solo espacios o adoptar Manrope con la composición mostrada. El usuario aprobó la segunda mediante las capturas de escritorio y móvil. Se mantienen React/Vite/JavaScript y los componentes actuales; el rediseño se integra en styles.css y se retiran declaraciones reemplazadas, conforme a la indicación final del usuario.

## Restricciones

- Conservar la paleta: primario #2563eb, variantes existentes, superficies y colores de estado actuales.
- Alojar Manrope y su licencia localmente, con font-display:swap y alternativas del sistema.
- No cambiar APIs, permisos, pedidos, validación ni lógica comercial.
- Reutilizar imágenes actuales. No incorporar datos de muestra del prototipo a la tienda.
- Conservar etiquetas, foco visible, teclado, estados ocupado/error, movimiento reducido y enlaces existentes.
- Revisar 390 px y escritorio, textos largos y los estados de compra y administración.
- La publicación y los commits quedan fuera de esta implementación.

## Composición

Inicio con título y acciones del prototipo, sin promesas comerciales nuevas; destacados alineados, imágenes contenidas y precios visibles. Ficha con imagen amplia, información y compra jerarquizadas, y aviso claro del paso a WhatsApp. Formularios y paneles con bordes, controles y espaciado coherentes. Tablas conservan desplazamiento horizontal y acciones accesibles.
