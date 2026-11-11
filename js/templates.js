// Routine templates offered in the Routines tab ("Suggested"). Same format as routine links
// (see data.addRoutinePack). No personal data here: this file is public. Body weight is
// asked when a template with bodyweight exercises is added.
// Day names used by earlier versions of a template → current names (renamed on startup).
export const TEMPLATE_RENAMES = {
  'Push Pull Arms and Legs': { 'Día 1 · Espalda y pecho': 'Day 1 · Back & Chest', 'Día 2 · Brazos y hombros': 'Day 2 · Arms & Shoulders', 'Día 3 · Piernas': 'Day 3 · Legs' },
};

export const TEMPLATES = [
  {
    id: 'ppl-al',
    pack: {
      v: 1, group: 'Push Pull Arms and Legs', replaces: ['Arms And Shoulders'],
      days: [
        { name: 'Day 1 · Back & Chest', exercises: [
          { name: 'Barbell Row', category: 'Back', sets: 3 },
          { name: 'Ring Push Up', category: 'Chest', sets: 3, bodyweight: true },
          { name: 'Pull Up', category: 'Back', sets: 3, bodyweight: true },
          { name: 'Incline Barbell Bench Press', category: 'Chest', sets: 3 },
        ] },
        { name: 'Day 2 · Arms & Shoulders', exercises: [
          { name: 'Barbell Curl', category: 'Biceps', sets: 3 },
          { name: 'Behind The Neck Band Tricep Extension', category: 'Triceps', sets: 3 },
          { name: 'Reverse Barbell Curl', category: 'Biceps', sets: 2 },
          { name: 'Dumbbell Overhead Triceps Extension', category: 'Triceps', sets: 2 },
          { name: 'Upright Row', category: 'Shoulders', sets: 3 },
          { name: 'Overhead Press', category: 'Shoulders', sets: 3 },
          { name: 'Barbell Rear Delt Row', category: 'Shoulders', sets: 2 },
        ] },
        { name: 'Day 3 · Legs', exercises: [
          { name: 'Barbell Front Squat', category: 'Legs', sets: 3 },
          { name: 'Romanian Deadlift', category: 'Legs', sets: 3 },
          { name: 'Standing Calf Raise', category: 'Legs', sets: 3, bodyweight: true },
          { name: 'Crunch', category: 'Abs', sets: 1, bodyweight: true },
        ] },
      ],
    },
  },
];
