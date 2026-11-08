// Post-workout check-in: 3 one-tap questions (1–5) + an optional short note.
import { h, sheet } from './ui.js';
import { t } from './i18n.js';
import * as data from './data.js';
import { CHECKIN_KEYS } from './stats.js';

/** Opens the check-in for `date`. Resolves true if something was saved. */
export async function openCheckin(date) {
  const prev = (await data.getSession(date)) || { date };
  const answers = {};
  let note = prev.note || '';
  let step = 0;
  const steps = CHECKIN_KEYS.length + 1;

  const result = await sheet(close => {
    const box = h('div', { class: 'checkin' });
    const draw = () => {
      const top = h('div', { class: 'checkin-top' },
        h('span', { class: 'muted small' }, `${step + 1} / ${steps}`),
        h('button', { class: 'btn ghost small', onclick: () => close('done') }, t('skipAll')));
      if (step < CHECKIN_KEYS.length) {
        const q = CHECKIN_KEYS[step];
        box.replaceChildren(top,
          h('h2', { class: 'checkin-q' }, t('q_' + q)),
          h('div', { class: 'scale' }, [1, 2, 3, 4, 5].map(n =>
            h('button', { class: 'scale-btn' + (prev[q] === n ? ' prev' : ''), onclick: () => { answers[q] = n; step++; draw(); } }, String(n)))),
          h('div', { class: 'scale-labels muted small' }, h('span', {}, t('low_' + q)), h('span', {}, t('high_' + q))),
          h('button', { class: 'btn ghost full', onclick: () => { step++; draw(); } }, t('skip')));
      } else {
        const ta = h('textarea', { class: 'input', rows: 3, maxlength: 140, placeholder: t('notePlaceholder') });
        ta.value = note;
        box.replaceChildren(top,
          h('h2', { class: 'checkin-q' }, t('q_note')),
          ta,
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn big', onclick: () => close('done') }, t('skip')),
            h('button', { class: 'btn big primary', onclick: () => { note = ta.value.trim(); close('done'); } }, t('save'))));
      }
    };
    draw();
    return box;
  });

  if (result !== 'done') return false; // dismissed by tapping outside: nothing changes
  const s = { ...prev, ...answers, finishedAt: prev.finishedAt || Date.now() };
  if (note) s.note = note; else delete s.note;
  await data.saveSession(s);
  return true;
}
