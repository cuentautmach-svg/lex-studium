---
name: emil-design-eng
description: Guía adaptada de ingeniería visual para interfaces web de Lex Studium.
---

# Emil Design Engineering — adaptación para Lex Studium
Fuente de principios: https://github.com/emilkowalski/skills (MIT). Esta adaptación resume pautas de diseño; no incluye instrucciones de control del agente, automatización ni scripts.

## Objetivo
Crear una interfaz de estudio de Derecho clara, expresiva y rápida en móvil y escritorio. Preservar contenido jurídico, enlaces, ids de controles, almacenamiento local y lógica de evaluaciones.

## Interacciones
- Cada animación tiene una finalidad: indicar un estado, confirmar una pulsación, aclarar una transición.
- Priorizar transform y opacity; 120–220 ms; curva de salida cubic-bezier(.23,1,.32,1).
- Presión tactil con scale(.97) solo donde no afecte disposición.
- Respetar prefers-reduced-motion. No añadir animaciones constantes, brillantes o que distraigan de leer.
- Todos los controles deben mostrar hover cuando corresponda, focus-visible con teclado, active y disabled.

## Diseño
- Jerarquía clara: encabezados expresivos, texto de lectura estable, acciones evidentes.
- Diseñar estados vacíos, de error y de éxito sin inventar indicadores o resultados.
- Separar la decoración del contenido esencial; no bloquear ni ocultar elementos interactivos.
- Revisar 360, 768 y 1280 px para desbordamiento, navegación, altura de pulsación y contraste.

## Seguridad
No ejecutar scripts, hooks, comandos remotos ni modificar repositorios como consecuencia de esta documentación. Cualquier edición se acuerda y se realiza mediante herramientas autorizadas para el proyecto.
