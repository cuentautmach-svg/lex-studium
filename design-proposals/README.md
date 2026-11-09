# Tres direcciones para Lex Studium

Fuentes visuales de la rama de trabajo `diseno/estudio-sin-saturacion`, basada en `main`. No constituyen una elección aprobada ni un despliegue. Las tres propuestas mantienen las mismas funciones y pueden revisarse con `?design=archivo`, `?design=foro` y `?design=orbita`.

| Dirección | Identidad y composición | Ventaja y límite principal |
| --- | --- | --- |
| Archivo Vivo · recomendada | Marfil, bosque y lima moderada; Fraunces y Manrope. Navegación lateral, filas editoriales y barra inferior móvil. | La lectura más tranquila y una identidad jurídica cercana; ofrece menos fichas por fila. |
| Foro | Cobalto con acento cálido limitado; Manrope. Navegación superior y tarjetas ligeras de dos columnas. | Exploración familiar y dinámica; las tarjetas y la cabecera ocupan más espacio. |
| Órbita | Grafito, hielo y menta; Manrope. Rail compacto, portada oscura y lista por divisores. | Consulta directa y carácter digital; transmite menos calidez. |

La recomendación completa y sus razones están en [comparacion-visual.md](../docs/comparacion-visual.md). Las alternativas se conservan completas para la decisión del propietario.

## Composición y divulgación progresiva

La biblioteca muestra seis normas de las 41 conservadas, un buscador y una acción de filtrado. «Mostrar más normas» añade seis resultados. Las referencias, fechas, aclaraciones de vigencia y enlaces adicionales permanecen disponibles dentro de cada norma. El aviso general sobre reformas conserva su resumen visible.

El simulador presenta un único paso activo: material, materia y práctica. Las opciones avanzadas se abren a petición. Se conserva el contenido local, la generación de preguntas y su corrección; la presentación añade progreso discreto y estados textuales de acierto y error. Comunidad sigue mostrando «Próximamente».

No se usan imágenes de terceros. La firma visual combina SVG y formas CSS propias; las fuentes se incluyen con sus licencias OFL en `materiales/identidad/`. Los modos oscuros tienen superficies y contrastes específicos para cada dirección.

## Archivos editables

- `base.css`: estructura compartida, controles, tipografía y estados accesibles.
- `archivo.css`, `foro.css`, `orbita.css`: composición, identidad, navegación y adaptación de cada propuesta.
- `simulator.css`: presentación de la secuencia de estudio y de sus resultados.
- `progressive.css`: biblioteca progresiva y ajustes compartidos de lectura e interacción.

Desde la raíz, `npm run build:design` concatena esas fuentes en `experience.css`, el CSS visual que carga la aplicación. No editar directamente el archivo generado. La lógica de presentación está en `library-view.js`, `simulator-flow.js` y `learning-feedback.js`; `shared-files.js` conserva el listado público preexistente sin añadir backend.

Las pulsaciones tienen respuesta breve; las transiciones del asistente duran 180 ms y se limitan a `transform` y `opacity`. Los efectos hover se restringen a dispositivos apropiados. La navegación con teclado y `prefers-reduced-motion` eliminan el movimiento. Los criterios se aplicaron leyendo las instrucciones originales de Impeccable y Emil; la instalación documental y sus límites se explican en [skills-originales.md](../docs/skills-originales.md).

## Revisar y comprobar

1. Servir la raíz con `python -m http.server 4174 --bind 127.0.0.1`.
2. Abrir cada parámetro `design` y alternar biblioteca, simulador y tema.
3. Ejecutar `npm run test:content` para verificar que los siete bloques originales de datos jurídicos y motor de evaluaciones siguen intactos.
4. Ejecutar `BASE_URL=http://127.0.0.1:4174 npm run test:design` con Chromium disponible.

La prueba produce capturas reales en 1280 × 1000 y 390 × 844, y mediciones de adaptación en 360, 390, 768 y 1280 px para los tres diseños y ambos temas. Se revisan biblioteca, Comunidad, perfil y los tres pasos del simulador. El catálogo de archivos de GitHub se simula vacío para aislar la interfaz; no se ejercitan subida, backend ni almacenamiento.

El [informe de auditoría y validación](../docs/auditoria-y-validacion.md) documenta la ejecución realizada, los resultados y los límites. `artifacts/diseno-v2/` contiene las capturas e informes generados y permanece fuera del control de versiones.
