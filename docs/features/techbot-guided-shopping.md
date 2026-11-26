# Compra guiada de TechBot

Diseño aprobado: conservar chat libre y añadir selección de categoría, uso y presupuesto dentro del mismo TechBot, solo con sesión. Consultar datos actuales del servidor, mostrar hasta tres opciones, comparar la misma categoría y reutilizar carrito/WhatsApp. No reservar stock ni inventar características. Sin nuevos servicios.

Implementación: endpoint autenticado con los límites de TechBot, validación cerrada de entradas, precios efectivos y stock descontando reservas. Selección determinista y explicaciones basadas en especificaciones; la IA no decide importes ni disponibilidad. La coincidencia de uso es orientativa y no certifica rendimiento o compatibilidad. Si no hay evidencia técnica suficiente, se informa.

Cuando una consulta guiada válida termina sin opciones, MongoDB incrementa un contador acumulado en `guidedshoppingnorecommendations`. Cada documento contiene únicamente una clave de categoría, uso y rango de presupuesto y el total de consultas. Los rangos son menos de 50 USD, 50 a menos de 150, 150 a menos de 500, 500 o más y sin límite. Los valores se toman de los controles de la guía. No se registra el presupuesto exacto, el chat libre, la cuenta ni datos de sesión o de red. Consultas con resultados, inválidas o sin sesión no incrementan el contador. Una incidencia al guardar la métrica no afecta la respuesta de la guía.

Plan: añadir y probar la selección/validación en backend; integrar formulario accesible con edición de respuestas, cancelación de consultas y resultados reutilizando ProductCard/ProductComparison; adaptar estilos mediante tokens existentes; probar acceso, presupuesto, stock, errores, comparación y carrito; ejecutar Security Review y Bugbot. No migraciones ni publicación automática.
