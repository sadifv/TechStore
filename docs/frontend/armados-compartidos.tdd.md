# Pruebas de armados compartidos

El recorrido aprobado parte de un armado guardado o compartido. Si el catálogo cambia, quien abre el armado puede identificar la pieza afectada y volver al selector de su tipo.

- RED. `npx playwright test interactive-shopping.spec.js --grep "pieza retirada"` ejecutó la prueba de Chromium y falló porque el resumen no mostraba el procesador retirado.
- GREEN. `npx playwright test interactive-shopping.spec.js profile.spec.js` comprobó que el resumen muestra el procesador, que el botón lleva el foco al selector y que el reemplazo conserva la placa y la memoria.
- El historial de Mi cuenta compara precios y disponibilidad con el momento en que se guardó el armado. En un enlace nuevo, el precio de referencia viaja en el propio enlace y el subtotal usa los precios vigentes.
- Los enlaces antiguos sin el tipo de una pieza adicional retirada permiten quitarla. Los enlaces nuevos conservan ese tipo para llevar al selector cuando existen alternativas.

La comprobación de interfaz se hizo en Chromium. Este recorrido no tiene un porcentaje de cobertura instrumentado. Las pruebas HTTP de los armados usan una instancia temporal de MongoDB. La implementación quedó en el árbol local.
