// Pieces shared by several screens.
import { h, icon } from '../ui.js';
import * as data from '../data.js';
import { t, fmtNum, fmtSet } from '../i18n.js';

/**
 * Table of sets with a ✓ column (FitNotes/Hevy style).
 * prev[i] = the set done in the same position last time (shown as "previous").
 */
export function setTable({ sets, prev = [], prIds = new Set(), selectedId = null, onTick, onRow }) {
  const showPrev = prev.length > 0;
  return h('div', { class: 'set-table' },
    h('div', { class: 'set-hdr' }, h('span', {}, '#'), h('span', {}, showPrev ? t('previous') : ''), h('span', {}, t('kgReps')), h('span', {}, '✓')),
    sets.map((s, i) => {
      const done = data.isDone(s);
      const p = prev[Math.min(i, prev.length - 1)];
      return h('div', { class: 'srow' + (done ? ' is-done' : '') + (s.id === selectedId ? ' sel' : ''), onclick: e => { if (!e.target.closest('.tick')) onRow?.(s); } },
        h('span', { class: 'n' }, i + 1),
        h('span', { class: 'prev' }, showPrev && p ? fmtSet(p) : ''),
        h('span', { class: 'val' }, fmtNum(s.weight), h('small', {}, ' kg'), ' × ', s.reps, prIds.has(s.id) && h('span', { class: 'trophy' }, '🏆')),
        h('button', { class: 'tick', role: 'checkbox', 'aria-checked': String(done), 'aria-label': t(done ? 'markNotDone' : 'markDone'), onclick: () => onTick(s) }, icon('check')));
    }));
}

/** Coloured dots for the categories trained in a list of sets (max 4). */
export function catDots(sets) {
  const colors = [];
  for (const s of sets) {
    const c = data.getCategory(data.getExercise(s.exerciseId)?.categoryId)?.color;
    if (c && !colors.includes(c)) colors.push(c);
  }
  return h('span', { class: 'dots' }, colors.slice(0, 4).map(c => h('i', { style: { '--c': c } })));
}

/** Group sets by exercise, keeping the order in which exercises first appear. */
export function groupByExercise(sets) {
  const m = new Map();
  for (const s of sets) {
    if (!m.has(s.exerciseId)) m.set(s.exerciseId, []);
    m.get(s.exerciseId).push(s);
  }
  return m;
}
