# Diseño: remediación integral de la auditoría de TechStore

## Objetivo y alcance

Corregir los once hallazgos de la auditoría sobre developer, partiendo de 07a2f7b, en la secuencia aprobada por el usuario: MFA y revocación; inventario y archivado; precios e historial; índices; accesibilidad y robustez del frontend.

Conservar React/Vite/JavaScript, Express, sesiones MongoDB y checkout por WhatsApp. No incorporar JWT, servicios externos ni dependencias nuevas de producción. Trabajar en developer conservando el cambio de formato existente de CatalogPage.jsx. La publicación y los cambios de índices en Atlas quedan para una acción de release/aplicación explícita posterior.

## Enfoque elegido

Usar sesiones con evidencia MFA, transacciones MongoDB para las unidades de negocio que cruzan documentos y archivado de productos. Es una corrección sobre los flujos existentes.

Se descarta limitarse a más bloques catch: una terminación del proceso no ejecuta compensaciones. Un ledger idempotente por producto también permitiría recuperar operaciones, pero implica otro protocolo de movimientos y reconciliación. Las transacciones existentes en MongoDB/Mongoose ofrecen una garantía más directa para este caso.

## 1. Identidad y MFA

### Sesión autenticada

Guardar authLevel = mfa únicamente al terminar enrolamiento, verificación TOTP o recuperación con éxito, después de regenerar la sesión. El login de cliente permanece con autenticación por contraseña.

requireAdmin seguirá consultando el usuario y authVersion actuales, y además exigirá evidencia MFA de la sesión. Las sesiones anteriores que no tengan esta evidencia recibirán una respuesta JSON de acceso denegado y deberán iniciar sesión de nuevo. Una promoción de user a admin no debe promover la fuerza de autenticación de su sesión.

El restablecimiento administrativo de MFA debe revocar las sesiones mediante authVersion. No se añadirá una interfaz nueva para restablecer MFA en este trabajo.

### Preautenticación

Guardar userId, authVersion, mode y expiresAt al validar contraseña. requireAdminMfaPreauth comprobará usuario actual, rol, versión y expiración; eliminará estado pendiente inválido y devolverá 401. Las actualizaciones atómicas que activan MFA, aceptan TOTP o consumen recuperación incluirán la misma authVersion en su filtro para cerrar la carrera entre comprobación y escritura.

Conservar límite de diez minutos, códigos de recuperación de un uso, prevención de replay TOTP y exclusión de campos sensibles. Al reingresar a enrolamiento por recuperación tras rotación de clave se creará un nuevo desafío con versión actual verificada.

### Identidad opcional en checkout

Crear middleware reutilizable para rutas que admiten invitado y usuario: sin session.user continúa como invitado; con session.user revalida existencia y authVersion. Una identidad revocada recibe 401 y no se usa para crear ni consultar pedidos. Aplicarlo a checkout y a la confirmación de pedido. Mantener el acceso de invitado por checkoutKey y no exponer pedidos ajenos.

No registrar claves, contraseñas, TOTP, códigos de recuperación ni detalles personales durante estos flujos.

## 2. Inventario, transacciones y bloqueos

### Unidad de checkout

Extraer el caso de uso de creación para que todas las escrituras necesarias compartan una ClientSession de Mongoose: creación de pedido, descuento condicional de stock, marca inventoryReserved, reserva de cupón, finalización de reservas del carrito y checkoutState listo.

Las lecturas que determinan disponibilidad y descuento pertenecerán a la misma transacción cuando sean necesarias para su consistencia. La transacción tendrá operaciones secuenciales sobre su sesión; no ejecutará Promise.all sobre la misma sesión.

Conservar validación de productos/cantidades, reservas ajenas, cantidades propias, precio autorizado por servidor y el índice único checkoutKey. El reintento con misma clave/payload devuelve el mismo resultado; un payload distinto devuelve 409. Mantener compatibilidad de pedidos existentes y claves opcionales para clientes antiguos.

La transacción abortada no deja pedido parcial ni descuento de stock/cupón. No se usará compensación posterior para escrituras que ya fueron abortadas. La generación del enlace y la respuesta se harán tras confirmar el commit; si se pierde la respuesta, el reintento recuperará el pedido persistido.

Si el servidor Mongo no soporta transacciones, no habrá fallback silencioso a escrituras no atómicas: se devolverá error sin crear un pedido incompleto.

### Coordinación con el carrito

Los bloqueos actuales viven en Product; su heartbeat puede escribir el mismo documento que una transacción de checkout. Separar el lease de los datos de inventario reutilizando maintenance_locks con nombres product-reservation:<id>, token de dueño y vencimiento. Mantener adquisición ordenada para varios productos, espera acotada y liberación condicionada al token.

Las rutas de carrito y las operaciones de checkout/restauración usarán el mismo protocolo. La existencia/estado del producto se comprobará de forma separada: no depender de que el lease sea un documento Product. La pérdida de lease debe impedir continuar mutaciones como si se conservara exclusividad; las actualizaciones condicionales y transacciones siguen siendo la garantía de stock.

Los campos antiguos de lease de Product podrán permanecer sin uso por compatibilidad; no se limpiarán datos de producción automáticamente.

### Cancelación y confirmación de pago

Aplicar atomicidad al cambio de estado y los efectos de inventario/cupón correspondientes, para no desplazar la inconsistencia al flujo inverso. Conservar la exclusión entre confirmar pago y cancelar mediante predicados de estado. Los reintentos no duplican incrementos ni consumos.

Mantener reconciliación del carrito condicionada a su snapshot; nunca borrar cambios hechos por el cliente después de crear el pedido. Adaptar la compatibilidad con pedidos antiguos que usaban las marcas de restitución, sin restituir dos veces unidades ya devueltas.

Las órdenes antiguas que quedaron creating sin marcas no permiten inferir automáticamente si el descuento ocurrió: no se modificarán stocks históricos por suposiciones. Se podrá informar ese estado para revisión operativa si aparece.

## 3. Archivado de productos

Añadir archivedAt opcional. La acción administrativa actual de eliminar pasará a archivar; mantendrá su endpoint/respuesta compatible y la interfaz comunicará que archiva.

Excluir archivados de catálogo, detalle público, destacados, ofertas, TechBot y nuevas compras/reservas. El carrito puede seguir mostrando una referencia archivada como no disponible para que sea eliminable. En el panel, la lista normal no debe ofrecer archivados como activos.

Las órdenes e impresiones conservarán el documento referenciado y su snapshot. Cancelar pedidos con productos archivados seguirá restaurando el inventario y el cupón. Para referencias ya borradas físicamente, no recrear un producto inventado: finalizar la reconciliación con un evento explícito de producto ausente, restaurar los otros artículos y liberar cupón una sola vez.

No se añade una pantalla de restauración o purga de productos archivados.

## 4. Precio efectivo e historial

Definir un servicio común que calcule el precio efectivo con un instante de referencia. Si flashSale está vencida, se usa originalPrice cuando existe, aunque el cron no haya ejecutado la limpieza. El checkout, respuestas de catálogo/carrito y contexto de TechBot compartirán esa regla. El cron conservará la limpieza persistente.

El precio de un pedido ya creado seguirá siendo el snapshot aceptado; el vencimiento posterior de una oferta no modifica pedidos existentes. Las validaciones de stock y cupones conservan sus reglas.

Perfil, detalle de pedido e impresión preferirán productName y price del pedido. Solo para pedidos históricos sin snapshot usarán el producto actual como fallback.

La respuesta de oferta del inicio incluirá la descripción necesaria para el componente; los destacados conservarán una proyección acotada.

## 5. Índices

Preparar migración idempotente con vista previa por defecto y aplicación mediante --apply:

- products: createdAt descendente para recientes.
- products: flashSale, flashSaleEndsAt para próxima oferta y mantenimiento.
- reservations: product, status, expiresAt para disponibilidad.

Considerar archivedAt en el diseño final de las consultas y comparar el plan antes de fijar las claves definitivas; evitar índices redundantes o que no ayuden a los filtros reales. No crear combinaciones de categoría/precio sin medir.

La migración no eliminará índices ajenos ni datos. Se validará con explain sobre la base temporal y podrá consultarse metadata de Atlas en lectura. La creación de índices de producción no forma parte de la ejecución local.

## 6. Semántica, accesibilidad y robustez

- Añadir label persistente y autoComplete=email al newsletter.
- Sustituir nav de controles de cantidad por fieldset/legend o grupo con nombre; conservar estilos y botones.
- Representar colección de pedidos como lista y cada cabecera con un heading real; retirar hgroup inválido.
- Mantener los div de layout, scroll de tablas, overlay y root de React que tengan justificación.
- Mantener JSX escapado para datos dinámicos; no introducir sinks HTML inseguros ni manipulación manual de nodos controlados por React.
- Validar la decodificación de segmentos; una URL mal codificada lleva a una página 404.
- Añadir Error Boundary para errores de render/carga de chunks con opción de recargar o volver al inicio. El boundary debe envolver el componente que puede lanzar el error, no situarse dentro de él.
- Conservar etiquetas, retorno de foco y reducción de movimiento actuales.

## 7. Verificación y criterios de aceptación

### Autenticación

Pruebas de rechazo de sesión admin legacy y sesión de cliente promovido, éxito después de MFA, revocación por authVersion, reset durante enrolamiento/verificación y rechazo de checkout/confirmación con identidad revocada. Invitado válido conserva checkout y acceso mediante su clave.

### Inventario real

Hay mongod instalado en esta máquina. Usar un replica set local temporal con un dbPath nuevo dentro del directorio temporal y un puerto libre, sin conectar ni modificar la instancia de desarrollo existente o Atlas.

Probar commit de checkout, error inyectado entre escrituras, rollback de cupón/reserva/pedido/stock, concurrencia por última unidad, reintento con misma clave, carrera pago/cancelación, cancelación con archivado y referencia ausente. El bootstrap de la suite garantizará limpieza de procesos creados y conexiones incluso ante error; nunca borrará una ruta que no sea su dbPath temporal validado.

Adaptar mocks existentes para los contratos nuevos sin que sustituyan la comprobación transaccional con Mongo real.

### Precios y frontend

Probar oferta vencida sin cron, vigente y ausente; snapshot histórico después de renombrado/archivado; descripción de oferta; URL malformada; recuperación del boundary. Para HTML/CSS reversible, usar revisión de estructura y las comprobaciones existentes antes que tests que solo reflejen texto fuente.

Ejecutar suites backend/frontend, ESLint y compilación cuando se integre el conjunto. Revisar diff y que no aparezcan secretos, dependencias de producción nuevas o cambios ajenos. Conservar CatalogPage.jsx. Informar por separado lo validado en navegador y lo que requiera cuenta real/tecnología asistiva.

## Fuera de alcance

Cambiar a JWT, migrar a TypeScript, añadir microservicios, proveedores de autenticación, pagos automáticos, servicios externos, alterar datos históricos de producción sin diagnóstico, cambiar secretos/permisos de Atlas/Render/Netlify, hacer commit/push/promoción o desplegar. Esas acciones requieren su solicitud específica.

## Entrega esperada

Cambios revisables en developer, pruebas y evidencia de transacciones en Mongo local, migración de índices lista para revisar/aplicar, documentación operativa mínima de las nuevas invariantes y resumen de limitaciones. La implementación se realizará en la misma sesión y no se publicará automáticamente.
