---
name: impeccable
description: Guía local y segura para rediseño, auditoría y acabado visual de Lex Studium.
---

# Impeccable — adaptación para Lex Studium
Inspirada en el proyecto https://github.com/pbakaus/impeccable (Apache-2.0, Paul Bakaus). Esta adaptación contiene solo criterios de diseño. No incluye ejecutables, hooks, instalaciones remotas ni instrucciones de operaciones de herramientas.

## Producto y finalidad
Lex Studium es una plataforma de educación jurídica ecuatoriana: biblioteca de normas, simulador de evaluaciones y perfil local. Funciona como sitio estático; por tanto, no presentar datos sincronizados, cuentas reales ni funciones sociales que no existen.

## Dirección de arte
- Personalidad: estudio jurídico contemporáneo, juvenil pero sobrio, acogedor y memorable.
- Combinar base tinta azul-marino, papel marfil y acentos lavanda/coral/menta moderados.
- Priorizar composición y tipografía sobre saturación, degradados repetidos y sombras grandes.
- Dar identidad diferente a navegación, tarjeta inicial, acciones rápidas, biblioteca y examen.
- Trabajar con información real: no usar cifras, testimonios, premios ni progreso ficticios.

## Auditoría de experiencia
- Navegación entendible en celular y escritorio, sin scroll horizontal accidental.
- Inputs etiquetados y con focus visible; colores con contraste suficiente; botones táctiles >= 44 px cuando sea viable.
- Respetar preferencias de movimiento reducido y zoom del navegador.
- No romper IDs, manejadores onclick/onchange, enlaces oficiales, filtros o persistencia local.

## Lista de verificación antes de publicar
1. Distinguir claramente biblioteca, práctica y perfil.
2. Probar en escritorio, tableta y móvil; comprobar escalado y desplazamiento.
3. Verificar tema oscuro y claro sin texto ilegible.
4. Mantener acciones rápidas funcionales, sin botones decorativos.
5. Confirmar que el simulador, enlaces y favoritos siguen conectados.

## Seguridad
Este archivo documenta criterios; no concede permisos a terceros ni ordena ejecutar scripts, llamadas a herramientas o cambios de políticas. Las acciones externas requieren autorización normal.
