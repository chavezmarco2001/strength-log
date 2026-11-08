// Texts in English (US) and Latin American Spanish, plus number/date formatting.
import { toISODate, addDays, parseISODate, pad } from './util.js';

const LOCALES = { en: 'en-US', es: 'es-419' };

export const dict = {
  en: {
    // navigation & common
    nav_workout: 'Workout', nav_history: 'History', nav_routines: 'Routines', nav_more: 'More',
    back: 'Back', menu: 'Menu', cancel: 'Cancel', ok: 'OK', save: 'Save', create: 'Create', delete: 'Delete',
    deleted: 'Deleted', saved: 'Saved', undo: 'Undo', done: 'Done', start: 'Start', remove: 'Remove',
    showMore: 'Show more', later: 'Later', error: 'Something went wrong.', reload: 'Reload',
    updateReady: 'A new version is ready.',
    today: 'Today', yesterday: 'Yesterday', tomorrow: 'Tomorrow',
    agoToday: 'today', agoYesterday: 'yesterday', agoDays: '{n} days ago',
    off: 'Off',

    // workout day
    prevDay: 'Previous day', nextDay: 'Next day', goToday: 'Go to today',
    addExercise: 'Add exercise', notStarted: 'Not started yet',
    emptyToday: 'Nothing logged today yet.', emptyDay: 'No workout this day.',
    finishWorkout: 'Finish workout', workoutFinished: 'Workout finished', editCheckin: 'Edit check-in',
    startRoutine: 'Start a routine', saveAsRoutine: 'Save as routine', routineSaved: 'Routine saved',
    defaultRoutineName: 'Workout {date}', fromRoutine: 'Routine: {name}', nExercises: '{n} exercises',
    backupNever: 'You have never made a backup.', backupOld: 'Last backup {n} days ago.', backupNow: 'Back up',

    // picker & library
    searchExercises: 'Search exercises', recent: 'Recent', categories: 'Categories', noResults: 'No matches.',
    newExercise: 'New exercise', editExercise: 'Edit exercise', exerciseName: 'Name', category: 'Category',
    exerciseExists: 'That exercise already exists.', addToRoutine: 'Add to routine',
    library: 'Exercise library', librarySub: '{n} exercises', newCategory: 'New category', categoryName: 'Name',
    renameCategory: 'Rename category', deleteCategory: 'Delete category', categoryNotEmpty: 'Move or delete its exercises first.',
    deleteExercise: 'Delete exercise', deleteExerciseConfirm: 'Delete “{name}”?',
    deleteExerciseConfirmSets: 'Delete “{name}” and its {n} logged sets? This cannot be undone.',

    // logging
    tab_track: 'Track', tab_history: 'History', tab_graph: 'Graph',
    weightKg: 'Weight (kg)', reps: 'Reps', repsShort: 'reps', weight: 'Weight', date: 'Date',
    decrease: 'Decrease', increase: 'Increase',
    update: 'Update', cancelEdit: 'Cancel edit', copySet: 'Repeat this set',
    invalidSet: 'Enter a weight (0 or more) and whole reps.',
    lastTime: 'Last time · {date}', firstTime: 'First time doing this exercise.',
    todaySets: 'Today', setHint: 'Tap a set to edit or delete it. ⧉ repeats it.',
    setDeleted: 'Set deleted',
    prWeight: '🏆 New record: heaviest weight!', prReps: '🏆 New record: most reps at this weight!',
    prWeightShort: 'Heaviest weight record', prRepsShort: 'Reps record at this weight',
    restTimer: 'Rest timer', restDefault: 'Default ({v})', useDefault: 'Use default ({v})',

    // exercise history & graph
    noHistory: 'No sets logged for this exercise yet.', volumeShort: 'Volume {v} kg',
    maxWeight: 'Max weight', volume: 'Volume', range3m: '3 months', range1y: '1 year', rangeAll: 'All',
    noDataRange: 'No data in this period.', records: 'Records', heaviest: 'Heaviest set', bestVolume: 'Best day (volume)',
    repRecords: 'Best reps per weight', bestReps: 'Best reps',

    // timer
    restOver: 'Rest over', minus15: 'Minus 15 seconds', plus15: 'Plus 15 seconds', stopTimer: 'Stop timer',

    // check-in
    q_mood: 'How is your mood?', q_motivation: 'How motivated did you feel?', q_satisfaction: 'How satisfied are you with this workout?',
    low_mood: 'Very low', high_mood: 'Great', low_motivation: 'Not at all', high_motivation: 'Very',
    low_satisfaction: 'Not at all', high_satisfaction: 'Very',
    q_note: 'Anything to note? (optional)', notePlaceholder: 'Short note…',
    skip: 'Skip', skipAll: 'Skip all',
    mood: 'Mood', motivation: 'Motivation', satisfaction: 'Satisfaction',
    checkins: 'Check-ins by week', checkinsSub: 'Mood, motivation and satisfaction',
    checkinsExplain: 'Weekly averages of your post-workout answers (1–5). Tap the chart to read a week.',
    noCheckins: 'No check-ins yet. Tap “Finish workout” after training to answer them.',
    week: 'Week', weekOf: 'Week of {date}', notes: 'Notes',

    // history
    noWorkouts: 'No workouts yet.', nSets: '{n} sets', nSets_one: '1 set', nExercises_one: '1 exercise', agoDays_one: '1 day ago', backupOld_one: 'Last backup 1 day ago.', historyStats: 'This week: {week} · Total: {total} workouts',

    // routines
    newRoutine: 'New routine', routineName: 'Routine name', renameRoutine: 'Rename routine',
    noRoutines: 'No routines yet. Create one here, or open the ⋮ menu on a workout and choose “Save as routine”.',
    noExercisesYet: 'No exercises yet.', startThisRoutine: 'Start this routine', deleteRoutine: 'Delete routine',
    deleteRoutineConfirm: 'Delete routine “{name}”? Your logged sets are kept.', moveUp: 'Move up', moveDown: 'Move down',

    // more: backup
    backup: 'Backup', lastBackupNever: '⚠️ No backup yet', lastBackupAgo: 'Last backup: {when}',
    backupExplain: 'Your data lives only on this phone. If browser data is cleared or the phone is lost, it is gone. Save a backup every week and keep a copy off the phone (Drive, email).',
    saveBackup: 'Save backup (JSON)', shareBackup: 'Share backup to Drive, email…',
    exportSetsCSV: 'Sets CSV', exportCheckinsCSV: 'Check-ins CSV',
    restoreBackup: 'Restore from backup…', backupSaved: 'Backup saved to Downloads.', backupShared: 'Backup shared.',
    csvSaved: 'CSV saved to Downloads.', badBackup: 'That file is not a Strength Log backup.',
    restoreConfirm: 'Replace ALL data on this phone with the backup from {date} ({sets} sets)?',
    restore: 'Replace data', restored: 'Backup restored.',

    // more: import
    importSection: 'Import', importExplain: 'Bring your history from FitNotes: pick its backup file (.fitnotes) or a CSV export. Importing the same file twice does not duplicate sets.',
    importFitNotes: 'Import from FitNotes…', viewLastImport: 'View last import report',
    importFromFitNotes: 'Import from FitNotes', importing: 'Importing…',
    backupExtras: 'Also: your exercise library ({lib} exercises) and {routines} routines.',
    includeIncomplete: 'Include {n} sets not marked as done', includeIncompleteSub: 'FitNotes has them, but they were never ticked as completed (maybe planned and not done).',
    removeBuiltins: 'Remove built-in exercises I never used', removeBuiltinsSub: 'Keeps your library like in FitNotes, without duplicates.',
    useFitnotesRest: 'Use your FitNotes rest time ({v})', useFitnotesRestSub: 'Instead of the current {v}.',
    backupUnreadable: 'Could not read “{name}”. The file may be damaged or incomplete. Try exporting it again from FitNotes.',
    notFitnotesDb: '“{name}” is a database, but not a FitNotes backup.',
    setsInFile: 'Sets in the backup', setsNotImported: 'Sets not imported', setNo: 'FitNotes set #{n}',
    routinesCreated: 'Routines created', routinesExisting: 'Routines already in the app (kept as they are)',
    builtinsRemoved: 'Unused built-in exercises removed',
    nonWeightNotImported: '{n} cardio or time-based exercises from your FitNotes library were not imported (not supported yet).',
    commentsNotImported: '{n} FitNotes comments were not imported.',
    skip_notComplete: 'not marked as done in FitNotes',
    csvBadColumns: 'Could not find the Date, Exercise and Reps columns. Columns found: {cols}', csvEmpty: 'The file is empty.',
    csvSummary: 'Found {sets} sets of {ex} exercises, from {from} to {to}. Import them?',
    csvSkippedWarn: '{n} rows could not be read; you will see them in the report.',
    csvIsZip: '“{name}” is a compressed or Excel file. Export from FitNotes as CSV and pick that file.',
    csvIsJson: '“{name}” looks like a Strength Log backup. Use “Restore from backup…” for that.',
    backupIsCsv: '“{name}” is not a Strength Log backup. To bring in FitNotes data, use “Import FitNotes CSV…” below.',
    csvDateAssumed: 'Dates like 03/04 were read as day/month.', csvLbs: 'Weights are in pounds and will be converted to kg.',
    import: 'Import', importReport: 'Import report', noImport: 'No import yet.',
    rowsRead: 'Rows in file', setsImported: 'Sets imported', duplicatesSkipped: 'Already in the app (skipped)',
    rowsNotRead: 'Rows not imported', dateRange: 'Dates', line: 'Line {n}', moreRowsNotShown: '…and {n} more not shown.',
    mergedSpellings: 'Names merged (same name, different spelling)', matchedExercises: 'Matched to existing exercises',
    createdExercises: 'New exercises created', createdCategories: 'New categories created',
    skip_noExercise: 'no exercise name', skip_badDate: 'unreadable date', skip_cardio: 'cardio/time entry (not supported yet)',
    skip_noReps: 'no reps', skip_badReps: 'reps are not a whole number', skip_badWeight: 'unreadable weight',
    skip_negativeWeight: 'negative weight (assisted exercise)',

    // more: settings
    progress: 'Progress', settings: 'Settings', language: 'Language', theme: 'Theme',
    themeDark: 'Dark', themeLight: 'Light', themeSystem: 'System', weightStep: 'Weight − / + step',
    defaultRest: 'Default rest time', defaultRestSub: 'Starts after each saved set', sound: 'Sound when rest ends',
    vibration: 'Vibrate when rest ends', testAlarm: 'Test sound and vibration', keepAwake: 'Keep screen on',
    keepAwakeSub: 'While logging and during rest',
    storage: 'Storage', storageCounts: '{sets} sets in {days} workouts', storageUsed: '{mb} MB used',
    persistedYes: 'Storage is protected from automatic cleanup.', persistedNo: 'The browser may clear this data if the phone runs low on space — keep backups.',
  },

  es: {
    nav_workout: 'Entreno', nav_history: 'Historial', nav_routines: 'Rutinas', nav_more: 'Más',
    back: 'Volver', menu: 'Menú', cancel: 'Cancelar', ok: 'OK', save: 'Guardar', create: 'Crear', delete: 'Borrar',
    deleted: 'Borrado', saved: 'Guardado', undo: 'Deshacer', done: 'Listo', start: 'Empezar', remove: 'Quitar',
    showMore: 'Ver más', later: 'Después', error: 'Algo salió mal.', reload: 'Recargar',
    updateReady: 'Hay una versión nueva lista.',
    today: 'Hoy', yesterday: 'Ayer', tomorrow: 'Mañana',
    agoToday: 'hoy', agoYesterday: 'ayer', agoDays: 'hace {n} días',
    off: 'Apagado',

    prevDay: 'Día anterior', nextDay: 'Día siguiente', goToday: 'Ir a hoy',
    addExercise: 'Agregar ejercicio', notStarted: 'Aún sin empezar',
    emptyToday: 'Todavía no registras nada hoy.', emptyDay: 'No entrenaste este día.',
    finishWorkout: 'Terminar entrenamiento', workoutFinished: 'Entrenamiento terminado', editCheckin: 'Editar preguntas',
    startRoutine: 'Empezar una rutina', saveAsRoutine: 'Guardar como rutina', routineSaved: 'Rutina guardada',
    defaultRoutineName: 'Entreno {date}', fromRoutine: 'Rutina: {name}', nExercises: '{n} ejercicios',
    backupNever: 'Nunca has hecho un respaldo.', backupOld: 'Último respaldo hace {n} días.', backupNow: 'Respaldar',

    searchExercises: 'Buscar ejercicios', recent: 'Recientes', categories: 'Categorías', noResults: 'Sin resultados.',
    newExercise: 'Nuevo ejercicio', editExercise: 'Editar ejercicio', exerciseName: 'Nombre', category: 'Categoría',
    exerciseExists: 'Ese ejercicio ya existe.', addToRoutine: 'Agregar a la rutina',
    library: 'Biblioteca de ejercicios', librarySub: '{n} ejercicios', newCategory: 'Nueva categoría', categoryName: 'Nombre',
    renameCategory: 'Renombrar categoría', deleteCategory: 'Borrar categoría', categoryNotEmpty: 'Primero mueve o borra sus ejercicios.',
    deleteExercise: 'Borrar ejercicio', deleteExerciseConfirm: '¿Borrar «{name}»?',
    deleteExerciseConfirmSets: '¿Borrar «{name}» y sus {n} series registradas? No se puede deshacer.',

    tab_track: 'Registrar', tab_history: 'Historial', tab_graph: 'Gráfico',
    weightKg: 'Peso (kg)', reps: 'Repeticiones', repsShort: 'reps', weight: 'Peso', date: 'Fecha',
    decrease: 'Bajar', increase: 'Subir',
    update: 'Actualizar', cancelEdit: 'Cancelar edición', copySet: 'Repetir esta serie',
    invalidSet: 'Ingresa un peso (0 o más) y repeticiones enteras.',
    lastTime: 'La última vez · {date}', firstTime: 'Primera vez con este ejercicio.',
    todaySets: 'Hoy', setHint: 'Toca una serie para editarla o borrarla. ⧉ la repite.',
    setDeleted: 'Serie borrada',
    prWeight: '🏆 ¡Récord nuevo: mayor peso!', prReps: '🏆 ¡Récord nuevo: más repeticiones con este peso!',
    prWeightShort: 'Récord de peso', prRepsShort: 'Récord de repeticiones con este peso',
    restTimer: 'Descanso', restDefault: 'Por defecto ({v})', useDefault: 'Usar el de por defecto ({v})',

    noHistory: 'Aún no hay series de este ejercicio.', volumeShort: 'Volumen {v} kg',
    maxWeight: 'Peso máximo', volume: 'Volumen', range3m: '3 meses', range1y: '1 año', rangeAll: 'Todo',
    noDataRange: 'Sin datos en este período.', records: 'Récords', heaviest: 'Serie más pesada', bestVolume: 'Mejor día (volumen)',
    repRecords: 'Mejores repeticiones por peso', bestReps: 'Mejor reps',

    restOver: 'Terminó el descanso', minus15: 'Menos 15 segundos', plus15: 'Más 15 segundos', stopTimer: 'Detener',

    q_mood: '¿Cómo está tu ánimo?', q_motivation: '¿Cuánta motivación sentiste?', q_satisfaction: '¿Cuánta satisfacción te dejó el entreno?',
    low_mood: 'Muy bajo', high_mood: 'Excelente', low_motivation: 'Nada', high_motivation: 'Mucho',
    low_satisfaction: 'Nada', high_satisfaction: 'Mucho',
    q_note: '¿Algo que anotar? (opcional)', notePlaceholder: 'Nota corta…',
    skip: 'Saltar', skipAll: 'Saltar todo',
    mood: 'Ánimo', motivation: 'Motivación', satisfaction: 'Satisfacción',
    checkins: 'Preguntas por semana', checkinsSub: 'Ánimo, motivación y satisfacción',
    checkinsExplain: 'Promedio semanal de tus respuestas post-entreno (1–5). Toca el gráfico para ver una semana.',
    noCheckins: 'Aún no hay respuestas. Toca «Terminar entrenamiento» al final para contestarlas.',
    week: 'Semana', weekOf: 'Semana del {date}', notes: 'Notas',

    noWorkouts: 'Aún no hay entrenamientos.', nSets: '{n} series', nSets_one: '1 serie', nExercises_one: '1 ejercicio', agoDays_one: 'hace 1 día', backupOld_one: 'Último respaldo hace 1 día.', historyStats: 'Esta semana: {week} · Total: {total} entrenamientos',

    newRoutine: 'Nueva rutina', routineName: 'Nombre de la rutina', renameRoutine: 'Renombrar rutina',
    noRoutines: 'Aún no hay rutinas. Crea una aquí, o abre el menú ⋮ de un entrenamiento y elige «Guardar como rutina».',
    noExercisesYet: 'Sin ejercicios aún.', startThisRoutine: 'Empezar esta rutina', deleteRoutine: 'Borrar rutina',
    deleteRoutineConfirm: '¿Borrar la rutina «{name}»? Tus series registradas se mantienen.', moveUp: 'Subir', moveDown: 'Bajar',

    backup: 'Respaldo', lastBackupNever: '⚠️ Aún no hay respaldo', lastBackupAgo: 'Último respaldo: {when}',
    backupExplain: 'Tus datos viven solo en este celular. Si se borran los datos del navegador o pierdes el teléfono, se pierden. Guarda un respaldo cada semana y deja una copia fuera del celular (Drive, correo).',
    saveBackup: 'Guardar respaldo (JSON)', shareBackup: 'Compartir respaldo a Drive, correo…',
    exportSetsCSV: 'CSV de series', exportCheckinsCSV: 'CSV de preguntas',
    restoreBackup: 'Restaurar desde respaldo…', backupSaved: 'Respaldo guardado en Descargas.', backupShared: 'Respaldo compartido.',
    csvSaved: 'CSV guardado en Descargas.', badBackup: 'Ese archivo no es un respaldo de Strength Log.',
    restoreConfirm: '¿Reemplazar TODOS los datos de este celular por el respaldo del {date} ({sets} series)?',
    restore: 'Reemplazar datos', restored: 'Respaldo restaurado.',

    importSection: 'Importar', importExplain: 'Trae tu historial desde FitNotes: elige su archivo de respaldo (.fitnotes) o un CSV exportado. Importar el mismo archivo dos veces no duplica series.',
    importFitNotes: 'Importar desde FitNotes…', viewLastImport: 'Ver informe de la última importación',
    importFromFitNotes: 'Importar desde FitNotes', importing: 'Importando…',
    backupExtras: 'Además: tu biblioteca de ejercicios ({lib} ejercicios) y {routines} rutinas.',
    includeIncomplete: 'Incluir {n} series no marcadas como hechas', includeIncompleteSub: 'Están en FitNotes, pero nunca se marcaron como completadas (quizás planificadas y no hechas).',
    removeBuiltins: 'Quitar los ejercicios incluidos que nunca usé', removeBuiltinsSub: 'Deja tu biblioteca como en FitNotes, sin duplicados.',
    useFitnotesRest: 'Usar tu descanso de FitNotes ({v})', useFitnotesRestSub: 'En vez del actual de {v}.',
    backupUnreadable: 'No pude leer «{name}». Puede estar dañado o incompleto. Prueba exportarlo de nuevo desde FitNotes.',
    notFitnotesDb: '«{name}» es una base de datos, pero no un respaldo de FitNotes.',
    setsInFile: 'Series en el respaldo', setsNotImported: 'Series no importadas', setNo: 'Serie #{n} de FitNotes',
    routinesCreated: 'Rutinas creadas', routinesExisting: 'Rutinas que ya estaban en la app (se dejaron igual)',
    builtinsRemoved: 'Ejercicios incluidos sin uso eliminados',
    nonWeightNotImported: '{n} ejercicios de cardio o por tiempo de tu biblioteca de FitNotes no se importaron (aún no soportados).',
    commentsNotImported: '{n} comentarios de FitNotes no se importaron.',
    skip_notComplete: 'no marcada como hecha en FitNotes',
    csvBadColumns: 'No encontré las columnas de fecha, ejercicio y repeticiones. Columnas encontradas: {cols}', csvEmpty: 'El archivo está vacío.',
    csvSummary: 'Encontré {sets} series de {ex} ejercicios, del {from} al {to}. ¿Importarlas?',
    csvSkippedWarn: '{n} filas no se pudieron leer; las verás en el informe.',
    csvIsZip: '«{name}» es un archivo comprimido o de Excel. Exporta desde FitNotes como CSV y elige ese archivo.',
    csvIsJson: '«{name}» parece un respaldo de Strength Log. Para eso usa «Restaurar desde respaldo…».',
    backupIsCsv: '«{name}» no es un respaldo de Strength Log. Para traer datos de FitNotes usa «Importar CSV de FitNotes…», más abajo.',
    csvDateAssumed: 'Las fechas tipo 03/04 se leyeron como día/mes.', csvLbs: 'Los pesos están en libras y se convertirán a kg.',
    import: 'Importar', importReport: 'Informe de importación', noImport: 'Aún no has importado nada.',
    rowsRead: 'Filas en el archivo', setsImported: 'Series importadas', duplicatesSkipped: 'Ya estaban en la app (omitidas)',
    rowsNotRead: 'Filas no importadas', dateRange: 'Fechas', line: 'Línea {n}', moreRowsNotShown: '…y {n} más que no se muestran.',
    mergedSpellings: 'Nombres unidos (mismo nombre, distinta escritura)', matchedExercises: 'Unidos a ejercicios existentes',
    createdExercises: 'Ejercicios nuevos creados', createdCategories: 'Categorías nuevas creadas',
    skip_noExercise: 'sin nombre de ejercicio', skip_badDate: 'fecha ilegible', skip_cardio: 'registro de cardio/tiempo (aún no soportado)',
    skip_noReps: 'sin repeticiones', skip_badReps: 'las repeticiones no son un número entero', skip_badWeight: 'peso ilegible',
    skip_negativeWeight: 'peso negativo (ejercicio asistido)',

    progress: 'Progreso', settings: 'Ajustes', language: 'Idioma', theme: 'Tema',
    themeDark: 'Oscuro', themeLight: 'Claro', themeSystem: 'Sistema', weightStep: 'Paso de − / + en el peso',
    defaultRest: 'Descanso por defecto', defaultRestSub: 'Parte tras cada serie guardada', sound: 'Sonido al terminar el descanso',
    vibration: 'Vibrar al terminar el descanso', testAlarm: 'Probar sonido y vibración', keepAwake: 'Mantener la pantalla encendida',
    keepAwakeSub: 'Mientras registras y durante el descanso',
    storage: 'Almacenamiento', storageCounts: '{sets} series en {days} entrenamientos', storageUsed: '{mb} MB usados',
    persistedYes: 'El almacenamiento está protegido de la limpieza automática.', persistedNo: 'El navegador podría borrar estos datos si el celular se queda sin espacio: haz respaldos.',
  },
};

let lang = 'en';
export const getLang = () => lang;
export function setLang(l) {
  lang = dict[l] ? l : 'en';
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

export function t(key, vars) {
  if (vars?.n === 1 && (dict[lang][key + '_one'] ?? dict.en[key + '_one'])) key += '_one';
  let s = dict[lang][key] ?? dict.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return s;
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
export const fmtNum = (n, max = 2) => new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: max, minimumFractionDigits: 0 }).format(n);
export const fmtW = w => fmtNum(w) + ' kg';
export const fmtSet = s => `${fmtNum(s.weight)} × ${s.reps}`;
export const fmtDate = (iso, opts) => parseISODate(iso).toLocaleDateString(LOCALES[lang], opts);
export const fmtShort = iso => fmtDate(iso, { month: 'short', day: 'numeric' });
/** Short date, adding the year only when it is not the current year. */
export const fmtShortY = iso => fmtDate(iso, iso.slice(0, 4) === String(new Date().getFullYear()) ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
export const fmtLong = iso => cap(fmtDate(iso, { weekday: 'short', month: 'short', day: 'numeric', year: iso.slice(0, 4) === String(new Date().getFullYear()) ? undefined : 'numeric' }));
export function fmtDayTitle(iso) {
  const today = toISODate();
  if (iso === today) return t('today');
  if (iso === addDays(today, -1)) return t('yesterday');
  if (iso === addDays(today, 1)) return t('tomorrow');
  return cap(fmtDate(iso, { weekday: 'long' }));
}
export const fmtRest = s => (s === 0 ? t('off') : s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${pad(s % 60)} min`);
export function fmtAgo(ms) {
  const days = Math.round((parseISODate(toISODate()) - parseISODate(toISODate(new Date(ms)))) / 86400000);
  return days <= 0 ? t('agoToday') : days === 1 ? t('agoYesterday') : t('agoDays', { n: days });
}
