# Frontend de TechStore en Vercel

## Alcance

React + Vite se publica en Vercel; Express permanece en Render y los datos en MongoDB Atlas.
No se copian bases ni se introducen funciones serverless. Netlify sigue siendo compatible
hasta completar la transición. Preparar estos archivos no acredita un despliegue activo.

## Configuración del proyecto

Importar únicamente el frontend del repositorio GitHub, con rama de producción main:

- Root Directory: frontend.
- Framework: Vite.
- Install Command: npm ci.
- Build Command: npm run build.
- Output Directory: dist.
- Runtime de build: Node.js 24, o 22.13+ compatible con las dependencias.

El archivo frontend/vercel.json debe existir en el commit que Vercel compila.
La configuración reside dentro del Root Directory; no hay que desplegar Express en Vercel.
No copiar el .env del backend al proyecto frontend.

## Variables y reglas

Dejar VITE_API_BASE_URL sin configurar o vacío: el navegador debe llamar al mismo origen.
BACKEND_PROXY_TARGET solo pertenece al desarrollo local de Vite. NETLIFY_BACKEND_URL
solo configura Netlify y no cambia el destino de Vercel. No hace falta añadir ninguna
de estas variables al dashboard de Vercel con la configuración actual.

El destino de Render está declarado explícitamente en frontend/vercel.json. Al cambiar
el backend, actualizar sus dos reglas y mantener coherencia con public/_redirects;
las pruebas comparan ambas configuraciones para detectar diferencias.

Las reglas reenvían /api y /uploads conservando los prefijos. El fallback final entrega
index.html para las rutas de React. Se conservan los alias de imágenes antiguas y las
seis cabeceras de seguridad de Netlify, incluida la CSP sin scripts inline. Las respuestas
API tienen no-store y la caché de rewrites desactivada; no activar caché compartida de
sesiones, administración, carrito ni pedidos. Vercel ignora los archivos _headers y
_redirects de Netlify; las reglas equivalentes están en vercel.json.

## Cambiar el dominio en Render

Cuando Vercel confirme la URL exacta de producción, verificarla antes de editar Render:

1. Añadir ese origen HTTPS exacto a ALLOWED_ORIGINS. Durante la transición conservar
   también el origen anterior, separados por comas. No permitir todos los dominios vercel.app.
2. Al elegir el nuevo sitio como público, establecer APP_URL y FRONTEND_URL a ese origen.
   Recuperación, activación, campañas y avisos deben enlazar al sitio público correcto.
3. Mantener API_URL apuntando a Render. Mantener MongoDB, SESSION_SECRET, OAuth de Gmail
   y los demás secretos existentes. No aumentar TRUST_PROXY_HOPS sin comprobar la cadena
   de proxies y la IP que Express reconoce: confiar de más afecta los límites por IP.
4. Guardar y esperar el despliegue del backend antes de probar operaciones con sesión.

El acceso a la tienda permanece bajo el dominio del frontend por el proxy; no configurar
una llamada directa desde vercel.app a onrender.com como atajo para las sesiones.
Los previews no deben tratarse como entornos de pruebas de escritura sobre producción.

## Validación y reversión

Las pruebas locales verifican configuración y compilación; no simulan la infraestructura
de Vercel ni prueban cookies reales a través de Render.

Después del despliegue, comprobar en navegador: catálogo y recarga de rutas profundas,
imágenes locales y /uploads, login/logout, MFA, persistencia de cookie Secure/HttpOnly,
cuenta y panel. Verificar que llamadas API no reciben HTML del fallback ni respuestas
privadas cacheadas. Comprobar límites por IP y conservar los permisos del servidor.
Las pruebas que crean pedidos, reservan stock o envían correo requieren autorización
específica y datos propios; no ejecutarlas contra clientes reales.

Mantener Netlify hasta aceptar el nuevo sitio. Si hay problemas, volver a sus URLs
públicas en Render y a su dominio anterior sin tocar Atlas ni rotar SESSION_SECRET.
Un nuevo dominio puede requerir iniciar sesión de nuevo porque las cookies son por host.
No retirar el origen anterior hasta comprobar que no se necesita para la reversión.

## Fuentes oficiales

- [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite).
- [Rewrites y proxy externo](https://vercel.com/docs/routing/rewrites).
- [Configuración JSON](https://vercel.com/docs/project-configuration/vercel-json).
- [Caché de orígenes externos](https://vercel.com/changelog/vercels-cdn-now-respects-cache-control-headers-from-external-origins-by-default).
