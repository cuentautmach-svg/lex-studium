# Lex Studium

Plataforma educativa de Derecho ecuatoriano con biblioteca jurídica, enlaces a fuentes institucionales, simulador de evaluaciones y una sección Comunidad marcada «Próximamente».

## Uso

La página principal es `index.html`. El simulador funciona en el navegador sin servidor; el progreso local queda guardado en el dispositivo. La legislación debe contrastarse siempre con su fuente oficial y reformas vigentes.

La biblioteca conserva la normativa oficial, los filtros, los favoritos locales y los archivos existentes en `materiales/`. Comunidad permanece como **Próximamente**. Los cambios visuales incrementales están en `experience.css`; el panel de documentos está en `documents.js` y `documents.css`.

## Documentos desde la página

Se añadió un servidor opcional para iniciar sesión como administrador y publicar PDF, Word (`.doc`, `.docx`) y PowerPoint (`.ppt`, `.pptx`) de hasta 20 MB. El catálogo, la consulta y la descarga son públicos. Los documentos se guardan en disco privado y su catálogo en SQLite; las sesiones y los permisos se verifican en el servidor.

Requiere **Node.js 24 o posterior**:

```sh
npm ci
cp .env.example .env
npm run admin:password
# Añadir el hash generado a ADMIN_PASSWORD_HASH en .env.
npm start
```

Consulta la configuración y las pruebas en [docs/backend.md](docs/backend.md). Nunca incluyas contraseñas, hashes de administración ni tokens de GitHub en el HTML o JavaScript público.

En GitHub Pages sigue funcionando el sitio estático y la carga anterior desde GitHub. Para activar la carga dentro de la página, el sitio debe servirse con el nuevo servidor en un alojamiento con Node.js, HTTPS y volumen persistente. Esa activación no se realiza automáticamente al subir el código a Pages.

## Publicación

Este repositorio está preparado para GitHub Pages. Seleccionar `Deploy from a branch` → `main` → `/ (root)` en Settings → Pages.

Esta propuesta se prepara para revisión mediante Pull Request. No publicar cambios importantes antes de revisar la vista previa y acordar el alojamiento de los documentos.

La comparación de proveedores, el presupuesto inicial y la configuración pendiente están en [docs/publicacion.md](docs/publicacion.md).
