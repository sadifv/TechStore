# Portada cinematográfica

Referencia visual: reel público de `w.wearebrand`,
`https://www.instagram.com/reel/Del2pvkPCwM/`: objeto protagonista sobre fondo oscuro,
vista desplegada de sus componentes, acercamiento al interior y recorrido por scroll.

La adaptación de TechStore presenta auriculares ilustrativos, sin asociarlos a un SKU,
precio o prestaciones del inventario. El tema normal usa azul/coral; Halloween usa violeta y verde ácido, y Navidad
esmeralda y dorado, mediante los tokens compartidos del [sistema de diseño](../../DESIGN-SYSTEM.md). No modifica checkout, pedidos, autenticación ni el
archivo o la reproducción del video de fondo existente.

## Recursos y límites

Los dos renders se generaron con la herramienta integrada de imágenes el 11 de
noviembre de 2026: versión ensamblada y versión desplegada del mismo concepto.
Se sirven como WebP con transparencia a 640 y 1280 px en
`frontend/public/images/experience/`. Los originales son 1774×887 px.
Los dos recursos móviles suman aproximadamente 61 KB; los de escritorio, 182 KB.

Son imágenes prerenderizadas, no geometría WebGL ni una simulación física del producto.
La transición entre vistas y el acercamiento se hacen con opacidad y transformaciones
CSS. No se usan recortes rectangulares de la fotografía del catálogo. El aviso visible
aclara que son ilustrativos; la disponibilidad se consulta en el catálogo.

## Comportamiento

`HeroSection.jsx` contiene la presentación. `useCinematicHero.js` concentra el scroll,
los tres capítulos y las preferencias de movimiento. Con al menos 900×700 px y sin
movimiento reducido, la escena ocupa tres alturas de pantalla y mantiene su interior
visible bajo el encabezado. El desplazamiento es nativo: no se cancela la rueda.
Un solo requestAnimationFrame actualiza variables CSS y omite escrituras si el progreso
no cambia; React solo cambia el capítulo cuando corresponde.

Los tres botones permiten elegir escenas. En móvil, ventanas bajas o movimiento
reducido, no hay recorrido fijado: los botones cambian la vista sin desplazar la página.
El catálogo y «Cómo comprar» permanecen accesibles. Los listeners y frames se liberan
al desmontar o cambiar de preferencia.

Las pruebas locales simulan todas las APIs. Verifican las tres fases, la salida de la
escena hacia destacados, catálogo, ausencia de mutaciones, anclas y desborde en los tres
temas a 320, 390, 768, 1024 y 1440 px. No acreditan Web Vitals de producción.
