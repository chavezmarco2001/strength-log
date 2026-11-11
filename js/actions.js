// What happens when a set is completed, shared by the workout and exercise screens:
// short vibration, record celebration, and the rest timer (if enabled).
import * as data from './data.js';
import * as timer from './timer.js';
import { toast, haptic } from './ui.js';
import { t } from './i18n.js';
import { toISODate } from './util.js';

export const restFor = ex => (ex?.rest != null ? ex.rest : data.settings.rest);

export function afterComplete(set, pr) {
  haptic(data.settings.vibrate, 15);
  if (pr) {
    toast(t(pr === 'weight' ? 'prWeight' : 'prReps'), { kind: 'pr', ms: 4000 });
    haptic(data.settings.vibrate, [60, 60, 60]);
  }
  if (data.settings.timerOnComplete && set.date === toISODate()) timer.startRest(restFor(data.getExercise(set.exerciseId)));
}

/** Tick / untick a set. Resolves with the record type when completing a record. */
export async function toggleDone(set) {
  if (data.isDone(set)) { await data.uncompleteSet(set); haptic(data.settings.vibrate, 8); return null; }
  const { set: done, pr } = await data.completeSet(set);
  afterComplete(done, pr);
  return pr;
}

/** Adds one more planned set to an exercise on a day, copying the last set's values. */
export async function addPlannedSet(exerciseId, date, daySets) {
  const own = daySets.filter(s => s.exerciseId === exerciseId);
  let ref = own.at(-1);
  if (!ref) ref = (await data.lastSessionSets(exerciseId, date))[0];
  await data.planSets(date, [{ exerciseId, weight: ref?.weight ?? 0, reps: ref?.reps ?? 0 }]);
}
