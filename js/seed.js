// Built-in exercise library (English / Latin American Spanish).
export const PALETTE = ['#e5534b', '#4f9cff', '#f0a020', '#a371f7', '#db61a2', '#3ccf7a', '#2bb6c4', '#c9a227', '#8b949e', '#ff7b72'];

export const SEED_CATEGORIES = [
  { id: 'c-chest', name: 'Chest', nameEs: 'Pecho', color: '#e5534b', order: 1 },
  { id: 'c-back', name: 'Back', nameEs: 'Espalda', color: '#4f9cff', order: 2 },
  { id: 'c-shoulders', name: 'Shoulders', nameEs: 'Hombros', color: '#f0a020', order: 3 },
  { id: 'c-biceps', name: 'Biceps', nameEs: 'Bíceps', color: '#a371f7', order: 4 },
  { id: 'c-triceps', name: 'Triceps', nameEs: 'Tríceps', color: '#db61a2', order: 5 },
  { id: 'c-legs', name: 'Legs', nameEs: 'Piernas', color: '#3ccf7a', order: 6 },
  { id: 'c-abs', name: 'Abs', nameEs: 'Abdominales', color: '#2bb6c4', order: 7 },
];

const LIST = [
  ['c-chest', 'Flat Barbell Bench Press', 'Press de banca plano con barra'],
  ['c-chest', 'Incline Barbell Bench Press', 'Press inclinado con barra'],
  ['c-chest', 'Flat Dumbbell Bench Press', 'Press plano con mancuernas'],
  ['c-chest', 'Incline Dumbbell Bench Press', 'Press inclinado con mancuernas'],
  ['c-chest', 'Dumbbell Fly', 'Aperturas con mancuernas'],
  ['c-chest', 'Cable Crossover', 'Cruce de poleas'],
  ['c-chest', 'Machine Chest Press', 'Press de pecho en máquina'],
  ['c-chest', 'Push-Up', 'Flexiones de brazos'],
  ['c-chest', 'Chest Dip', 'Fondos para pecho'],
  ['c-back', 'Deadlift', 'Peso muerto'],
  ['c-back', 'Barbell Row', 'Remo con barra'],
  ['c-back', 'Dumbbell Row', 'Remo con mancuerna'],
  ['c-back', 'Pull-Up', 'Dominadas'],
  ['c-back', 'Chin-Up', 'Dominadas supinas'],
  ['c-back', 'Lat Pulldown', 'Jalón al pecho'],
  ['c-back', 'Seated Cable Row', 'Remo sentado en polea'],
  ['c-back', 'T-Bar Row', 'Remo en barra T'],
  ['c-back', 'Barbell Shrug', 'Encogimientos con barra'],
  ['c-shoulders', 'Overhead Press', 'Press militar'],
  ['c-shoulders', 'Seated Dumbbell Shoulder Press', 'Press de hombros con mancuernas'],
  ['c-shoulders', 'Lateral Raise', 'Elevaciones laterales'],
  ['c-shoulders', 'Front Raise', 'Elevaciones frontales'],
  ['c-shoulders', 'Rear Delt Fly', 'Pájaros (deltoide posterior)'],
  ['c-shoulders', 'Face Pull', 'Face pull'],
  ['c-biceps', 'Barbell Curl', 'Curl con barra'],
  ['c-biceps', 'Dumbbell Curl', 'Curl con mancuernas'],
  ['c-biceps', 'Hammer Curl', 'Curl martillo'],
  ['c-biceps', 'Preacher Curl', 'Curl predicador'],
  ['c-biceps', 'Cable Curl', 'Curl en polea'],
  ['c-triceps', 'Close-Grip Bench Press', 'Press de banca agarre cerrado'],
  ['c-triceps', 'Triceps Pushdown', 'Extensión de tríceps en polea'],
  ['c-triceps', 'Overhead Triceps Extension', 'Extensión de tríceps sobre la cabeza'],
  ['c-triceps', 'Skull Crusher', 'Press francés'],
  ['c-triceps', 'Triceps Dip', 'Fondos para tríceps'],
  ['c-legs', 'Barbell Squat', 'Sentadilla con barra'],
  ['c-legs', 'Front Squat', 'Sentadilla frontal'],
  ['c-legs', 'Leg Press', 'Prensa de piernas'],
  ['c-legs', 'Romanian Deadlift', 'Peso muerto rumano'],
  ['c-legs', 'Leg Extension', 'Extensión de cuádriceps'],
  ['c-legs', 'Leg Curl', 'Curl femoral'],
  ['c-legs', 'Bulgarian Split Squat', 'Sentadilla búlgara'],
  ['c-legs', 'Walking Lunge', 'Zancadas'],
  ['c-legs', 'Hip Thrust', 'Hip thrust'],
  ['c-legs', 'Standing Calf Raise', 'Elevación de talones de pie'],
  ['c-legs', 'Seated Calf Raise', 'Elevación de talones sentado'],
  ['c-abs', 'Crunch', 'Abdominales (crunch)'],
  ['c-abs', 'Cable Crunch', 'Crunch en polea'],
  ['c-abs', 'Hanging Leg Raise', 'Elevación de piernas colgado'],
  ['c-abs', 'Ab Wheel Rollout', 'Rueda abdominal'],
];

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Done with body weight (+ optional extra weight)
const BODYWEIGHT = new Set(['Push-Up', 'Chest Dip', 'Pull-Up', 'Chin-Up', 'Triceps Dip', 'Crunch', 'Hanging Leg Raise', 'Ab Wheel Rollout']);
export const SEED_EXERCISES = LIST.map(([categoryId, name, nameEs]) => ({ id: 'x-' + slug(name), name, nameEs, categoryId, ...(BODYWEIGHT.has(name) ? { type: 'bodyweight' } : {}) }));
