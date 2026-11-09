# Auditoría visual y validación de Lex Studium

Revisión del 9 de noviembre de 2026. Trabajo exclusivamente de interfaz en `diseno/estudio-sin-saturacion`, rama creada desde `main` en `62f2b01070b8de6371429b480d973a11969b7034`. No se modificó el backend de documentos de la otra rama, no se contrataron servicios y no se fusionó ni desplegó este rediseño. El usuario eligió **Foro, la dirección azul**, como diseño predeterminado. Archivo Vivo y Órbita permanecen disponibles para comparación. La selección estética no autoriza fusionar ni desplegar.

## Problemas y cambios

La saturación procedía de la estructura: portada extensa, accesos repetidos, varios niveles de tarjetas y todos los resultados del catálogo visibles. La configuración de una evaluación mostraba muchos campos a la vez. El objetivo de la revisión fue reducir decisiones simultáneas y facilitar la lectura, conservando la información jurídica.

| Antes | Después | Por qué |
| --- | --- | --- |
| Portada, tres accesos rápidos y mensajes repetidos antes de consultar. | Presentación breve, una tarea evidente y navegación directa. | Acercar al estudiante al contenido sin perder la identidad de cada propuesta. |
| Las 41 normas y sus metadatos competían en una sola vista. | Seis resultados iniciales, carga de seis en seis y referencias desplegables. | Facilitar la exploración sin eliminar normas, fechas ni aclaraciones de vigencia. |
| Filtros, etiquetas y acciones visibles simultáneamente. | Buscador destacado, «Filtrar» y una acción principal «Consultar» por norma. | Mantener disponibles las opciones secundarias sin exigir procesarlas primero. |
| Materia, contenido y configuración del simulador a la vez. | Tres pasos con un único paso visible y opciones avanzadas plegadas. | Dividir la tarea en decisiones comprensibles y conservar la funcionalidad original. |
| La respuesta de una evaluación dependía más de la presentación general del formulario. | Progreso discreto, etiquetas de acierto/error y resultado objetivo legible. | Dar retroalimentación útil sin añadir efectos de gamificación. |
| Jerarquías y ornamentación acumuladas. | A: filas editoriales; B: tarjetas ligeras; C: lista compacta. | Explorar tres composiciones realmente diferentes, con color y decoración controlados. |
| Una experiencia móvil condicionada por la composición de escritorio. | Controles táctiles, tema integrado en la cabecera, navegación compacta y un paso de práctica activo. | Facilitar consulta y estudio en anchos pequeños. |

Se conservan las 41 normas, sus referencias institucionales, el sistema local de favoritos, el perfil y borrador locales, el motor de evaluaciones y Comunidad como «Próximamente». El listado público existente de archivos se mantiene separado de un futuro sistema de administración y almacenamiento.

## Skills originales y aplicación

Se revisaron los repositorios oficiales y sus instrucciones de instalación. Emil Design Engineering se copió manualmente con su licencia; Impeccable se incorporó como copia documental parcial de su build para Codex, con doce referencias y su licencia. Los 16 archivos originales incorporados coinciden byte por byte con los blobs fijados en el manifiesto. No se instaló ni ejecutó el CLI de Impeccable, ni se habilitaron hooks; tampoco se afirma una recarga automática del catálogo de skills de esta sesión.

- **Impeccable**, commit `613fbf88e0ef08709eaf238653285f430250c0ea`: `distill` y `quieter` fundamentan la eliminación de duplicados y los detalles a petición; `Read` y `Operate` priorizan lectura y tarea. `craft-floor` orienta la eliminación de rótulos decorativos, la numeración solo donde hay una secuencia real y el uso coherente de SVG. `adapt`, `audit`, `typeset` y `layout` guían la comprobación de tamaños, focos, temas y adaptación.
- **Emil `emil-design-eng`**, commit `5206a950b715e0cabe7043ea0b2304332b91494e`: respuesta de pulsación de 140 ms, transición de paso de 180 ms, movimiento limitado a `transform`/`opacity`, hover restringido a puntero adecuado, sin animaciones al usar teclado y respeto de `prefers-reduced-motion`.

La procedencia, licencias, verificación y limitación del modo manual se documentan en [skills-originales.md](skills-originales.md). Las instrucciones originales y el manifiesto están en `.agents/skills/`. No se ejecutaron instaladores remotos ni mecanismos de ejecución automática.

## Ejecución de pruebas registrada

Se ejecutaron realmente estas comprobaciones contra un servidor estático local de este árbol de trabajo:

```sh
npm run build:design
npm run test:content
BASE_URL=http://127.0.0.1:4174 npm run test:design
```

`test:content` y `test:design` finalizaron con código de salida 0. El servidor usado fue `python -m http.server 4174 --bind 127.0.0.1`. La revisión usa Chromium mediante Playwright; no requiere servidor de documentos ni credenciales.

| Comprobación ejecutada | Resultado registrado |
| --- | --- |
| Presentación de Archivo Vivo, Foro y Órbita; biblioteca, simulador y temas. | Las tres direcciones renderizan; capturas reales en escritorio y móvil. |
| Biblioteca: búsqueda, carga progresiva, filtros, referencias, estado vacío y favoritos. | Seis resultados iniciales; las 41 normas siguen accesibles. Favoritos conservados al recargar. |
| Simulador: validación, borrador, pasos y opciones avanzadas. | Error inline para material insuficiente, un paso visible y borrador conservado al recargar. |
| Generación y corrección de evaluación de cinco preguntas. | Preguntas presentadas, error detectado, cinco aciertos corregidos, resultado 5/5 y registro local del 100 %. |
| Respuestas y alternativa cuando no se abre una ventana nueva. | Respuestas mostradas y evaluación disponible en la página actual. |
| Teclado, pestañas, Comunidad, archivos existentes, tema y perfil. | Navegación comprobada; Comunidad conserva «Próximamente»; preferencias persisten. |
| Adaptación en 360, 390, 768 y 1280 px; ambos temas y las tres propuestas. | 144 mediciones de pantalla sin desbordamiento horizontal detectado; controles de cabecera sin superposición en móvil. |
| Contraste de texto y placeholders sobre fondos sólidos. | 72 vistas, 2742 muestras y cero fallos detectados por el método aplicado; mínimo medido 4,56:1. |
| Recursos de interfaz y JavaScript. | Cero errores JavaScript o fallos de fuentes, scripts y hojas de estilo registrados. |
| Movimiento reducido. | El estado de movimiento reducido se respeta en la comprobación de navegador. |
| Integridad del contenido y motor original. | Los siete bloques comparados coinciden con los SHA-256 de la base original. |

La comparación de contenido cubre materias y fuentes; normas y descripciones; referencias, fechas y notas; preguntas de opción múltiple; preguntas verdadero/falso; generación; y corrección y registro. La línea base verificable está en [legal-baseline.json](legal-baseline.json); la comprobación reproducible está en [verify-content.mjs](../scripts/verify-content.mjs).

## Capturas e informes

La revisión genera `artifacts/diseno-v2/verificacion.json` y `artifacts/diseno-v2/contenido.json`, con resultados, mediciones, hashes y nombres de capturas. La revisión anterior completada conserva 21 PNG reales: biblioteca, simulador y modo oscuro, en escritorio y móvil, para las tres direcciones; además, configuración de práctica en ambas pantallas y evaluación corregida en móvil para Archivo Vivo. La selección posterior de Foro no cambia qué vistas se capturaron en aquella ejecución.

Los nombres permiten localizar cada vista: `{archivo|foro|orbita}-{biblioteca|simulador|oscuro}-{escritorio|movil}.png`. Las capturas estándar usan 1280 × 1000 y 390 × 844. Se capturaron las propuestas antes de introducir los datos de prueba de perfil y favoritos. La revisión visual de las imágenes complementa las aserciones automatizadas; compilar el CSS por sí solo no acredita el resultado visual.

La carpeta de salida `artifacts/` está excluida de Git. La ejecución completada antes de la elección se conserva también en [docs/capturas](capturas/README.md) y en los informes [de interfaz](verificacion/verificacion.json) y [de contenido](verificacion/contenido.json), para revisar las evidencias desde la rama de GitHub. La [comparación visual](comparacion-visual.md) explica las ventajas y limitaciones y registra la elección de Foro por el usuario, que sustituyó la recomendación inicial de Archivo Vivo.

## Alcance y límites

- Las medidas móviles corresponden a ventanas de navegador emuladas; no equivalen a pruebas físicas en todos los teléfonos o navegadores.
- El cálculo de contraste cubre texto visible y placeholders sobre fondos sólidos. Omite decoración y casos con imágenes, degradados o transparencia de grupo; no constituye una certificación completa WCAG.
- Se prueban controles con teclado, pero no se declara una auditoría exhaustiva con lectores de pantalla.
- El listado público de GitHub se simula vacío durante la prueba para aislar la interfaz. Se comprueban pestañas, estado vacío y enlace de subida existente; no se valida una carga o descarga real de documentos externos.
- No se prueban ni se requieren backend, autenticación administrativa, almacenamiento persistente o contratación de servicios. No forman parte de este trabajo.
- La integridad de los bloques originales conserva sus contenidos; no sustituye una revisión jurídica actualizada de la legislación o la vigencia de cada enlace institucional.

## Guardado de la elección azul

El usuario eligió Foro después de la comparación. Se cambió la vista predeterminada a Foro, se eliminó la precarga de Fraunces que no usa esta dirección y se corrigió la altura mínima del editor en escritorio. Las comprobaciones de integridad y sintaxis se ejecutaron de nuevo. La última ejecución de navegador se interrumpió; los resultados y capturas anteriores no se presentan como una nueva validación de estos ajustes. El script actualizado comprueba Foro como vista predeterminada y la altura del editor cuando se vuelva a ejecutar. No se fusionó ni desplegó el cambio.
