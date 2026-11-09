# Lex Studium

Plataforma de estudio de Derecho ecuatoriano: biblioteca de 41 normas y fuentes institucionales, favoritos locales, simulador de evaluaciones y Comunidad como «Próximamente».

Esta revisión desarrolla tres propuestas visuales sobre el proyecto existente en la rama `diseno/estudio-sin-saturacion`, creada desde `main` (`62f2b01070b8de6371429b480d973a11969b7034`). Se mantienen separadas de las funciones de documentos de la otra rama. La elección definitiva requiere revisión del propietario; no se ha fusionado ni desplegado este rediseño.

## Revisar las tres propuestas

Con Python 3, desde la raíz del repositorio:

```sh
python -m http.server 4174 --bind 127.0.0.1
```

Abrir una de estas direcciones:

- [Archivo Vivo](http://127.0.0.1:4174/?design=archivo): lectura editorial, navegación lateral y lista ligera.
- [Foro](http://127.0.0.1:4174/?design=foro): navegación superior, identidad educativa y tarjetas de dos columnas.
- [Órbita](http://127.0.0.1:4174/?design=orbita): navegación compacta, grafito y menta, lista de consulta.

Archivo Vivo es la recomendación de diseño y la vista predeterminada para revisión. Las tres incluyen biblioteca, simulador, móvil y modo oscuro. La biblioteca presenta seis normas inicialmente y permite mostrar las restantes; los filtros y las referencias ampliadas se abren a petición. El simulador organiza la configuración en tres pasos y conserva el motor original.

## Desarrollo y comprobación

La aplicación se sirve como archivos estáticos; no requiere Node ni un backend para estudiar. Node 24 y Playwright son herramientas de desarrollo para generar el CSS y comprobar la interfaz:

```sh
npm ci
npm run build:design
npm run test:content
BASE_URL=http://127.0.0.1:4174 npm run test:design
```

La revisión usa Chromium en `/usr/bin/chromium`; puede indicarse otra instalación con `CHROMIUM_PATH`. El servidor estático debe estar activo antes de ejecutar `test:design`. Las capturas y los informes JSON se generan en `artifacts/diseno-v2/`, excluido de Git. No se necesitan credenciales, cuentas ni documentos privados para estas pruebas.

Los estilos editables están en `design-proposals/`; `experience.css` se genera con `build:design`. Las fuentes se sirven desde `materiales/identidad/` con sus licencias OFL. El progreso, los favoritos y el perfil se guardan en el navegador del visitante.

## Resultados y decisiones

- [Capturas reales: biblioteca, simulador y modo oscuro en PC y móvil](docs/capturas/README.md).
- [Auditoría y validación ejecutada](docs/auditoria-y-validacion.md).
- [Comparación y recomendación de las propuestas](docs/comparacion-visual.md).
- [Procedencia, uso y límites de las skills originales](docs/skills-originales.md).
- [Organización de las fuentes visuales](design-proposals/README.md).

La revisión se limita a la estética y la experiencia de uso. Conserva el listado público existente de archivos de GitHub; no incorpora un administrador de documentos, almacenamiento persistente ni servicios contratados. Las normas y sus reformas deben contrastarse siempre con las fuentes oficiales.
