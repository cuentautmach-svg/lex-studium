# Skills originales: procedencia, instalación y límites

Revisión realizada el 9 de noviembre de 2026. Las guías locales anteriores de Impeccable y Emil Design Engineering eran adaptaciones resumidas; no se contaron como las skills originales solicitadas. Se reemplazaron sus `SKILL.md` por texto original sin cambios.

## Fuentes verificadas

| Proyecto | Propietario y licencia | Versión fijada |
| --- | --- | --- |
| [Impeccable](https://github.com/pbakaus/impeccable) | Paul Bakaus, Apache-2.0; el repositorio y su documentación enlazan al mismo proyecto oficial | Commit `613fbf88e0ef08709eaf238653285f430250c0ea`, skill v4.8.1 |
| [Skills for Designers and Engineers](https://github.com/emilkowalski/skills) | Emil Kowalski, MIT; README identifica `emil-design-eng` como skill principal | Commit `5206a950b715e0cabe7043ea0b2304332b91494e` |

Se revisaron el README oficial de cada repositorio, el `SKILL.md` original de cada skill, [la documentación de Impeccable](https://impeccable.style/docs/), el `package.json`, el launcher y la configuración de hooks de Impeccable. El directorio original de `emil-design-eng` contiene un único archivo de instrucciones: no tiene scripts, dependencias ni hooks propios.

## Instalación realizada

**Emil Design Engineering:** copia manual completa del `skills/emil-design-eng/SKILL.md` original en `.agents/skills/emil-design-eng/SKILL.md`, con su licencia MIT adjunta. Se comprobó el frontmatter `name`/`description` y que el archivo puede abrirse y utilizarse como instrucciones. No se ejecutó el instalador `npx skills`.

**Impeccable:** copia documental parcial del build oficial para Codex: el `SKILL.md`, doce referencias pertinentes de diseño y la licencia Apache-2.0 están en `.agents/skills/impeccable/`. Se aplica como referencia original en el modo manual previsto por su fallback. **No se instaló ni ejecutó el CLI/engine, y no se activaron hooks.** Esta copia de documentos no debe describirse como una instalación completa del runtime de Impeccable.

El [README fijado de Impeccable](https://github.com/pbakaus/impeccable/blob/613fbf88e0ef08709eaf238653285f430250c0ea/README.md) documenta `.agents/skills` como ubicación de proyecto para Codex y permite la copia manual. Para su integración completa recomienda recargar la herramienta y habilitar su hook; esos pasos no se realizaron. No se verificó que el catálogo dinámico de skills de esta sesión se recargara automáticamente, por lo que no se afirma que aparezcan como comandos registrados. Las instrucciones sí se leen directamente desde sus rutas locales.

El launcher original intenta encontrar un engine y, si no existe, puede descargar un binario de una release y ejecutarlo. Los checksums están fijados en su manifest, pero se evitó incorporar ese mecanismo porque el trabajo solo necesita criterios de diseño y el usuario pide evitar ejecución automática no imprescindible. La configuración de hooks revisada ejecuta el launcher tras ediciones y al finalizar. El README también describe un fallback del modo live que puede invocar un agente con comprobaciones de aprobación desactivadas. No se copiaron ni activaron esas integraciones, y no se ejecutaron instaladores remotos.

## Verificación de integridad

`.agents/skills/original-sources.json` registra para cada archivo su repositorio, commit, ruta remota y SHA del Git blob. Se verificaron **16 archivos**: todos coinciden byte por byte con el blob original. Se preservaron también los archivos originales que terminan sin salto de línea. Las licencias completas acompañan a las instrucciones.

Se comprobó que no existe un directorio nuevo `scripts/` en la copia Impeccable. No se escribieron configuraciones `.codex/hooks.json`, `.claude`, `.cursor`, plugins, permisos elevados ni archivos de activación automática. Las skills adicionales que ya existían en el repositorio no forman parte de esta instalación ni se presentan como nuevas.

## Criterios que deben guiar el trabajo

| Fuente original | Decisión de diseño que exige o fundamenta |
| --- | --- |
| Impeccable `distill` y `quieter` | Mostrar una tarea principal; retirar información redundante, contenedores anidados y decoración que compite; mantener personalidad mediante jerarquía, espacio y un acento deliberado. |
| Impeccable modos `Operate` y `Read` | La consulta y la evaluación deben priorizar la tarea y la lectura, aunque la identidad visual siga siendo reconocible. |
| Impeccable `craft-floor` | Evitar kickers sobre los títulos; no usar métricas y anillos como sustituto del contenido; no añadir numeración sin una secuencia útil; emplear SVG coherente para iconos y verificar contraste, tipografía real y estados. |
| Impeccable `adapt`, `audit`, `typeset`, `layout` | Comprobar en navegador tamaño de texto, foco, teclado, errores, modo oscuro y puntos de ruptura. Texto normal y placeholders requieren contraste de al menos 4,5:1; el texto grande, 3:1. |
| Emil `emil-design-eng` | Decidir primero si una acción merece movimiento: nada decorativo para interacciones frecuentes ni animaciones al navegar con teclado. Feedback al pulsar entre 100 y 160 ms, transiciones de UI por debajo de 300 ms y curvas de salida con respuesta rápida. |
| Emil `emil-design-eng` | Priorizar `transform` y `opacity`, delimitar hover con `@media (hover:hover) and (pointer:fine)`, respetar movimiento reducido y usar transiciones interrumpibles. |

Las indicaciones del usuario prevalecen sobre ejemplos estéticos o procedimientos generales de las skills. Su solicitud ya identifica audiencia, función y límites, por lo que no se requieren preguntas adicionales sobre paletas o estilos. Los resultados de la implementación y sus pruebas se documentan por separado; este archivo acredita únicamente procedencia, revisión y modo de uso de las instrucciones.
