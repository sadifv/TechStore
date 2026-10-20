---
name: techstore-release
description: Revisa cambios y prepara publicaciones de TechStore cuidando secretos y ramas. Usar cuando el usuario pida revisar un release, crear un commit de publicación, subir cambios a developer o main, o comprobar despliegues de Render y Netlify.
---

# Publicar TechStore

Aplica esta skill solo al repositorio TechStore. Lee las instrucciones del repositorio pertinentes antes de cambiar archivos o ramas.

## Seguridad y alcance

- Nunca leas, muestres, copies ni incluyas en logs o commits los valores de `.env`, claves API, contraseñas, tokens, cookies o secretos de Render/Netlify. Puedes revisar nombres de variables y el estado de archivos sin revelar valores.
- No cambies variables de entorno, permisos, datos de producción ni ajustes de Render o Netlify salvo que el usuario lo pida explícitamente.
- No borres cambios del usuario, no uses `git reset --hard`, no fuerces pushes y no sobrescribas cambios remotos.
- No crees commits, publiques ramas ni promociones a `main` salvo que el usuario lo haya pedido. La petición de revisar o preparar un release no autoriza por sí sola publicarlo.
- No añadas ni ejecutes pruebas salvo que el usuario pida probar o verificar. Informa claramente qué verificaciones sí se hicieron.

## Revisión antes de publicar

1. Comprueba rama, árbol de trabajo y seguimiento remoto con `git status --short --branch` y `git branch -vv`.
2. Inspecciona los cambios previstos (`git diff --check`, `git diff --stat` y el diff de los archivos relevantes). Revisa también los archivos preparados y no rastreados; no abras archivos de secretos.
3. Confirma que no se prepararon `.env`, archivos de credenciales, claves privadas, artefactos de compilación ni cambios ajenos al release.
4. Si encuentras un secreto, detén la publicación, no lo reproduzcas en la respuesta y recomienda revocarlo o rotarlo si pudo salir del entorno seguro.
5. Resume los cambios y cualquier riesgo antes de publicar. Usa mensajes de commit en español cuando el usuario pida un commit.

## Flujo de ramas solicitado habitualmente

La rama de trabajo es `developer`; `main` alimenta producción. Ejecuta este flujo solo cuando el usuario pida subir a `developer`, promover a `main` y volver a `developer`:

1. Asegúrate de que el commit contiene únicamente los cambios solicitados y que el árbol de trabajo está limpio.
2. Publica `developer` en `origin` solo si el usuario pidió subirlo.
3. Actualiza las referencias remotas con `git fetch origin`. Comprueba que `main` no contiene trabajo remoto adicional que impida un avance seguro.
4. Cambia a `main` y usa únicamente `git merge --ff-only origin/developer`. Si no es posible avanzar en fast-forward, detente y explica la divergencia; no resuelvas con reset ni fuerces el push.
5. Publica `main` solo si el usuario pidió promover los cambios.
6. Regresa a `developer` y verifica con `git status --short --branch`, `git log -1 --oneline` y las referencias remotas que ambas ramas quedaron donde se esperaba.

## Despliegues

- Render ejecuta el backend desde `backend`, según `render.yaml`; normalmente despliega desde `main`.
- Netlify sirve el frontend; revisa `frontend/public/_redirects` si el proxy de `/api` o `/uploads` es relevante para el cambio.
- Un push a `main` solo confirma que se solicitó o activó el auto-despliegue. No afirmes que está en producción hasta observar el estado `Live` en el proveedor o comprobar el servicio desplegado.
- Para comprobar una versión, identifica el commit desplegado y compara su SHA con el commit publicado. Si no tienes acceso al dashboard, di claramente que no pudiste confirmar el estado de Render/Netlify y da al usuario el SHA que debe buscar.
- No pidas ni aceptes claves por el chat. Guía al usuario para ingresarlas directamente en los ajustes de entorno del proveedor.

## Respuesta final

Indica el commit, las ramas subidas, la rama actual y el estado real del despliegue. Separa claramente lo verificado de lo que queda pendiente. No digas que compiló, pasó pruebas o quedó desplegado si no lo comprobaste.
