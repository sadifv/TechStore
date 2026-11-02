# Organización mobile first de styles.css

**Objetivo:** ordenar todo el archivo por componentes, usar móvil como base y reunir las media queries al final con ampliaciones min-width.

**Restricciones:** conservar paleta, tipografía, DOM, lógica y controles; preservar impresión, movimiento reducido y estados interactivos; mantener todos los cambios locales anteriores; no publicar ni crear commits.

- [x] Registrar el estado visual previo en pantallas pequeñas y grandes, con cuenta, formularios, panel y checkout.
- [x] Revisar reglas y cascada; agrupar por responsabilidad, retirar repeticiones y convertir las variaciones por ancho a una base móvil con ampliaciones progresivas al final.
- [x] Mantener impresión y movimiento reducido en bloques propios al final. Documentar los puntos de adaptación usados por los componentes existentes.
- [x] Comparar la presentación, ejecutar pruebas/lint/build, recorrer estados con API simulada y revisar el diff.

Verificación: lint sin errores, 26 pruebas correctas, build correcto y diff --check limpio. Navegador local con API simulada: 57 vistas/estados a 320, 390 y 1440px, más inicio a 320, 520, 521, 600, 601, 760, 761, 767, 768, 900, 901, 1000, 1001, 1024, 1200 y 1201px, sin desbordamiento horizontal. Navegación con nombre largo comprobada a 901px. Revisión estática independiente de navegación, diálogos, impresión y movimiento reducido sin hallazgos funcionales importantes. No se publicaron cambios.
