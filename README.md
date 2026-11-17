# Lex Studium

Biblioteca de estudio de Derecho ecuatoriano: 41 normas y fuentes institucionales, búsqueda, filtros, favoritos locales y materiales públicos. El perfil se guarda en el navegador. Comunidad permanece como «Próximamente» y el simulador conserva su pausa temporal en `main`.

## Borrador: sala de consulta

La rama `diseno/editorial-juridico` reemplaza la interfaz anterior por una sala de consulta: índice institucional lateral, catálogo de títulos y ficha bibliográfica de la norma seleccionada. En móvil, el catálogo y la ficha son vistas separadas con regreso y posición de lectura conservados.

**Esta revisión no está fusionada ni publicada.**

[Ver capturas reales del antes, la propuesta anterior y la nueva interfaz](docs/sala-de-consulta/README.md).

La nueva organización incluye accesos propios a Biblioteca, Mis lecturas, Material compartido, Comunidad y Mi espacio; índice de materias; búsqueda y filtros; consulta de fuentes y PDF, cuando está disponible. La información jurídica y el almacenamiento local existente se conservan.

## Desarrollo

La aplicación es estática, sin instalación ni backend para estudiar. Para abrirla localmente desde la raíz:

```sh
python -m http.server 4174 --bind 127.0.0.1
```

Visitar `http://127.0.0.1:4174/`. Node 24 y Playwright se utilizan únicamente para compilación del CSS y comprobaciones:

```sh
npm ci
npm run build:design
npm run test:content
BASE_URL=http://127.0.0.1:4174 npm run test:design
```

El servidor debe seguir activo durante `test:design`. El runner utiliza Chromium en `/usr/bin/chromium`, configurable con `CHROMIUM_PATH`; guarda capturas e informe en `artifacts/campus/`. `OUTPUT_DIR` permite otra carpeta.

El CSS editable actual está en `design-proposals/campus.css`. `experience.css` se compila a partir de `base.css`, `simulator.css` y `campus.css`. La fuente tipográfica se sirve localmente desde `materiales/identidad/`, con sus licencias OFL. La fotografía real del índice tiene su procedencia y licencia en `assets/photography/library.jpg.json`.

## Evidencia y versiones anteriores

- [Arquitectura, capturas y límites de la nueva sala de consulta](docs/sala-de-consulta/README.md).
- [Reporte de comprobaciones ejecutadas](docs/sala-de-consulta/verificacion.json).
- [Primera propuesta editorial, conservada como referencia](docs/revision-editorial/README.md).
- `DESIGN.md`, las propuestas Archivo/Foro/Órbita y sus capturas documentan exploraciones anteriores. Sus CSS no se incluyen en la compilación actual. Los parámetros `?design=archivo`, `?design=foro` y `?design=orbita` ya no seleccionan variantes: esta rama presenta una única interfaz coherente.

No se han incorporado servicios contratados, autenticación, un administrador de documentos ni almacenamiento remoto. Las normas y reformas deben contrastarse con las fuentes oficiales.
