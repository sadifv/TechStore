# Favoritos y avisos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Listas privadas de favoritos y avisos únicos de disponibilidad con correo confirmado.

**Architecture:** Implementar dos entregables consecutivos, favoritos y avisos. Mantener los límites atómicos en MongoDB, reutilizar sesiones y catálogo y usar una cola específica persistente para avisos. Compartir estado de favoritos en React y reutilizar correo EJS mediante el transporte existente.

**Tech Stack:** JavaScript, React/Vite, Express/Mongoose, crypto, EJS y node:test; sin dependencias adicionales.

**Spec:** `docs/superpowers/specs/2026-11-01-favorites-restock-design.md`, aprobado en el chat.

## Global Constraints

- Favoritos privados, máximo 100, sin duplicados; usuario determinado por sesión validada.
- Invitados admitidos para avisos: consentimiento, confirmación explícita y un aviso por solicitud.
- Tokens aleatorios de 32 bytes: persistir únicamente hashes, nunca tokens originales ni credenciales en logs.
- Confirmación caduca a 24 horas; solicitud de aviso a 90 días; cupo de 20 solicitudes confirmadas pendientes por correo.
- Límites por IP y operación: 10 cada 15 minutos; confirmación reenviable tras 15 minutos sin invalidar avisos confirmados.
- GET no cambia preferencias. Verificar disponibilidad efectiva y archivar solicitudes para productos retirados.
- No publicar ni modificar datos/índices de producción ni enviar correo real durante pruebas.

## Review Focus

- Peticiones simultáneas no superan 100 favoritos ni 20 avisos confirmados por correo.
- Solicitud anónima repetida no revoca ni reinicia una solicitud confirmada.
- Inventario reservado y productos archivados no producen avisos falsos.
- Dos procesos no envían el mismo aviso; resultado incierto no se reintenta automáticamente.
- Token caducado, baja o error de red deja una pantalla recuperable sin falso éxito.

### 1. Favoritos: API y experiencia completa

**Files:** crear `backend/models/FavoriteList.js`, `backend/controllers/favoritesController.js`, `backend/routes/favoriteRoutes.js`, pruebas `favorites.test.js` y `favorites.integration.test.js`; integrar rutas en `backend/routes/apiRoutes.js`. Crear contexto/acciones en `frontend/src/components/favorites/` e integrar `App.jsx`, `ProductCard.jsx`, `ProductPage.jsx` y `ProfilePage.jsx`.

**Interfaces:** GET `/api/favorites` devuelve IDs y productos públicos; PUT/DELETE `/api/favorites/:productId` añaden/quitan idempotentemente. No se admite userId del cliente. Estado React compartido se carga una vez por sesión y se borra al cambiar usuario.

- [x] Escribir pruebas RED de autorización, deduplicación, entrada inválida, producto retirado, lista privada y dos adiciones concurrentes en el límite de 100.
- [x] Implementar una lista única por usuario y actualización condicional atómica con `$addToSet`; validar productos activos al añadir. Listado con consulta por lote, entradas no disponibles removibles y `Cache-Control: no-store`.
- [x] Implementar botón accesible guardar/quitar en catálogo y ficha y lista en Mi cuenta; invitado recibe enlace al login con retorno seguro. Bloquear envíos duplicados y mostrar errores recuperables.
- [x] Ejecutar pruebas unitarias/integración y navegador de cuenta, invitado, errores y eliminación de producto favorito.

### 2. Consentimiento, confirmación y baja de avisos

**Files:** crear `backend/models/RestockAlert.js`, `backend/controllers/restockAlertController.js`, `backend/routes/restockAlertRoutes.js`, `backend/services/restockTokens.js`, plantillas EJS de confirmación/disponibilidad y pruebas correspondientes. Integrar rutas, limitadores y funciones de correo. Crear `RestockRequest.jsx` y `RestockPreferencePage.jsx` e integrar ficha y rutas React.

**Interfaces:** POST `/api/restock-alerts` recibe `{productId,email,consent}` y devuelve respuesta genérica. POST `/api/restock-alerts/confirm` y `/unsubscribe` reciben `{token}`. Páginas frontend `/avisos/confirmar` y `/avisos/baja` muestran confirmación explícita; preferir token en fragmento y retirarlo de la barra tras leerlo. IDs/tokens malformados se rechazan antes de consultar MongoDB.

- [x] Escribir pruebas RED de consentimiento, email, producto agotado efectivo, correo repetido, hash de token, caducidad, GET sin mutación y token consumido.
- [x] Implementar tokens con crypto, hashes y comparaciones seguras; límites persistentes independientes y deduplicación producto/correo. Reservar el cupo de avisos confirmados por correo mediante transacción o documento de control atómico; liberar cupos al finalizar, cancelar o vencer.
- [x] Añadir correo de confirmación al mailer, escapar contenido con EJS y construir enlaces únicamente desde configuración. Reenvíos respetan espera; avisos activos no se reemplazan por solicitudes anónimas. Respuestas públicas nunca afirman entrega.
- [x] Implementar formulario con consentimiento obligatorio y páginas de confirmación/baja accesibles, estados ocupado/error/éxito y reintentos.
- [x] Ejecutar pruebas de plantilla y ciclo completo con transporte simulado y MongoDB temporal.

### 3. Cola de avisos y cierre

**Files:** crear `backend/services/restockQueue.js` y pruebas unitarias/integración. Integrar arranque en `backend/server.js`, limpieza en mantenimiento si procede y suites en `backend/scripts/runIntegrationTests.js`; actualizar arquitectura, seguridad y sistema de diseño.

**Interfaces:** `startRestockQueue()` revisa al arrancar y cada 60 segundos; `processRestockAlerts()` procesa un lote acotado de solicitudes confirmadas no vencidas con reclamaciones atómicas. Consulta stock y reservas en lote para candidatos; revalida antes de enviar.

- [x] Escribir pruebas RED para sin stock, stock reservado, producto archivado, dos workers, baja antes de envío, envío aceptado, error ambiguo y reinicio con envío interrumpido.
- [x] Implementar estados `pending_confirmation`, `waiting`, `sending`, `sent`, `cancelled`, `expired`, `delivery_unknown`, con identificador de reclamación y caducidad. No reintentar envíos ambiguos. Generar token de baja al preparar el aviso y guardar solo hash antes de enviar.
- [x] En finalización/cancelación/vencimiento, liberar cupo y eliminar datos personales de documentos terminales con reintento de limpieza. No depender solo de TTL para liberar cupos.
- [x] Probar navegador móvil/escritorio, formularios y enlaces con API aislada; ejecutar backend `npm test` y `npm run test:integration`; frontend `npm test`, lint y build; revisar `git diff --check`.
- [x] Revisión independiente de seguridad y concurrencia; corregir hallazgos demostrados y repetir las comprobaciones afectadas. Entregar en developer, sin commit ni despliegue.
