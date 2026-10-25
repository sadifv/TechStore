# Guía de trabajo para asistentes

Estas instrucciones se aplican a todo TechStore. Antes de editar, revisa el código implicado, el estado de Git y cualquier instrucción más específica dentro del directorio de trabajo.

## Objetivo y alcance

- Priorizar estabilidad, seguridad y rendimiento respaldado por mediciones. No añadir funcionalidades o servicios externos sin una petición del usuario.
- Mantener React + Vite y JavaScript en el frontend, Express y Mongoose en el backend. No introducir TypeScript ni otra arquitectura como parte de una corrección rutinaria.
- Consultar [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md) y [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md). El código es la evidencia del comportamiento actual; actualizar los documentos si cambia.

## Entorno y comandos

El proyecto usa npm con un `package.json` y un lockfile en cada aplicación. No hay un paquete npm en la raíz. Usar Node.js 22 o 24; CI verifica ambas ramas. Consultar los requisitos `engines` de las dependencias antes de cambiar de runtime.

Ejecutar desde `backend/`:

```sh
npm ci
npm run dev
npm test
npm run test:integration
npm audit --audit-level=high
```

Ejecutar desde `frontend/`:

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
npm audit --audit-level=high
```

La integración requiere `mongod` y crea un replica set temporal aislado. Se puede indicar el ejecutable con `MONGOD_BINARY`. La suite normal omite esos casos. No usar datos de Atlas para pruebas que escriben, cancelan pedidos o eliminan registros.

## Reglas de implementación

- Las solicitudes del frontend al backend deben usar `/api/...` mediante `requestJson` o `adminMutation`. Las imágenes subidas usan `/uploads/...`. Netlify solo reenvía esos prefijos al backend.
- Los enlaces de navegación del panel usan `/admin/...`, sin `/api`. Mantener la regla SPA al final de `frontend/public/_redirects`.
- Conservar las comprobaciones de sesión, rol y MFA en el backend. Ocultar un botón no concede ni revoca permisos.
- Solo `owner` gestiona roles. No crear una API para asignar o retirar `owner`. Consultar `docs/owner-roles.md` para la migración explícita.
- Mantener la atomicidad de inventario y cupones, las claves de idempotencia y los datos históricos de los pedidos. No ejecutar operaciones paralelas sobre una misma sesión de transacción MongoDB.
- WhatsApp prepara el contacto; abrir su enlace no confirma envío del mensaje ni recepción del pago.
- Preferir HTML semántico. Reservar `div` para agrupación o maquetación necesaria. No introducir `innerHTML`, `dangerouslySetInnerHTML`, `outerHTML` o `insertAdjacentHTML`; usar React o métodos DOM seguros.
- Conservar etiquetas, foco, navegación con teclado, mensajes accesibles y la preferencia de movimiento reducido. Reutilizar componentes y tokens existentes.
- Mantener secretos fuera de respuestas, comandos visibles, capturas, archivos de prueba y commits. No leer ni imprimir valores de `.env`; usar `.env.example` para conocer los nombres de configuración.

## Verificación y publicación

- Ejecutar comprobaciones proporcionales al cambio. Para permisos, sesiones, inventario o dependencias del servidor, incluir integración cuando corresponda. Informar fallos, casos omitidos y servicios externos no comprobados.
- Revisar `git diff --check` y el contenido preparado. Preservar cambios ajenos. No incluir `.env`, `node_modules`, `dist`, logs o datos de producción.
- No crear commits ni hacer push sin autorización. Cuando se solicite el flujo de publicación, seguir `.cursor/skills/techstore-release/SKILL.md`: commit en español, push de `developer`, actualización de referencias, avance de `main` solo con `--ff-only`, push y regreso a `developer`.
- No forzar pushes ni usar `reset --hard` para resolver divergencias. Un push no prueba que el despliegue esté activo: comprobar el commit desplegado o indicar que sigue pendiente.
- Cambios de roles, índices, credenciales y datos en producción requieren autorización específica y verificación del destino. Publicar código no autoriza por sí solo una migración.
