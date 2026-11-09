# Preparación de la publicación de Lex Studium

Revisión de proveedores: 9 de noviembre de 2026. Propuesta de código: [Pull Request #1](https://github.com/cuentautmach-svg/lex-studium/pull/1), en borrador, sin fusionar ni desplegar. No se han contratado servicios ni configurado credenciales de producción.

## Recomendación y presupuesto

Para empezar, conviene **un servicio web de pago en Render, una instancia Node y un volumen persistente de 5 GB**. El mismo proceso sirve la web y la API, tal como espera el código actual. Se conserva SQLite y no hace falta pagar una base de datos adicional.

| Alternativa | Costo orientativo mensual | Ventajas y límites |
| --- | --- | --- |
| Render, servicio de 512 MB y 0,5 CPU + disco de 5 GB, workspace Hobby | US$7 + US$1,25 = **US$8,25 de base** | Costo base predecible, HTTPS gestionado, disco persistente; una instancia. |
| Railway Hobby + volumen | **Mínimo US$5; factura según consumo** | Puede resultar más barato con poco uso; RAM, CPU, almacenamiento y tráfico se facturan por uso. |

Los precios excluyen impuestos, dominio opcional y copias externas. Render Hobby incluye 5 GB de salida mensual y cobra US$0,15 por GB adicional: con 10 GB de salida total, la estimación sería US$9,00, sin los otros conceptos. Railway cuenta su mínimo de US$5 como crédito de uso, no como una cuota que se suma íntegra al consumo; sus tarifas son US$10/GB-mes de RAM, US$20/vCPU-mes, US$0,15/GB-mes de volumen utilizado y US$0,05/GB de salida. Con 0,5 GB de RAM media y 5 GB de datos, serían US$5,75 antes de CPU y tráfico; no es una cotización fija.

Fuentes: [precios Render](https://render.com/pricing), [tráfico Render](https://render.com/docs/outbound-bandwidth), [precios Railway](https://docs.railway.com/pricing/plans). Confirmar tarifas en el panel antes de contratar.

El plan gratuito de Render **no sirve para conservar estos documentos**: no admite disco persistente y los archivos locales desaparecen al reiniciar, desplegar o suspender el servicio. [Límites del plan gratuito](https://render.com/docs/free).

## Almacenamiento necesario

Montar un volumen privado en `/var/data` y configurar `DATA_DIR=/var/data/lex-studium`. Su contenido será:

```text
/var/data/lex-studium/
  lex-studium.sqlite
  lex-studium.sqlite-wal  # puede existir mientras el servidor está activo
  lex-studium.sqlite-shm  # puede existir mientras el servidor está activo
  documents/             # documentos con nombres UUID
```

Los 5 GB son una capacidad inicial propuesta, no una cuota de espacio ya implementada en la aplicación. Cada carga admite hasta 20 MiB. Reservar margen para la base y los archivos temporales; revisar el uso al llegar al 80 %. El disco puede ampliarse después. Render lo vincula a una sola instancia y los nuevos despliegues tienen una breve interrupción. No configurar réplicas con esta arquitectura. [Discos persistentes](https://render.com/docs/disks).

La ubicación física permanece privada: los visitantes reciben los documentos mediante las rutas públicas de la API. No necesitan cuenta y no se les cobra. El propietario de Lex Studium paga alojamiento, espacio y tráfico; las descargas gratuitas para visitantes no equivalen a tráfico ilimitado sin costo.

## Configuración del futuro servicio Render

Estos pasos son para una publicación posterior a la revisión del PR. Crear el servicio inicia un despliegue; no se ha realizado esa acción.

| Campo | Configuración prevista |
| --- | --- |
| Repositorio | `cuentautmach-svg/lex-studium` |
| Rama de producción | `main`, después de revisar y fusionar el PR |
| Tipo | Web Service con runtime Node |
| Versión Node | Fijar una versión 24 mantenida; la comprobada es `24.22.1` mediante `NODE_VERSION` |
| Build command | `npm ci --omit=dev` |
| Start command | `npm start` |
| Instancias | Una |
| Volumen | 5 GB montados en `/var/data` |
| `HOST` | `0.0.0.0` |
| `PORT` | Usar el valor asignado por Render; el código ya lo lee |
| `NODE_ENV` | `production` |
| `DATA_DIR` | `/var/data/lex-studium` |
| `PUBLIC_ORIGIN` | El origen HTTPS real del sitio, con el dominio elegido |
| `ADMIN_PASSWORD_HASH` | Valor privado generado por el administrador; introducirlo solo en las variables secretas del proveedor |
| Health check | `/api/documents` |
| Despliegues automáticos | Desactivados inicialmente; publicar manualmente después de revisar |

Render proporciona una dirección `onrender.com`, por lo que no es obligatorio comprar un dominio para empezar. Si después se usa un dominio propio, actualizar `PUBLIC_ORIGIN` y elegir un único dominio principal. Servir la interfaz y `/api` en ese mismo origen; mantener la interfaz únicamente en GitHub Pages no activa las subidas de esta API. No hace falta cambiar CORS ni permitir orígenes arbitrarios.

Fuentes: [servicios web, puerto y dominio](https://render.com/docs/web-services), [versión de Node](https://render.com/docs/node-version).

## Contraseña y permisos

Ejecutar `npm run admin:password` en un equipo de confianza. El programa pide la contraseña sin mostrarla y devuelve una línea para configuración. En el panel de alojamiento pegar **solo el valor del hash**, sin el nombre `ADMIN_PASSWORD_HASH=`, sin las comillas de la línea `.env` y sin publicar el resultado en GitHub o en el chat. Guardar la contraseña en un gestor privado. La aplicación compara el hash en el servidor; nunca debe enviarse al JavaScript público.

No se necesita un token de GitHub para cargar archivos desde la página una vez activado el servicio. La conexión del alojamiento al repositorio puede gestionarse con su integración oficial, limitada a este repositorio. Proteger las cuentas de GitHub y del proveedor con autenticación de dos factores.

## Copias de seguridad pendientes

**Todavía falta implementar y programar las copias automáticas.** Las instantáneas diarias del disco de Render se conservan siete días, pero no sustituyen una copia coherente de SQLite y los documentos. No copiar únicamente `lex-studium.sqlite` mientras está activo: la aplicación usa WAL. [SQLite Online Backup y VACUUM INTO](https://www.sqlite.org/backup.html), [instantáneas Render](https://render.com/docs/disks).

Plan propuesto: generar una instantánea coherente de SQLite, leer de esa copia los nombres de los documentos referenciados y copiar esos archivos inmutables junto con un manifiesto de integridad. Mantener siete copias diarias del catálogo y cuatro semanales; los objetos inmutables pueden conservarse una sola vez mientras alguna copia los referencie. Ensayar la restauración completa y revocar las sesiones administrativas restauradas. En Render el proceso debe tener acceso al volumen de la instancia; un Cron Job separado no puede montar ese disco.

Un destino adecuado sería un **bucket privado de Cloudflare R2 Standard**, con credenciales limitadas a ese bucket, fuera del repositorio y sin acceso público. Incluye 10 GB-mes de almacenamiento, un millón de operaciones A y diez millones B al mes; después cobra almacenamiento y operaciones. El almacenamiento adicional Standard cuesta US$0,015/GB-mes. La retención puede superar la capa gratuita y el envío de las copias cuenta como salida del servidor de origen. [Tarifas R2](https://developers.cloudflare.com/r2/pricing/), [permisos](https://developers.cloudflare.com/r2/api/tokens/).

R2 es aquí una propuesta para respaldos, no una integración existente. No reemplaza `DATA_DIR` mediante una variable. Usarlo posteriormente para los documentos y descargas directas exigiría adaptar el backend; retransmitir desde Node seguiría consumiendo tráfico de Render.

## Qué falta antes de ofrecer las subidas públicas

1. Revisar y aprobar el PR; fusionarlo solo cuando se decida publicar.
2. Elegir proveedor, presupuesto y cuenta de facturación.
3. Crear el servicio y montar el disco persistente con los valores anteriores.
4. Configurar la contraseña administrativa privadamente y comprobar HTTPS, dominio y cookies.
5. Preparar las copias externas, programarlas y ensayar una restauración; revisar alertas de uso y costos.
6. Probar en el dominio real: carga administrativa de los formatos admitidos, descarga sin sesión y persistencia tras reiniciar o desplegar. La validación local ya existe, pero no sustituye esta comprobación de producción.

La biblioteca, el simulador y Comunidad conservan su comportamiento. Los materiales anteriores de GitHub siguen disponibles; los documentos nuevos se guardarán en el volumen persistente y no necesitarán commits por cada carga.
