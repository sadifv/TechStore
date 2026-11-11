# Sistema de diseño de TechStore

Este documento describe el estilo existente y las convenciones para mantenerlo. Los estilos visuales y los tokens se mantienen en `frontend/public/css/styles.css`; `frontend/src/index.css` conserva únicamente las reglas globales de montaje de React. No constituye una biblioteca de componentes independiente.

## Colores

Los temas estacionales están en `frontend/public/css/halloween.css` y `frontend/public/css/christmas.css`. Son capas sobre `styles.css`: requieren cargar su hoja después de la base y establecer `data-theme="halloween"` o `data-theme="christmas"` en `html`. Sin ese atributo no modifican el tema normal. Conservan layout, tipografía y estados funcionales; no incluyen animación decorativa. El owner con MFA selecciona el tema desde «Estilo de la tienda» en el dashboard. Se guarda en StoreAppearance (documento global); GET /api/store/appearance devuelve solo el tema y PATCH /api/admin/appearance valida rol, MFA y una lista cerrada. Los visitantes reciben la selección al cargar la página; no hay actualización automática de pestañas ya abiertas.

Reutilizar las variables CSS existentes:

- Acción principal: `--color-primary` (`#2563eb`), oscuro `--color-primary-dark` (`#1d4ed8`) y claro `--color-primary-light` (`#3b82f6`).
- Fondo: `--color-background` (`#f8fafc`); superficie: `--color-surface` (`#ffffff`); superficie interactiva: `--color-surface-hover` (`#f1f5f9`).
- Texto: `--color-text` (`#1e293b`); texto secundario: `--color-text-muted` (`#64748b`); secundario oscuro: `--color-secondary` (`#0f172a`).
- Bordes: `--color-border` (`#e2e8f0`).
- Estados: `--color-error` (`#ef4444`), `--color-success` (`#10b981`) y `--color-warning` (`#f59e0b`).

No comunicar un estado solo con color. Acompañar las insignias de texto y comprobar el contraste de cada combinación, tamaño y estado interactivo; la existencia de un token no garantiza su conformidad WCAG.

## Tipografía y medidas

La familia principal es `--font-family`: Manrope variable (200–800), alojada en `/fonts/manrope-variable.ttf`, con `font-display: swap` y alternativas del sistema. Su licencia está en `frontend/public/fonts/MANROPE-OFL.txt`. No depende de Google Fonts en tiempo de ejecución. La escala existente va de `--font-size-xs` (0.75rem) a `--font-size-3xl` (2rem), pasando por 0.875, 1, 1.125, 1.25 y 1.5rem. Los títulos de portada/ficha tienen escalas adaptables propias. Conservar una jerarquía de encabezados coherente.

El espaciado usa `--space-2`, `--space-3`, `--space-4`, `--space-6`, `--space-8`, `--space-12` y `--space-16`: 0.5, 0.75, 1, 1.5, 2, 3 y 4rem. Preferir esos valores al añadir estilos.

Los radios son `--radius-md` (0.5rem), `--radius-lg` (0.75rem), `--radius-xl` (1rem) y `--radius-full` (9999px). Reutilizar `--shadow-card` y `--shadow-hover`. Las transiciones existentes son `--transition-fast` (150ms) y `--transition-normal` (250ms).

La actualización visual conserva los colores y prioriza bordes suaves, superficies limpias y sombras discretas. Usa controles de referencia de 48px (`--control-height`), títulos con peso 800 y precios tabulares. Inicio, catálogo y ficha comparten imágenes contenidas sin recorte, alineación izquierda y acciones azules. Cuenta, autenticación, carrito y administración reutilizan este ritmo. Las tablas conservan su contenedor de desplazamiento; no se ocultan columnas para que quepan en móvil.

En móvil, los campos editables mantienen al menos 16px de texto, incluidos MFA, direcciones y formularios administrativos. Evitar reducirlos por densidad visual.

## Componentes y comportamiento

- **Cómo comprar:** el acceso del hero abre una guía animada de cuatro pasos en un diálogo nativo. Las escenas usan datos ficticios y los nombres del flujo real; no llaman APIs, crean pedidos, modifican el carrito ni abren WhatsApp. La guía abre pausada: solo se anima al pulsar «Reproducir» y se detiene al ocultar la pestaña. El contenido central desplaza independientemente del encabezado y de los controles, que permanecen visibles. En móvil, el título y la explicación preceden a la escena; audio y reproducción comparten una fila separada de las instrucciones. Los pasos manuales y el movimiento reducido son estáticos. Escape y el botón de cierre devuelven el foco al acceso. La narración opcional «Escuchar este paso» reproduce cuatro MP3 locales en español ecuatoriano desde `/audio/como-comprar/`, sin síntesis del navegador ni llamadas a proveedores de voz durante el uso. Cada archivo se solicita únicamente al escuchar su paso. Pausa la animación y se detiene al cambiar de paso, reproducir la animación, ocultar la pestaña o cerrar. Si el audio falla, permite reintentar y mantiene el texto y la navegación. La procedencia y transcripción se documentan en `docs/guia-compra-audio.md`. Los tres temas comparten tokens y contenido. El final aclara que abrir WhatsApp no envía el mensaje ni confirma el pago.

- **TechBot sin sesión:** presenta una conversación de ejemplo que termina preguntando por uso y presupuesto, sin recomendaciones ni fichas de producto anticipadas. El chat real y su historial requieren sesión. El registro y el login conservan el retorno a la sección.

- **TechBot con sesión:** las sugerencias iniciales rellenan el campo sin enviar. Solo el historial desplaza sus mensajes; el compositor queda fuera de ese contenedor. Las fichas corresponden a nombres mencionados en la respuesta y a IDs resueltos por el servidor; al recuperar el historial se consultan de nuevo precio, reservas y estado de archivado.

- **Contacto:** WhatsApp es el canal principal, seguido por correo, ubicación y horario. El formulario identifica su finalidad y el correo como canal de respuesta. Una línea con el acento del tema entra al desplazarse en navegadores compatibles; con movimiento reducido permanece estática.

- **Escena del configurador:** `BuildExperience.jsx` usa una ilustración SVG de placa, procesador y RAM. El desplazamiento ensambla las piezas en escritorio mediante una línea de tiempo CSS. Móvil, movimiento reducido y navegadores sin soporte muestran la composición ensamblada. Su enlace abre `/arma-tu-equipo`; la escena no determina compatibilidad ni disponibilidad.

- **Marca:** `LogoMark.jsx` comparte la T con nodo entre cabecera, entrada y pie. El trazo toma el color primario y el nodo el acento del tema. `frontend/public/favicon.svg` conserva esa geometría en azul y coral. El avatar exportado para redes está en `docs/brand/techstore-avatar.png`, con símbolo blanco y nodo coral sobre fondo oscuro. Al cambiar la geometría, revisar las tres representaciones.

- **Portada:** Destacados muestra hasta cuatro productos disponibles de Laptops, Audio y Periféricos. El hero enlaza a la ficha de un destacado con imagen. Las categorías usan una imagen del catálogo cuando existe y una tarjeta de texto cuando no hay imagen adecuada.

- **Especificaciones:** editor de pares etiquetados, máximo 20, con foco preservado al añadir o eliminar. La ficha usa `dl`/`dt`/`dd` y permite partir valores largos. No mostrar una sección vacía en productos antiguos.
- **Historial administrativo:** acceso de presentación reservado al owner, filtros etiquetados y registros de solo lectura, con estados de carga, vacío y error recuperable. Los responsables se identifican por ID y los detalles no contienen datos privados de clientes.

- **Botones:** reutilizar `.btn` y variantes existentes como `.btn-primary`, `.btn-secondary`, `.btn-outline` y estilos de eliminación. Usar `button` para acciones y `a` para navegación. Declarar `type="button"` en acciones auxiliares dentro de formularios.
- **Formularios:** cada control conserva su etiqueta asociada, nombre, restricciones y `autocomplete`. Mostrar los errores junto al formulario y un estado ocupado que evite envíos repetidos.
- **Contraseñas:** reutilizar `components/account/PasswordInput.jsx`. Su botón alterna visibilidad sin cambiar el valor ni enviar el formulario; dispone de estado accesible y foco de teclado.
- **Tarjetas y paneles:** usar superficies, bordes y sombras existentes. Reutilizar los contenedores y rejillas del catálogo y de administración antes de crear variantes.
- **Tablas:** mantener encabezados y relaciones semánticas. Usar el contenedor de desplazamiento existente cuando falte espacio; no ocultar acciones esenciales en móvil.
- **Diálogos y carrito:** conservar el manejo de foco, el cierre disponible y el regreso a un control visible. No enfocar controles de un panel que ya se cerró.
- **Iconos:** se usa Remix Icon con archivos locales. Los iconos decorativos deben ocultarse de tecnologías de asistencia; una acción que solo tenga icono necesita nombre accesible. No asumir que cualquier glifo está incluido en la fuente reducida del proyecto.

## Accesibilidad y adaptación

`frontend/public/css/styles.css` se organiza por componentes con estilos móviles como base. Todas las consultas de ancho se reúnen al final usando `min-width`, en orden ascendente: 521, 601, 761, 768, 901, 1001 y 1201px. Los umbrales responden a los componentes existentes; no crear otro sin comprobar dónde falta espacio. Después de las adaptaciones por ancho quedan los bloques de impresión y `prefers-reduced-motion`. Mantener los campos editables en 16px como mínimo y comprobar la cascada al mover reglas entre secciones.

`OrderTracking` comparte el seguimiento entre Mi cuenta y confirmación del checkout. Separa pago y envío, muestra cronología con fechas y usa confirmación en línea para cancelar. Mantiene el foco en controles visibles, anuncia resultados y errores, y deshabilita acciones durante solicitudes. La actualización es manual; un error permite reintentar sin presentar éxito prematuro.

Usar `header`, `nav`, `main`, `section`, `article`, `footer`, listas y encabezados según su función. Reservar `div` para agrupación o layout necesario. Conservar el enlace de salto al contenido principal.

Toda acción debe poder operarse con teclado y mostrar un indicador de foco. Los mensajes dinámicos deben anunciarse con el mecanismo apropiado (`role="status"`, `role="alert"` o región viva), sin exponer datos sensibles. Respetar `prefers-reduced-motion` y no depender de animación para comprender el estado.

Revisar móvil, escritorio, zoom, textos largos y estados vacío, cargando, error y éxito. La adaptación debe responder al espacio disponible y mantener visibles las etiquetas y las acciones.

## Cambios al diseño

Las reseñas muestran nota en texto, compra verificada y estado de la propia reseña. El formulario bloquea edición durante envío/recarga para evitar sobrescribir borradores y ofrece reintento tras error. Los selectores tienen etiquetas separadas de sus opciones. El panel de moderación confirma el texto y la decisión, dirige foco a la confirmación y vuelve a un control visible al finalizar.

La libreta se gestiona en Mi cuenta, con confirmación para eliminar y foco devuelto al título tras cambios. El checkout distingue sin dirección, guardada y puntual; solo la opción elegida forma parte del payload. Los formularios usan etiquetas/autocomplete y límites consistentes con el servidor. Los pedidos muestran una copia explícita o «Entrega por coordinar con la tienda», sin inventar direcciones a partir de defaults legacy.

Los botones de favoritos usan texto y `aria-pressed` para expresar si un producto está guardado, conservan estados ocupado/error y ofrecen reintento. Al retirar una tarjeta enfocada desde Mi cuenta, el foco vuelve al título de favoritos. Los productos retirados se muestran como no disponibles con una acción para quitarlos.

Los formularios de disponibilidad usan correo etiquetado y casilla obligatoria de consentimiento sin preselección. Las páginas de confirmación y baja requieren acción explícita, anuncian errores/resultados y permiten volver al catálogo. No comunicar una reserva de inventario ni una entrega de correo sin evidencia.

Antes de introducir otro color, tamaño o componente, comprobar si existe un token o patrón equivalente. Si se añade una convención reutilizable, definirla en los estilos compartidos y documentarla aquí. Validar el resultado en el navegador: una compilación correcta no demuestra que el diseño sea legible ni accesible.
