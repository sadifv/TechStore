# Métricas públicas en Vercel

## Integración

El frontend incluye `@vercel/analytics` y `@vercel/speed-insights`. Vite habilita la
integración únicamente cuando compila en modo `production` con
`VERCEL_ENV=production` (variable de sistema de Vercel). Desarrollo, previews y
builds locales o de Netlify no inicializan métricas. No necesita claves ni nuevas
variables `VITE_*` en el panel. Los SDK cargan en un chunk separado.

En el proyecto de Vercel, abrir **Analytics** y **Speed Insights** y habilitar cada
función si el plan lo permite. Revisar los límites y cualquier cargo indicado por
el proveedor antes de aceptar cambios de plan. Después publicar el código mediante
el flujo habitual y verificar el commit desplegado. La instalación local no
acredita que se hayan habilitado las funciones ni que Vercel reciba datos.

## Datos y límites

La lista permitida es portada, catálogo, configurador y legal; fichas con IDs de
producto válidos se agrupan como `/producto/[id]`. Cuenta, administración,
autenticación, recuperación, pedidos, bajas y rutas desconocidas se omiten. No
hay eventos personalizados ni datos de formularios. Los hooks `beforeSend`
eliminan query y fragmento y normalizan la ruta de las métricas de rendimiento.
Por ello no se pueden analizar términos de búsqueda ni productos individuales.

Si el referrer incluye parámetros, fragmentos o una ruta privada/desconocida,
se omite la medición de esa visita. Los referrers externos solo se aceptan en su
origen sin ruta. `Referrer-Policy: no-referrer` impide adjuntar URLs completas en
encabezados de scripts y envíos. Esta política también impide compartir el origen
de navegación con otros sitios; se prioriza privacidad sobre atribución.

Los scripts y endpoints son del mismo origen bajo `/_vercel/`; no se amplía CSP.
Bloqueadores pueden impedir su carga sin bloquear la tienda. Las pruebas de
navegador usan scripts y recepción simulados, nunca envían tráfico de prueba a
Vercel. Los límites del plan siguen aplicando.

La suite dedicada se ejecuta desde `frontend` con
`TEST_VERCEL_MEASUREMENTS=1 npx playwright test tests/browser/measurements.spec.js`
(en PowerShell: `$env:TEST_VERCEL_MEASUREMENTS='1'` antes del comando). Sin ese
indicador se omite, porque el servidor habitual de pruebas no habilita métricas.

## Verificación después de publicar

1. Verificar producción, visitar una página pública y comprobar scripts bajo
   `/_vercel/insights/` y `/_vercel/speed-insights/` sin errores de CSP o HTML SPA.
2. Comprobar que no se inicializan desde una carga directa del panel o la cuenta.
3. Revisar que los payloads públicos no contienen query, fragmentos ni IDs de
   pedidos; comprobar `Referrer-Policy` en la respuesta HTML real.
4. Esperar tráfico real y confirmar datos en ambos paneles. Revisar consumo y
   límites allí; un build correcto no acredita recepción ni mejora el rendimiento.

Fuentes oficiales: [Analytics](https://vercel.com/docs/analytics/package),
[redacción de datos](https://vercel.com/docs/analytics/redacting-sensitive-data) y
[Speed Insights](https://vercel.com/docs/speed-insights/package).
