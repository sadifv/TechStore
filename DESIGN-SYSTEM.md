# Sistema de diseño de TechStore

Este documento describe el estilo existente y las convenciones para mantenerlo. Los estilos visuales y los tokens se mantienen en `frontend/public/css/styles.css`; `frontend/src/index.css` conserva únicamente las reglas globales de montaje de React. No constituye una biblioteca de componentes independiente.

## Colores

Los temas estacionales están en `frontend/public/css/halloween.css` y `frontend/public/css/christmas.css`. Son capas sobre `styles.css`: requieren cargar su hoja después de la base y establecer `data-theme="halloween"` o `data-theme="christmas"` en `html`. Sin ese atributo no modifican el tema normal. Conservan layout, tipografía y estados funcionales; no incluyen animación decorativa. El owner con MFA selecciona el tema desde «Estilo de la tienda» en el dashboard. Se guarda en StoreAppearance (documento global); GET /api/store/appearance devuelve solo el tema y PATCH /api/admin/appearance valida rol, MFA y una lista cerrada. Los visitantes reciben la selección al cargar la página; no hay actualización automática de pestañas ya abiertas.

Reutilizar las variables CSS existentes:

- Acción principal: `--color-primary` (`#2563eb`), oscuro `--color-primary-dark` (`#1d4ed8`) y claro `--color-primary-light` (`#91b6ff`).
- Fondo normal efectivo: `--color-background` (`#090f1b`); superficie: `--color-surface` (`#121c2c`); superficie interactiva: `--color-surface-hover` (`#1c2940`).
- Texto normal efectivo: `--color-text` y `--color-secondary` (`#edf1fa`); texto secundario: `--color-text-muted` (`#b6c2d4`).
- Bordes: `--color-border` (`#34455f`).
- Estados sobre superficies oscuras: `--color-error` (`#ff9da6`), `--color-success` (`#6ee7b7`) y `--color-warning` (`#ffcf73`).

No comunicar un estado solo con color. Acompañar las insignias de texto y comprobar el contraste de cada combinación, tamaño y estado interactivo; la existencia de un token no garantiza su conformidad WCAG.

## Tipografía y medidas

La familia principal es `--font-family`: Manrope variable (200–800), alojada en `/fonts/manrope-variable.woff2`, con `font-display: swap` y alternativas del sistema. Su licencia está en `frontend/public/fonts/MANROPE-OFL.txt`. No depende de Google Fonts en tiempo de ejecución. La escala existente va de `--font-size-xs` (0.75rem) a `--font-size-3xl` (2rem), pasando por 0.875, 1, 1.125, 1.25 y 1.5rem. Los títulos de portada/ficha tienen escalas adaptables propias. Conservar una jerarquía de encabezados coherente.

El espaciado usa `--space-2`, `--space-3`, `--space-4`, `--space-6`, `--space-8`, `--space-12` y `--space-16`: 0.5, 0.75, 1, 1.5, 2, 3 y 4rem. Preferir esos valores al añadir estilos.

Los radios son `--radius-md` (0.5rem), `--radius-lg` (0.75rem), `--radius-xl` (1rem) y `--radius-full` (9999px). Reutilizar `--shadow-card` y `--shadow-hover`. Las transiciones existentes son `--transition-fast` (150ms) y `--transition-normal` (250ms).

La actualización visual conserva los colores y prioriza bordes suaves, superficies limpias y sombras discretas. Usa controles de referencia de 48px (`--control-height`), títulos con peso 800 y precios tabulares. Inicio, catálogo y ficha comparten imágenes contenidas sin recorte, alineación izquierda y acciones azules. Cuenta, autenticación, carrito y administración reutilizan este ritmo. Las tablas conservan su contenedor de desplazamiento; no se ocultan columnas para que quepan en móvil.

En móvil, los campos editables mantienen al menos 16px de texto, incluidos MFA, direcciones y formularios administrativos. Evitar reducirlos por densidad visual.

## Componentes y comportamiento

TechBot ofrece «Chat libre» y «Compra guiada» a usuarios con sesión. El segundo modo carga bajo demanda; sus campos permanecen editables y descartan consultas anteriores al cambiar respuestas. Categoría, uso y presupuesto opcional generan hasta tres opciones con datos del catálogo, limitaciones explícitas, comparación por categoría y carrito reutilizados. Los controles usan tokens del tema, etiquetas y alturas de 48 px; el formulario pasa a columnas según el espacio disponible, sin animaciones nuevas.

La búsqueda reemplaza la entrada actual del historial (`replaceState`); categoría, orden y página añaden una entrada (`pushState`). Así, volver atrás recupera cambios explícitos sin recorrer búsquedas parciales.

El catálogo ofrece reintento tras un error conservando los filtros y una acción para limpiarlos cuando están activos, sin eliminar parámetros ajenos de la URL. El checkout y su confirmación aclaran que el costo de entrega no está incluido y se coordina por WhatsApp; no calculan una tarifa de transporte.

- **Catálogo y compra:** búsqueda, categoría, orden y página se sincronizan con la URL sin perder parámetros ajenos ni navegación atrás/adelante. Las consultas siguen esperando 300 ms al escribir y cancelan solicitudes obsoletas. Los importes se presentan con `money` (USD, `es-EC`, dos decimales y separadores de miles) en toda la interfaz; el servidor conserva el cálculo de precios. «Continuar con el pedido» abre «Coordinación del pedido»: no es una pasarela de pago.
- **Imágenes de catálogo:** tarjetas, ficha, miniaturas y carrito declaran dimensiones de sus marcos; CSS mantiene los tamaños adaptables y `object-fit: contain`. Se reutilizan las variantes locales existentes donde están disponibles. Las fotos subidas conservan su URL; no se generan variantes ficticias ni se promete una mejora de CLS sin medición.

- **Mi cuenta:** «Mis pedidos» separa activos y anteriores con resumen y siguiente paso fiel al estado del servidor; el desplegable conserva seguimiento y cancelación. Al pasar a anteriores se enfoca ese grupo. Favoritos muestra grupos de cuatro, disponibilidad orientativa y búsqueda por nombre sin distinguir tildes; guardar no reserva stock. Usa una columna hasta 520 px, dos desde 521 px y cuatro desde 1001 px. «Recargar direcciones» vuelve a consultar la libreta. «Datos y seguridad» permite editar nombre y cambiar correo/contraseña con comprobación de identidad; el correo se mantiene hasta verificar el nuevo buzón. Se reutilizan campos de contraseña visibles/ocultos, controles etiquetados y tokens de los tres temas. Tras cambiar credenciales se vuelve al login y se exige MFA al personal administrativo.

- **Cómo comprar:** el acceso abre una presentación de TechStore y cuatro pasos de compra en un diálogo nativo. La narración opcional usa cinco MP3 locales en español ecuatoriano, sin reproducción automática ni descarga al abrir. Pausar conserva la posición y reanudar continúa desde ella; cambiar de escena, ocultar la pestaña o cerrar detiene el audio. Las escenas usan datos ficticios y no crean pedidos, reservan inventario ni abren WhatsApp. Texto y controles permanecen disponibles sin audio y con movimiento reducido. Se conserva el foco y la adaptación de los tres temas. Procedencia y transcripciones en `docs/frontend/guia-compra-audio.md`.

- **TechBot sin sesión:** presenta una conversación de ejemplo que termina preguntando por uso y presupuesto, sin recomendaciones ni fichas de producto anticipadas. El chat real y su historial requieren sesión. El registro y el login conservan el retorno a la sección.

- **TechBot con sesión:** las sugerencias iniciales rellenan el campo sin enviar. Solo el historial desplaza sus mensajes; el compositor queda fuera de ese contenedor. Las fichas corresponden a nombres mencionados en la respuesta y a IDs resueltos por el servidor; al recuperar el historial se consultan de nuevo precio, reservas y estado de archivado.

- **Contacto:** WhatsApp es el canal principal, seguido por correo, ubicación y horario. El formulario identifica su finalidad y el correo como canal de respuesta. Una línea con el acento del tema entra al desplazarse en navegadores compatibles; con movimiento reducido permanece estática.

- **Escena del configurador:** `BuildExperience.jsx` usa una ilustración SVG de placa, procesador y RAM. El desplazamiento ensambla las piezas en escritorio mediante una línea de tiempo CSS. Móvil, movimiento reducido y navegadores sin soporte muestran la composición ensamblada. Su enlace abre `/arma-tu-equipo`; la escena no determina compatibilidad ni disponibilidad.

- **Marca:** `LogoMark.jsx` comparte la T con nodo entre cabecera, entrada y pie. El trazo toma el color primario y el nodo el acento del tema. `frontend/public/favicon.svg` conserva esa geometría en azul y coral. El avatar exportado para redes está en `docs/brand/techstore-avatar.png`, con símbolo blanco y nodo coral sobre fondo oscuro. Al cambiar la geometría, revisar las tres representaciones.

- **Portada:** la escena cinematográfica de audio usa dos renders ilustrativos locales: auriculares completos, vista desplegada y acercamiento. El scroll nativo controla la transición en ventanas amplias; móvil, ventanas bajas y movimiento reducido permiten elegir las tres escenas mediante botones sin fijar la página. Conserva azul/coral y los tokens estacionales, catálogo, guía y TechBot. No asocia el render a un modelo ni inventa prestaciones. El video de fondo existente se conserva. Véase `docs/frontend/hero-cinematic.md`. Destacados sigue mostrando productos disponibles del catálogo.

- **Especificaciones:** editor de pares etiquetados, máximo 20, con foco preservado al añadir o eliminar. La ficha usa `dl`/`dt`/`dd` y permite partir valores largos. No mostrar una sección vacía en productos antiguos.
- **Historial administrativo:** acceso de presentación reservado al owner, filtros etiquetados y registros de solo lectura, con estados de carga, vacío y error recuperable. Los responsables se identifican por ID y los detalles no contienen datos privados de clientes.

- **Botones:** reutilizar `.btn` y variantes existentes como `.btn-primary`, `.btn-secondary`, `.btn-outline` y estilos de eliminación. Usar `button` para acciones y `a` para navegación. Declarar `type="button"` en acciones auxiliares dentro de formularios.
- **Formularios:** cada control conserva su etiqueta asociada, nombre, restricciones y `autocomplete`. Mostrar los errores junto al formulario y un estado ocupado que evite envíos repetidos.
- **Contraseñas:** reutilizar `components/account/PasswordInput.jsx`. Su botón alterna visibilidad sin cambiar el valor ni enviar el formulario; dispone de estado accesible y foco de teclado.
- **Tarjetas y paneles:** usar superficies, bordes y sombras existentes. Reutilizar los contenedores y rejillas del catálogo y de administración antes de crear variantes.
- **Tablas:** mantener encabezados y relaciones semánticas. Usar el contenedor de desplazamiento existente cuando falte espacio; no ocultar acciones esenciales en móvil.
- **Diálogos y carrito:** conservar el manejo de foco, el cierre disponible y el regreso a un control visible. No enfocar controles de un panel que ya se cerró. El checkout limita su altura al viewport dinámico y permite recorrer todo el formulario dentro del diálogo; mientras está abierto, el fondo no se desplaza. Las fotos de la ficha conservan sus colores originales, sin mezclarse con el fondo de los temas oscuros.
- **Iconos:** se usa Remix Icon con archivos locales. Los iconos decorativos deben ocultarse de tecnologías de asistencia; una acción que solo tenga icono necesita nombre accesible. No asumir que cualquier glifo está incluido en la fuente reducida del proyecto.
- **Recursos:** Manrope variable y los iconos se sirven en WOFF2. La foto de referencia principal dispone de variantes WebP locales con `srcset`/`sizes`; una imagen nueva conserva su origen hasta preparar sus variantes. El hero reserva espacio durante la carga y mantiene prioridad alta para la foto. Procedimiento en [rendimiento del frontend](docs/frontend/frontend-performance.md).

## Accesibilidad y adaptación

`frontend/public/css/styles.css` mantiene estilos móviles como base y consultas de ancho al final, antes de impresión y movimiento reducido. Las hojas estacionales asignan tokens y no duplican el layout. Mantener controles accesibles, foco visible, campos editables de al menos 16 px, tablas con desplazamiento y respeto por `prefers-reduced-motion`.

La paleta compartida se aplica en `body`: portada, catálogo, ficha, configurador, cuenta, administración, carrito y diálogos. Usa superficies azul noche, acciones azul eléctrico, coral en precios y violeta moderado en bordes y paneles. Los tokens del hero se capturan en `:root` y se restauran en `.hero-cinema` para conservar su aspecto, incluidos los temas estacionales. Los estados funcionales conservan colores diferenciados y las fotografías mantienen sus colores originales.


Las variantes estacionales conservan superficies oscuras: Halloween usa fondo `#100b1a`, superficies `#191328`, violeta `#a78bfa` y verde ácido `#b7f34a`; Navidad usa fondo `#081610`, superficies `#10241c`, esmeralda `#34a879` y dorado `#d8b66a`. Los botones estacionales usan texto oscuro sobre el color protagonista para mantener contraste. La paleta normal mantiene azul y coral; errores, éxito y advertencias conservan sus colores semánticos. Las hojas estacionales solo asignan tokens, sin duplicar componentes ni consultas de layout.


## HTML semántico

Usar `header` para encabezados de bloques, `hgroup` para título y subtítulo relacionados, `figure`/`figcaption` para ilustraciones con su explicación y `fieldset`/`legend` para grupos de formulario. Las secuencias de elementos usan listas. Los iconos decorativos llevan `aria-hidden="true"` y los enlaces de navegación conservan su comportamiento nativo.

Los `div` se reservan para agrupaciones necesarias: rejillas, alineación de texto e iconos, envoltorios de campos, paneles con desplazamiento y capas decorativas. Dentro de `dl` también pueden agrupar `dt` y `dd`; no sustituirlos por `section`, `article` o párrafos que invaliden la lista de definiciones. Un contenedor neutro justificado es preferible a crear regiones sin significado.
