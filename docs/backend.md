# Documentos administrados desde Lex Studium

La página estática y el catálogo existente de `materiales/` se conservan. La carga desde la propia página necesita ejecutar este servidor Node: GitHub Pages por sí solo no ejecuta una API, no comprueba contraseñas y no ofrece almacenamiento privado persistente.

## Desarrollo y vista previa

1. Instala Node 24 o superior y ejecuta `npm ci`.
2. Copia `.env.example` a `.env`.
3. Ejecuta `npm run admin:password`, escribe una contraseña larga y única y copia la línea del hash a `.env`. La contraseña no se guarda. No compartas `.env` ni el hash.
4. Ejecuta `npm start` y abre exactamente `http://localhost:3000` (el origen debe coincidir con `PUBLIC_ORIGIN`).
5. En Biblioteca → Archivos compartidos → Administración, inicia sesión y sube el documento. El resto de visitantes puede consultarlo y descargarlo sin registro.

Si `ADMIN_PASSWORD_HASH` está vacío, la administración permanece desactivada y la consulta pública continúa funcionando. El perfil de estudiante y sus favoritos siguen siendo locales; no conceden ningún permiso administrativo.

## Producción

Ejecuta **el sitio y la API en el mismo dominio**, detrás de un proxy HTTPS. Configura `NODE_ENV=production`, `PUBLIC_ORIGIN=https://tu-dominio` y `HOST=0.0.0.0` si lo requiere el alojamiento. El dominio público nunca se obtiene de cabeceras `X-Forwarded-*`. Mantén `PUBLIC_ORIGIN` exacto; el servidor rechaza mutaciones de otros orígenes.

Monta `DATA_DIR` en un volumen privado persistente; contiene SQLite y los documentos. Su ruta no debe exponerse mediante el proxy ni alojarse en un repositorio público. Haz copias de seguridad coherentes de la base de datos y de la carpeta de documentos. No uses un filesystem efímero o almacenamiento de solo lectura. El servidor protege sus rutas mediante una lista explícita de archivos públicos; no configures un segundo servidor estático sobre la raíz completa.

El servicio está diseñado para **una instancia de Node** con disco persistente. Para varias réplicas, usa almacenamiento compartido y un control de intentos común. El límite de acceso actual se aplica a la dirección de red observada por Node; detrás de un proxy todos los clientes pueden compartir ese límite. Ajusta la arquitectura si hay más administradores o tráfico elevado.

Al cambiar o eliminar `ADMIN_PASSWORD_HASH` y reiniciar el servicio se revocan todas las sesiones existentes. Las sesiones caducan a las ocho horas.

## Controles implementados

- Contraseña derivada con scrypt; sesiones aleatorias almacenadas por su hash en SQLite.
- Cookie HttpOnly, SameSite=Strict y Secure en producción; expiración de ocho horas.
- Comprobación de origen en mutaciones y token CSRF por sesión en cargas y cierre de sesión.
- Cinco intentos de contraseña por dirección de red y ventana de quince minutos.
- Solo PDF, DOC, DOCX, PPT y PPTX; máximo 20 MiB, un archivo por solicitud y dos cargas simultáneas.
- PDF con cabecera y final reconocibles; Office antiguo con contenedor y stream de tipo correcto; OOXML con ZIP válido, CRC, expansión acotada y estructura de Word o PowerPoint. Se rechazan macros y contenido activo reconocido en los contenedores.
- Nombres de almacenamiento UUID y escritura sin sobrescritura. La ficha se añade después de guardar el archivo; se limpia el archivo si falla la escritura del catálogo.
- Catálogo y descargas públicos. PDF permite vista nativa; Word y PowerPoint se descargan. Respuestas con tipo MIME explícito, `nosniff`, nombre de descarga seguro y política de aislamiento para documentos.

Estas comprobaciones detectan formatos falsos y estructuras dañadas; **no sustituyen un antivirus ni una auditoría del contenido**. Solo un administrador de confianza puede publicar. Antes de ofrecer documentos de terceros, incorpora un análisis antimalware del lado servidor si tu operación lo necesita. La biblioteca no convierte ni ejecuta documentos Office.

## Pruebas

`npm test` ejecuta pruebas de formatos, autenticación, CSRF y origen, límites, descarga pública, persistencia, cierre de sesión, bloqueo de rutas privadas y configuración desactivada. Las pruebas usan archivos temporales y no alteran el catálogo real.

`npm run test:browser` comprueba la biblioteca, favoritos y borrador persistentes, la generación y corrección del simulador, Comunidad, el panel de administración, carga y descarga reales, acceso público y el modo estático. Revisa tamaños de 360, 768 y 1280 px y movimiento reducido; guarda capturas en `artifacts/` (carpeta excluida de Git). Necesita Chromium: instala el navegador con `npx playwright install chromium` o indica uno existente mediante `CHROMIUM_PATH=/ruta/chromium npm run test:browser`. El catálogo remoto se controla en estas pruebas para no depender de la cuota de GitHub; las cargas y descargas usan el servidor real y datos temporales.

## API

| Método y ruta | Acceso | Resultado |
| --- | --- | --- |
| `GET /api/documents` | Público | `{documents: [...]}` |
| `GET /api/documents/:id/view` | Público | PDF en navegador; Office como descarga |
| `GET /api/documents/:id/download` | Público | Descarga con nombre original |
| `GET /api/admin/session` | Público | `{configured, authenticated, csrfToken?}` |
| `POST /api/admin/login` | Origen permitido | JSON `{password}`; crea cookie |
| `POST /api/admin/logout` | Administrador + CSRF | Revoca cookie y sesión |
| `POST /api/documents` | Administrador + CSRF | Multipart `file`, `title`, `description`; responde `201 {document}` |

Las mutaciones administrativas usan la cabecera `X-CSRF-Token`. Los errores devuelven JSON `{error}` con un mensaje en español y un código HTTP adecuado. La API no permite que el navegador escoja una ruta de disco ni una URL externa de almacenamiento.
