# Sistema de diseño de TechStore

Este documento describe el estilo existente y las convenciones para mantenerlo. La referencia de tokens es `frontend/public/css/styles.css`; `frontend/src/index.css` completa las reglas globales de React. No constituye una biblioteca de componentes independiente.

## Colores

Reutilizar las variables CSS existentes:

- Acción principal: `--color-primary` (`#2563eb`), oscuro `--color-primary-dark` (`#1d4ed8`) y claro `--color-primary-light` (`#3b82f6`).
- Fondo: `--color-background` (`#f8fafc`); superficie: `--color-surface` (`#ffffff`); superficie interactiva: `--color-surface-hover` (`#f1f5f9`).
- Texto: `--color-text` (`#1e293b`); texto secundario: `--color-text-muted` (`#64748b`); secundario oscuro: `--color-secondary` (`#0f172a`).
- Bordes: `--color-border` (`#e2e8f0`).
- Estados: `--color-error` (`#ef4444`), `--color-success` (`#10b981`) y `--color-warning` (`#f59e0b`).

No comunicar un estado solo con color. Acompañar las insignias de texto y comprobar el contraste de cada combinación, tamaño y estado interactivo; la existencia de un token no garantiza su conformidad WCAG.

## Tipografía y medidas

La familia principal es `--font-family`: Inter con alternativas del sistema. La escala existente va de `--font-size-xs` (0.75rem) a `--font-size-3xl` (2rem), pasando por 0.875, 1, 1.125, 1.25 y 1.5rem. Conservar una jerarquía de encabezados coherente.

El espaciado usa `--space-2`, `--space-3`, `--space-4`, `--space-6`, `--space-8`, `--space-12` y `--space-16`: 0.5, 0.75, 1, 1.5, 2, 3 y 4rem. Preferir esos valores al añadir estilos.

Los radios son `--radius-md` (0.5rem), `--radius-lg` (0.75rem), `--radius-xl` (1rem) y `--radius-full` (9999px). Reutilizar `--shadow-card` y `--shadow-hover`. Las transiciones existentes son `--transition-fast` (150ms) y `--transition-normal` (250ms).

## Componentes y comportamiento

- **Botones:** reutilizar `.btn` y variantes existentes como `.btn-primary`, `.btn-secondary`, `.btn-outline` y estilos de eliminación. Usar `button` para acciones y `a` para navegación. Declarar `type="button"` en acciones auxiliares dentro de formularios.
- **Formularios:** cada control conserva su etiqueta asociada, nombre, restricciones y `autocomplete`. Mostrar los errores junto al formulario y un estado ocupado que evite envíos repetidos.
- **Contraseñas:** reutilizar `components/account/PasswordInput.jsx`. Su botón alterna visibilidad sin cambiar el valor ni enviar el formulario; dispone de estado accesible y foco de teclado.
- **Tarjetas y paneles:** usar superficies, bordes y sombras existentes. Reutilizar los contenedores y rejillas del catálogo y de administración antes de crear variantes.
- **Tablas:** mantener encabezados y relaciones semánticas. Usar el contenedor de desplazamiento existente cuando falte espacio; no ocultar acciones esenciales en móvil.
- **Diálogos y carrito:** conservar el manejo de foco, el cierre disponible y el regreso a un control visible. No enfocar controles de un panel que ya se cerró.
- **Iconos:** se usa Remix Icon con archivos locales. Los iconos decorativos deben ocultarse de tecnologías de asistencia; una acción que solo tenga icono necesita nombre accesible. No asumir que cualquier glifo está incluido en la fuente reducida del proyecto.

## Accesibilidad y adaptación

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
