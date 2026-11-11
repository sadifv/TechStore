# Respaldo y restauración de TechStore

## Alcance y evidencia

Responsable de ejecución y custodia: propietario de TechStore. Este procedimiento queda preparado en el repositorio. La existencia de una copia y su restauración se acreditan con el registro de ejecución descrito al final.

Objetivo operativo propuesto: una copia diaria, 7 diarias y 4 semanales, en almacenamiento cifrado separado del equipo y de Atlas. Esto limita la pérdida a un máximo de 24 horas si se cumple la frecuencia. El tiempo de recuperación se mide en cada ensayo; todavía no se establece un tiempo garantizado.

## Preparación

1. Instalar MongoDB Database Tools y mongosh en una máquina controlada. Registrar sus versiones y la versión/FCV del servidor. Restaurar en una versión mayor o FCV compatible con la de origen.
2. Verificar en Atlas qué mecanismo de backup admite el plan y su política real de retención. Si hay snapshots, registrar identificador, fecha y una restauración de prueba en otro cluster.
3. Para el respaldo lógico alternativo de esta guía, coordinar una ventana sin escrituras. Detener el backend, procesos programados y cualquier otra aplicación que escriba en la base. Impedir pedidos nuevos durante la ventana. Un dump de una sola base sin esta pausa puede mezclar estados de inventario y pedidos.
4. Verificar el nombre exacto de la base y el destino autorizado. Los ejemplos siguientes usan `TechStore`, que distingue mayúsculas. Elegir una cuenta de backup limitada al acceso necesario.
5. Guardar las credenciales en un archivo YAML protegido fuera del repositorio, del directorio sincronizado y de cualquier carpeta pública. Usar `--config` evita poner la contraseña en argumentos visibles. La configuración de origen contiene `uri` y, si corresponde, `password`. Nunca adjuntarla como evidencia.
6. Custodiar por separado la configuración del despliegue y `SESSION_SECRET`, necesario para descifrar MFA. Un dump no contiene secretos de Render ni archivos externos a MongoDB. Las imágenes guardadas en ProductImage sí están incluidas.

## Crear y registrar la copia

Ejemplo PowerShell. Las rutas son ejemplos locales que el operador debe preparar con acceso restringido. No ejecutar sobre producción sin autorización y comprobación de destino.

```powershell
mongodump --version
mongorestore --version
mongosh --version
$backupConfig = 'C:\TechStoreOps\private\source.yml'
$archiveFile = 'C:\TechStoreOps\backups\TechStore-AAAA-MM-DD.archive.gz'
mongodump --config="$backupConfig" --db=TechStore --gzip --archive="$archiveFile"
if ($LASTEXITCODE -ne 0) { throw 'El respaldo falló. No registrar una copia válida.' }
Get-Item -LiteralPath $archiveFile | Select-Object Name, Length, LastWriteTimeUtc
Get-FileHash -LiteralPath $archiveFile -Algorithm SHA256
```

Registrar conteos de las colecciones durables durante la misma pausa, mediante Atlas o mongosh, sin exportar documentos personales al informe. Al menos `products`, `productimages`, `users`, `orders`, `coupons`, `addressbooks`, `favoritelists` y `productreviews`. Registrar también sus índices y opciones. Terminado el dump y los conteos, reanudar el servicio y comprobar `/health`.

Transferir la copia al almacenamiento cifrado y comparar SHA-256. Gzip comprime, pero no cifra. Aplicar retención solo después de verificar que hay una copia nueva válida y recuperable.

## Ensayo de restauración aislado

Hacerlo mensualmente y antes de cambios de almacenamiento importantes. Usar un MongoDB local/aislado compatible y una base nueva vacía, sin conectar la aplicación a servicios de correo, WhatsApp o producción.

La configuración `restore-local.yml` debe contener únicamente un destino local, por ejemplo `uri: mongodb://127.0.0.1:27017`. Confirmarlo antes de ejecutar. Restaurar la copia como `TechStoreRestore`, nunca sobre la base original. No usar `--drop`.

```powershell
$restoreConfig = 'C:\TechStoreOps\private\restore-local.yml'
mongorestore --config="$restoreConfig" --gzip --archive="$archiveFile" --nsInclude='TechStore.*' --nsFrom='TechStore.*' --nsTo='TechStoreRestore.*' --nsExclude='TechStore.sessions' --nsExclude='TechStore.presences' --nsExclude='TechStore.rate_limit_counters' --nsExclude='TechStore.maintenance_locks' --stopOnError
if ($LASTEXITCODE -ne 0) { throw 'La restauración falló. Revisar antes de declarar recuperable la copia.' }
mongosh 'mongodb://127.0.0.1:27017/TechStoreRestore' --quiet --eval 'JSON.stringify(db.getCollectionNames().sort().map(name => ({collection:name,count:db.getCollection(name).countDocuments({})})))'
```

Comparar los conteos durables y los índices con el manifiesto. Las colecciones con TTL pueden perder documentos ya vencidos durante la restauración; registrar esas diferencias. Verificar referencias entre pedidos, usuarios y productos, importes históricos e imágenes. No confirmar pagos ni enviar correos de prueba usando datos restaurados de clientes.

La aceptación exige salida de restauración sin fallos, conteos durables coincidentes, índices presentes y lectura correcta de una muestra controlada. Registrar el tiempo total desde que se obtiene la copia hasta que termina la verificación.

## Recuperación real

Requiere una autorización independiente. Restaurar primero en un destino nuevo aislado. Validar como en el ensayo, revisar vencimientos pendientes, credenciales y acceso de red, e invalidar sesiones y tokens de recuperación antes de permitir accesos. Revisar campañas/avisos para evitar repetir envíos al arrancar los procesos programados. Cambiar la conexión de Render solo tras aprobar el destino y el plan de reversión. Conservar intactos la base y el respaldo anteriores hasta cerrar la incidencia.

## Registro de ejecución

Guardar fuera del repositorio y sin datos personales: operador, autorización, fecha UTC, cluster/base origen, versión/FCV y herramientas, ventana sin escrituras, archivo/tamaño/SHA-256, ubicación cifrada, conteos e índices, destino de ensayo, resultado, tiempo de recuperación, diferencias justificadas y próxima verificación. Si falta cualquiera de las comprobaciones de aceptación, marcar el ensayo como pendiente o fallido.

## Referencias

- [mongodump y consistencia del respaldo](https://www.mongodb.com/docs/database-tools/mongodump/)
- [mongorestore, configuración y filtros de namespaces](https://www.mongodb.com/docs/database-tools/mongorestore/)
