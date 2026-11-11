# Strength Log v2 — plan

Este documento es el "prompt" de la versión 2: qué se construye, por qué y en qué orden. Sirve de hoja de ruta para las próximas versiones.

## Objetivo

Que se sienta como una app de entrenamiento de verdad (referencias: FitNotes, Strong, Hevy), más llamativa y más completa, **sin perder lo principal: registrar una serie en 1–2 toques**.

## Principios de diseño

1. **Lo frecuente a un toque:**
   - marcar una serie como hecha,
   - empezar una rutina,
   - repetir un entrenamiento,
   - cambiar de día.
2. **El pulgar manda:** las acciones principales van en la mitad de abajo de la pantalla y los botones son grandes.
3. **Estado visible:**
   - qué series faltan y cuáles están hechas (✓ verde),
   - cuánto descanso queda,
   - los récords (dorado).
4. **Llamativo, no recargado:**
   - fondo oscuro con un color de acento vivo, elegible,
   - números grandes en una tipografía deportiva,
   - colores por grupo muscular,
   - animaciones cortas al completar una serie o batir un récord.
5. **Los datos nunca se pierden:** la versión 2 lee los datos de la v1 sin pasos manuales.

## Novedades

### Pedidas por ti

| # | Función | Cómo funciona |
|---|---|---|
| 1 | **Series planificadas con ✓** (como FitNotes/Hevy) | Al empezar una rutina o repetir un entrenamiento, las series aparecen planificadas (en gris). Tocas el círculo y queda ✓ "hecha". Solo las hechas cuentan para récords, gráficos e historial. |
| 2 | **Temporizador al marcar ✓** | Ajuste "Iniciar descanso al completar una serie" (activado). El tiempo se puede definir por ejercicio. |
| 3 | **Calendario con puntitos** | Pestaña nueva. Mes completo con un punto de color por grupo muscular entrenado. Al tocar un día ves todo lo que hiciste, y puedes **abrirlo** o **repetirlo**. |
| 4 | **Repetir entrenamientos ya hechos** | Desde la pantalla de hoy o el calendario: copia los ejercicios y series de ese día como series planificadas. |
| 5 | **Rutinas personalizables** | Cada ejercicio de la rutina tiene un número de series y repeticiones objetivo. Se empiezan con un toque desde la pantalla de hoy. El peso se toma de la última vez. |
| 6 | **Más llamativo** | Ver los principios de diseño. Cuatro colores de acento a elegir: Fuego, Eléctrico, Lima, Violeta. |

### Agregadas por criterio propio

| Función | Por qué |
|---|---|
| **Semana visible arriba** (7 días con puntos) | Cambiar de día sin abrir menús. |
| **Resumen del entreno de hoy** (series hechas/planificadas, volumen, duración) | Saber cuánto falta y cuánto llevas. |
| **Columna "anterior"** en cada serie | Ver lo que hiciste la vez pasada mientras entrenas (Strong/Hevy). |
| **1RM estimado** (fórmula de Epley) en récords y gráficos | El indicador estándar de progreso de fuerza. |
| **Calculadora de discos** | Saber qué discos poner en cada lado de la barra. Peso de la barra y discos configurables. |
| **Notas por ejercicio** | Por ejemplo, la altura del asiento o el agarre. FitNotes las tiene. |
| **Pestaña Progreso** | Entrenos por semana, volumen semanal, racha, récords recientes, ejercicios más hechos, **peso corporal** con gráfico y preguntas post-sesión. |
| **Vibración corta al marcar ✓** | Se nota la confirmación sin mirar la pantalla. |

### Propuestas para después

Las dejo fuera para no recargar esta versión:
- series de calentamiento y superseries,
- medidas corporales,
- avisos de descanso con la pantalla apagada (notificaciones),
- dividir rutinas por días dentro de una misma rutina.

## Navegación nueva

**Entreno · Calendario · Rutinas · Progreso · Más**

## Modelo de datos

Todos los cambios son compatibles con la v1:
- `sets.done`: si falta, la serie cuenta como hecha (así se leen las series de la v1 y de FitNotes).
- `routines.exercises: [{ id, sets, reps }]`: se genera desde `items` de la v1 (3 series por defecto).
- `exercises.note`: nota del ejercicio.
- Nuevo almacén `bodyweight { date, kg }`. La base de datos sube a la versión 2 y la migración es automática.
- Ajustes nuevos: acento, iniciar descanso al marcar ✓, peso de la barra y discos disponibles.

## Orden de trabajo (cada etapa se prueba antes de seguir)

1. Datos y migración, con pruebas automáticas.
2. Sistema visual: colores, tipografía y componentes.
3. Pantalla de entreno.
4. Pantalla de ejercicio.
5. Calendario.
6. Rutinas.
7. Progreso.
8. Prueba completa a tamaño de celular, con tus datos reales de FitNotes, y publicación.
