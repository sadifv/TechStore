# Administración del catálogo y contenido

## Acceso

El dashboard enlaza a `/admin/contenido`, `/admin/categorias` y `/admin/colecciones`.
Los editores ya no son desplegables dentro del panel general: cada ruta tiene título,
formulario visible y retorno al panel. La navegación administrativa es común también
a usuarios, pedidos, marketing, moderación e historial. En escritorio ocupa la columna
derecha y permanece visible al desplazarse; en móvil/tablet es un desplegable en el
flujo normal, sin cubrir el contenido. La sección activa usa `aria-current="page"`.
El albarán conserva su vista de impresión sin menú lateral.

Owner y admin con sesión vigente y MFA pueden administrar productos, categorías,
colecciones y contenido. El tema global y la gestión de roles mantienen los permisos
anteriores: cambiar contenido no concede acceso a roles ni credenciales.

## Catálogo y mensajes

El panel consulta `/api/admin/products` por páginas (20 por defecto, máximo 50),
con búsqueda literal por nombre, categoría y estado activo/archivado. La búsqueda
no interpreta expresiones regulares. El listado de mensajes usa
`/api/admin/messages`, también con búsqueda y paginación.

«Archivar» retira el producto del catálogo público; «Restaurar» vuelve a hacerlo
visible conservando su identificador, stock, precios y las instantáneas de pedidos.
No se duplica el producto ni se restituyen existencias como parte de esa operación.

## Categorías

La vista inicial muestra el selector y las acciones «Editar categoría» y «Añadir
categoría». Editar abre nombre, imagen y orden; crear abre un formulario vacío.
«Cancelar» descarta el borrador sin solicitudes de escritura. Eliminar se presenta
aparte durante la edición, pide confirmación y guarda solo la eliminación, sin
publicar otros cambios pendientes. Recargar aparece únicamente ante errores;
si hay un borrador, descartarlo requiere confirmación.

«Administrar categorías» permite crear, renombrar, cambiar imagen y ordenar hasta
40 categorías. Incluye Muebles en la configuración inicial. No se puede eliminar
una categoría con productos, incluidos los archivados. Renombrar actualiza los
productos en la misma transacción de auditoría y conserva nombres anteriores como
alias para enlaces del catálogo. Los pedidos mantienen los datos de su compra.
Los destacados siguen las identidades iniciales de Laptops, Audio y Periféricos,
incluso si cambian sus nombres; no se amplían automáticamente a nuevas categorías.

## Colecciones

«Editar colecciones de la portada» permite crear y renombrar grupos, ordenar su
aparición, elegir tema, ocultarlos y eliminarlos. El identificador no cambia al
renombrar. Se admiten hasta veinte grupos y ocho productos por grupo. La búsqueda
de productos se pagina y conserva los seleccionados fuera de la página visible.
Eliminar una colección elimina su pertenencia, nunca los productos.

## Contenido de la tienda

El formulario permite editar correo público, ubicación, horario, Instagram,
descripción del pie, titular y capítulos del hero, sus dos imágenes, textos e imagen
de componentes y encabezado de contacto. Un campo vacío de imagen de componentes
conserva la ilustración actual. Instagram vacío oculta el enlace. Contacto y pie
comparten los datos guardados.

La vista previa es un resumen local de textos e imágenes, no una publicación ni una
réplica animada de toda la página. Los cambios se publican al guardar y los visitantes
los reciben al cargar. Categorías y contenido usan revisión optimista: HTTP 409
indica que otro guardado cambió la versión. Se conserva el borrador; recargar requiere
descartarlo explícitamente. Un fallo de carga inicial no permite guardar valores
por defecto sobre el documento existente.

El hero conserva sus tres escenas, controles y efectos. Las imágenes personalizadas
deben ser coherentes entre sí; las etiquetas de piezas específicas de auriculares
se ocultan cuando se reemplazan los renders. No se cambian automáticamente el vídeo,
los precios, el WhatsApp del checkout ni las credenciales de correo. El correo público
es información de contacto, no una configuración de transporte Gmail.

## Persistencia y seguridad

`StoreContent` y `StoreCategories` son documentos globales versionados;
`StoreCollection` contiene definiciones y `StoreAppearance.collections` conserva
selecciones existentes. Si no existen, se usan los valores actuales sin ejecutar
migraciones en producción. Las colecciones MongoDB se crean al guardar por primera vez.

Todas las escrituras pasan por autorización y auditoría transaccional. No se acepta
HTML, CSS, scripts ni campos arbitrarios. Las imágenes se referencian con HTTPS o
rutas locales de imágenes/subidas; no se descargan desde el servidor. Las respuestas
no incluyen secretos ni configuración de proveedores. El historial registra acciones
y metadatos permitidos, sin copiar los textos de contacto.

Pruebas: validación adversaria, permisos/MFA, conflictos, rollback de auditoría,
paginación y restauración con MongoDB temporal; formularios y navegación con APIs
simuladas. Ninguna prueba escribe en Atlas ni verifica entregas de Gmail.
