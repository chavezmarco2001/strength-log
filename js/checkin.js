// Post-workout check-in: 3 one-tap questions (1–10), then quick tags to tap
// (no typing needed) and an optional short note.
import { h, icon, sheet } from './ui.js';
import { t } from './i18n.js';
import * as data from './data.js';
import { CHECKIN_KEYS } from './stats.js';

/** Quick answers for "how did it go?" — stored as keys, shown via t('tag_' + key). */
export const CHECKIN_TAGS = ['strong', 'energetic', 'focused', 'goodPump', 'newPR', 'easy', 'hard', 'tired', 'lowEnergy', 'poorSleep', 'sore', 'pain', 'rushed', 'distracted'];

/** Opens the check-in for `date`. Resolves true if something was saved. */
export async function openCheckin(date) {
  const prev = (await data.getSession(date)) || { date };
  const answers = {};
  const tags = new Set(prev.tags || []);
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
          h('div', { class: 'scale' }, Array.from({ length: data.CHECKIN_SCALE }, (_, i) => i + 1).map(n =>
            h('button', { class: 'scale-btn' + (prev[q] === n ? ' prev' : ''), onclick: () => { answers[q] = n; step++; draw(); } }, String(n)))),
          h('div', { class: 'scale-labels muted small' }, h('span', {}, '1 · ' + t('low_' + q)), h('span', {}, t('high_' + q) + ' · 10')),
          h('button', { class: 'btn ghost full', onclick: () => { step++; draw(); } }, t('skip')));
      } else {
        const ta = h('textarea', { class: 'input', rows: 2, maxlength: 140, placeholder: t('notePlaceholder') });
        ta.value = note;
        const noteBox = h('div', { hidden: !note }, ta);
        const chip = k => {
          const b = h('button', { class: 'tag-chip' + (tags.has(k) ? ' on' : ''), 'aria-pressed': String(tags.has(k)) }, t('tag_' + k));
          b.addEventListener('click', () => {
            tags.has(k) ? tags.delete(k) : tags.add(k);
            b.classList.toggle('on', tags.has(k));
            b.setAttribute('aria-pressed', String(tags.has(k)));
          });
          return b;
        };
        box.replaceChildren(top,
          h('h2', { class: 'checkin-q' }, t('q_tags')),
          h('p', { class: 'muted small', style: { margin: '-6px 0 0' } }, t('tagsHint')),
          h('div', { class: 'tag-chips' }, CHECKIN_TAGS.map(chip)),
          !note && h('button', { class: 'btn ghost small', style: { alignSelf: 'flex-start' }, onclick: e => { noteBox.hidden = false; e.currentTarget.remove(); ta.focus(); } }, icon('note', 16), t('addNoteOptional')),
          noteBox,
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn big', onclick: () => close('done') }, t('skip')),
            h('button', { class: 'btn big primary', onclick: () => { note = ta.value.trim(); close('save'); } }, t('save'))));
      }
    };
    draw();
    return box;
  });

  if (!result) return false; // dismissed by tapping outside: nothing changes
  const s = { ...prev, ...answers, scale: data.CHECKIN_SCALE, finishedAt: prev.finishedAt || Date.now() };
  if (result === 'save') {
    if (tags.size) s.tags = CHECKIN_TAGS.filter(k => tags.has(k)); else delete s.tags;
    if (note) s.note = note; else delete s.note;
  }
  await data.saveSession(s);
  return true;
}
