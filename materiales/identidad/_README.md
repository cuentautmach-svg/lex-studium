# Tipografías de la identidad visual

Fraunces (normal y cursiva) y Manrope se alojan con el proyecto para evitar solicitudes a servicios externos. Los archivos WOFF se convirtieron con fontTools desde las fuentes variables TTF del repositorio oficial de Google Fonts, conservando las licencias SIL OFL adjuntas.

Se usa esta ruta pública existente para que las fuentes funcionen tanto en GitHub Pages como con el servidor actual, sin cambiar el backend. Los archivos WOFF no forman parte de los formatos del catálogo jurídico y los archivos con prefijo `_` se excluyen de su listado.

Fuentes originales:
- https://github.com/google/fonts/tree/main/ofl/fraunces
- https://github.com/google/fonts/tree/main/ofl/manrope

Para esta revisión se conservan los caracteres latinos, españoles, puntuación y símbolos empleados; Fraunces fija SOFT=25, WONK=1 y opsz=32 y mantiene el peso variable. La conversión y el subconjunto se realizaron con fontTools, sin añadir dependencias de ejecución.
