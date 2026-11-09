# Sistema visual en revisión

Las superficies principales combinan **Read** (buscar, entender y consultar referencias) y **Operate** (configurar y resolver una práctica). La expresión de marca se concentra en navegación, tipografía, color y un acento geométrico pequeño; la columna de lectura permanece tranquila.

## Tres direcciones

- Archivo Vivo: composición editorial, marfil, bosque y lima; Fraunces en títulos, Manrope en controles, lista de normas por separadores y navegación lateral/inferior.
- Foro: composición educativa con navegación superior, cobalto sobre superficies neutras, Manrope y una rejilla ligera de dos columnas.
- Órbita: composición de producto digital con navegación compacta, grafito y menta, tipografía sans y lista de consulta precisa.

El usuario eligió **Foro, la dirección azul**, como diseño de Lex Studium. Es la vista predeterminada; Archivo Vivo y Órbita se conservan como alternativas de comparación. La recomendación inicial de Archivo Vivo quedó sustituida por esta decisión. La selección estética no autoriza fusionar ni desplegar.

## Reglas compartidas

- Una tarea visible: búsqueda en biblioteca; un paso a la vez en simulador.
- Seis normas iniciales y ampliación por demanda. Los filtros avanzados, fechas, referencias y notas se despliegan sin eliminar información.
- Sin estadísticas de portada, etiquetas decorativas sobre encabezados ni accesos duplicados.
- Iconos SVG propios. Manrope autoalojada para Foro; Fraunces se carga solo al revisar Archivo Vivo. Ambas conservan sus licencias SIL OFL y están optimizadas para el contenido latino y español.
- Controles principales de al menos 44 px; campos de 16 px en móvil; foco visible y affordances nativas de `details`, `select` y radio.
- Texto normal y placeholders con contraste objetivo mínimo 4,5:1; títulos grandes 3:1. La medición automática acota su alcance a fondos sólidos; no implica certificación WCAG completa.
- Teclado sin animaciones. Retroalimentación de pulsación con puntero de 140 ms y cambio de paso de 180 ms; `prefers-reduced-motion` elimina el movimiento.
- El resultado de evaluaciones incluye texto de acierto/error y distingue preguntas abiertas sin cambiar el motor de puntuación.

El CSS se mantiene en `design-proposals/` y se compila a `experience.css` sin dependencias de ejecución. Las capturas reales se generan con Playwright en 360, 390, 768 y 1280 px.
