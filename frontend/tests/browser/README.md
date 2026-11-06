# Pruebas de navegador

Desde `frontend/`, con Node.js 22 o 24:

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

En Linux puede ser necesario `npx playwright install --with-deps chromium`.
`npm run test:browser:headed` muestra el navegador. El puerto local 4175 debe estar libre.

Playwright arranca su propio Vite sin leer archivos `.env`, sin proxy al backend y sin reutilizar un servidor existente. Las fixtures son ficticias (`example.invalid`). Se simulan explícitamente todas las APIs y se bloquean destinos externos, incluidos WhatsApp y correo. No requiere MongoDB ni sesiones reales. Cada caso tiene un contexto independiente y las APIs desconocidas hacen fallar el caso.

La suite verifica presentación, navegación, recuperación de errores y contratos de solicitudes. La visibilidad del historial para owner no demuestra autorización del servidor; permisos, MFA, persistencia y atomicidad se verifican mediante las suites HTTP/backend e integración con MongoDB temporal aislado.

Las capturas y trazas de fallos se guardan en `test-results/` (ignorado por Git). Para abrir una traza: `npx playwright show-trace test-results/<caso>/trace.zip`. GitHub Actions ejecuta Chromium solo en un trabajo Node.js 24 y conserva artefactos de fallos durante siete días. `npm test` continúa ejecutando únicamente las pruebas `node:test`.
