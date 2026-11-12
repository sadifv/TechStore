# Documentación de TechStore

Guías mantenidas junto al código. Organización revisada el 11 de noviembre de 2026.
Los procedimientos operativos describen cómo actuar; no acreditan por sí solos el
estado de Atlas, el correo, los respaldos o los despliegues de producción.

## Documentos generales

- [Presentación, instalación y comandos](../README.md).
- [Arquitectura](../ARCHITECTURE.md).
- [Seguridad](../SECURITY.md).
- [Sistema de diseño y temas](../DESIGN-SYSTEM.md).
- [Reglas para asistentes](../AGENTS.md).

## Operación

- [Gmail API](operations/gmail-api.md): OAuth, variables del backend y comprobación de entrega.
- [Propietario y administradores](operations/owner-roles.md): permisos y migración inicial explícita.
- [Respaldos y restauración](operations/backup-and-restore.md): ejecución, ensayo aislado y evidencia pendiente.

## Funcionalidades

- [Historial administrativo y especificaciones](features/admin-history-and-specifications.md): permisos, datos registrados, validación e índices.

## Frontend

- [Rendimiento y recursos](frontend/frontend-performance.md): fuentes, imágenes adaptables y carga de colecciones; mediciones locales con contexto.
- [Portada cinematográfica](frontend/hero-cinematic.md): renders ilustrativos, scroll y movimiento reducido.
- [Guía de compra y narración](frontend/guia-compra-audio.md): procedencia de los cinco MP3 y transcripciones.

## Marca

- [Recursos de marca](brand/README.md): avatar, logotipo y favicon.

## Mantenimiento

Actualizar la guía correspondiente cuando cambie su comportamiento y comprobar sus enlaces.
Los planes y especificaciones históricos de implementación se retiraron de esta carpeta;
permanecen disponibles en Git. Los componentes y pruebas documentan el comportamiento
actual. No guardar aquí secretos, registros privados, copias de bases ni datos de clientes.
