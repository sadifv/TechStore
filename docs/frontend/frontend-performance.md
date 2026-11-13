# Recursos y carga de la portada

Esta guía describe recursos y carga diferida del frontend actual. La optimización de
fuentes e imágenes conserva el comportamiento comercial y no modifica el video,
su poster ni su reproducción. Las paletas vigentes se documentan en el
[sistema de diseño](../../DESIGN-SYSTEM.md).

La comparación registrada aquí corresponde a la optimización previa a la nueva
[portada cinematográfica](hero-cinematic.md). Sus renders y su comportamiento tienen
documentación propia; estas cifras no representan una medición de esa escena nueva.

## Recursos locales

- Manrope variable se sirve como WOFF2 (53.744 bytes), con todos los caracteres y el
  rango original de pesos, `font-display: swap` y una precarga en el documento.
- Remix Icon conserva los 28 códigos declarados en `public/css/remixicon.css` en una
  fuente WOFF2 de 2.780 bytes. Si se añade un icono, actualizar CSS, regenerar desde la
  fuente completa y verificar que el glifo se dibuja: la prueba de clases no basta.
- La foto de referencia del portátil que ya empleaba el catálogo se sirve en WebP a
  480, 768 y 960 px. Origen de la referencia:
  `https://images.unsplash.com/photo-1593642632823-8f785ba67e45`.
  Sigue siendo una referencia visual, no una certificación del modelo fotografiado.
- `src/services/productImages.js` reconoce únicamente esa URL de origen y ruta exactas,
  independientemente de su query. Tarjetas, categorías, galería y carrito reutilizan sus variantes
  locales. Las fotos desconocidas y las subidas administrativas conservan su URL; no
  se inventan archivos derivados ni se cambia MongoDB. Cambiar la foto del producto
  por otra ruta deja de utilizar esta copia.

`scripts/optimizeStaticAssets.py` permite regenerar esos recursos fuera del build.
Requiere Python con `fonttools[woff]` y Pillow en un entorno de herramientas separado.
Se usaron FontTools 4.68.0 y Pillow 13.0.0. Recibe los originales mediante
`--manrope <ttf> --icons <woff2-completo> --laptop <foto>`; los originales de las fuentes
también se conservan en el historial anterior a esta optimización. No instala nada al
compilar ni añade dependencias al runtime. Se mantienen las licencias de ambas fuentes.

## Carga y estabilidad

Las imágenes de tarjetas, galería, miniaturas y carrito declaran dimensiones de marco en HTML. El CSS mantiene el tamaño adaptable y la imagen contenida, sin deformarla. Las pruebas retrasan deliberadamente la descarga de la foto y comparan el espacio antes/después de cargarla. Esto verifica esos marcos concretos; no equivale a medir LCP, CLS o INP de usuarios reales. Las imágenes subidas no tienen variantes nuevas: ofrecerlas requiere generar y almacenar derivados reales, en un trabajo separado.

Para investigar un 502 local, comprobar primero el backend en `http://127.0.0.1:3001/health` y después `/api/products` a través de Vite. Ambos procesos deben estar activos; la configuración de ejemplo del proxy está en `frontend/.env.example`. Un fallo local no demuestra una caída de Render o del frontend publicado. No registrar ni compartir valores de configuración privados. La suite de navegador usa un servidor y APIs ficticias aisladas; no requiere el backend de desarrollo ni Atlas.

La consulta de colecciones espera a estar a menos de 400 px de la pantalla. Se realiza
una vez por montaje y se cancela al desmontar. Sin IntersectionObserver se consulta
inmediatamente. Una colección vacía no deja un panel en blanco.

El bloque inferior conserva un chunk independiente (`lazy`/`Suspense`), pero se solicita
al montar la portada: su estructura ya existe antes de recorrer la página. Se elimina
el disparador que insertaba de golpe configurador, asistente, boletín y contacto. Esto
adelanta aproximadamente 5,5 KB comprimidos de JavaScript a cambio de estabilizar el
recorrido y las anclas. El historial de TechBot sigue condicionado a proximidad y sesión;
la imagen del boletín usa carga diferida. No se oculta contenido al teclado o a búsqueda.

La escena actual del hero reserva su espacio independientemente de la consulta al catálogo; sus renders y límites se describen en [portada cinematográfica](hero-cinematic.md).

## Comprobaciones

El 11 de noviembre de 2026 se comparó el build local antes/después con Chromium, caché
nueva, respuestas API ficticias y sin acceso al backend/Atlas, a 390×844 y 1440×900.
Los archivos estáticos se sirvieron con gzip. Las fuentes pasaron de 231.121 a 56.505
bytes transferidos en ambas vistas. No es una medición de usuarios reales ni de Render.

En escritorio, con colecciones vacías, la altura del documento pasaba de 2.276 a 6.123 px
al acercarse al asistente. Tras el cambio, la altura se mantuvo estable en ese recorrido.
Esto comprueba la inserción tardía, no acredita un valor de CLS ni un resultado Lighthouse.

Las pruebas de navegador verifican carga diferida de colecciones, acceso público después
de guardar, ancla de contacto y foto adaptable en los tres temas. Las pruebas de Node
verifican el presupuesto de fuentes y la conservación de URLs desconocidas/subidas.
