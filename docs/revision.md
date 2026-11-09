# Revisión incremental de Lex Studium

Base analizada: `cuentautmach-svg/lex-studium`, rama `main`, commit `62f2b01070b8de6371429b480d973a11969b7034`. Los cambios se prepararon en `mejora/documentos-y-experiencia` para revisión mediante Pull Request. No se ha desplegado el sitio ni modificado `main`.

## Etapa 1: funcionamiento existente

- Sitio estático en `index.html`, destinado a GitHub Pages. No había servidor, base de datos ni autenticación administrativa en la página.
- Biblioteca con 41 fichas, fuentes institucionales, filtros y favoritos locales.
- Simulador generado en el navegador a partir del material aportado; borradores y resultados guardados en el dispositivo.
- Archivos de `materiales/` listados mediante la API pública de GitHub. La carga existente abría GitHub y dependía de sus permisos.
- Comunidad marcada como «Próximamente».
- Los estilos activos eran los incluidos en `index.html`; `design-polish.css` y `studio-redesign.css` no estaban enlazados. No se activó el rediseño alternativo.

## Etapa 2: experiencia visual

Se conserva la identidad azul, lavanda y coral. `experience.css` corrige la herencia de la antigua barra lateral, los fondos claros que sobrescribían el tema oscuro y el espacio decorativo excesivo en móvil. Añade foco visible, controles de al menos 44 px y transiciones breves con respuesta al pulsar. La preferencia de movimiento reducido también se respeta al navegar entre secciones.

Se siguieron las guías locales `.agents/skills/impeccable/SKILL.md` y `.agents/skills/emil-design-eng/SKILL.md`. No se sustituyeron el contenido jurídico ni la lógica del simulador.

## Etapa 3: documentos

El nuevo panel en «Archivos compartidos» permite iniciar sesión y subir PDF, DOC, DOCX, PPT y PPTX. El servidor verifica la sesión, el origen, el token CSRF, el tamaño y la estructura del archivo. El catálogo y las descargas son públicos; los PDF tienen enlace de consulta nativa y Office se descarga para abrirse en una aplicación compatible.

La base de datos SQLite y los archivos permanecen en almacenamiento privado persistente. Las credenciales no se incorporan al frontend. El perfil local de estudiante no otorga permisos administrativos. Se conserva el catálogo anterior y el modo estático con carga desde GitHub.

La revisión de seguridad corrigió la evasión del límite de intentos por concurrencia, el manejo de archivos sin nombre y la revocación de sesiones al cambiar o retirar la contraseña. La prueba HTTP también detectó y permitió corregir el límite de partes del formulario, que rechazaba cargas válidas.

## Etapa 4: comprobación

- `npm test`: cinco grupos de pruebas con validación de los cinco formatos, autenticación, CSRF, origen, límite de tamaño, concurrencia, persistencia, descarga pública, rutas privadas y limpieza ante un fallo del catálogo.
- `npm run test:browser`: biblioteca, filtros y favoritos tras recarga; borrador y evaluación del simulador con corrección; Comunidad; inicio/cierre de sesión; carga real y descarga idéntica del PDF; visitante sin sesión; modo estático y navegación por teclado.
- Navegador a 360, 768 y 1280 px sin desbordamiento horizontal; tema oscuro y movimiento reducido comprobados. Las capturas se generan en `artifacts/`.
- El catálogo remoto se controla en la prueba de navegador; no se afirma haber revalidado todos los enlaces jurídicos externos.

## Antes de activar en producción

Revisar las capturas y elegir un alojamiento para el sitio y la API en el mismo dominio, con Node 24+, HTTPS y volumen persistente. Crear la contraseña de administración de forma privada. GitHub Pages puede seguir sirviendo el modo estático, pero no ejecuta el servidor nuevo. Ver [configuración y controles](backend.md).

El material visible en las capturas de documentos es una prueba local temporal; no se publicó un documento real ni se migraron archivos de producción.
