# Visual Refresh Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aplicar la dirección visual aprobada al frontend completo conservando flujos y colores.

**Architecture:** Componentes React actuales y CSS compartido, con el rediseño integrado en styles.css, conforme a la indicación final del usuario. Manrope local y ajustes semánticos de presentación en inicio y ficha.

**Tech Stack:** React, Vite, JavaScript y CSS.

**Spec:** docs/superpowers/specs/2026-11-02-visual-refresh-design.md

## Global Constraints

Paleta actual, fuente local, sin APIs nuevas, sin datos de muestra en producto, sin cambios comerciales. Trabajar en developer siguiendo la preferencia existente del usuario; no commit ni publicación.

## Review Focus

Texto largo y controles de compra en 390 px; foco y teclado en menú/carrito/checkout; estado agotado y errores; tablas administrativas con acciones visibles; MFA y contraseñas sin controles ocultos por CSS.

## Tareas

- [x] 1. Incorporar fuente local/licencia, estilos centralizados en styles.css y carga desde index.html. Adaptar inicio, tarjetas y ficha al prototipo aprobado.
- [x] 2. Extender tokens de presentación a catálogo, TechBot, contacto, boletín, cuenta, autenticación, carrito, checkout y panel; conservar componentes y eventos existentes.
- [x] 3. Compilar y ejecutar lint/pruebas. Verificar en navegador con API simulada: inicio, catálogo, ficha, login/MFA, cuenta, carrito/checkout y administración en móvil/escritorio, con agotados/textos largos/errores. Corregir defectos visuales reproducidos.
- [x] 4. Revisión independiente del diff, actualizar DESIGN-SYSTEM.md y comprobar git diff --check. Dejar sin commit.
