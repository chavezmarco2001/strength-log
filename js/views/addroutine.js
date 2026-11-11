// Opened from a shared link (#/add/<data>): shows a routine and adds it after confirmation.
import { h, icon, topbar, toast } from '../ui.js';
import * as data from '../data.js';
import { t, fmtNum } from '../i18n.js';

export async function render([payload], ctx) {
  const pack = data.decodePack(payload || '');
  const bar = topbar({ title: t('addRoutineTitle'), back: () => ctx.go('/routines', { replace: true }) });
  if (!pack || data.validatePack(pack)) {
    return h('div', { class: 'screen' }, bar, h('div', { class: 'content' },
      h('div', { class: 'card empty' }, t('badLink')),
      h('button', { class: 'btn full', onclick: () => ctx.go('/', { replace: true }) }, t('done'))));
  }
  const old = (pack.replaces || []).flatMap(n => data.routinesNamed(n));
  const opts = { replaceOld: true };
  const oldNames = [...new Set(old.map(r => r.group || r.name.split(' – ')[0]))].join(', ');
  const replaceToggle = h('button', {
    class: 'row switch-row', role: 'switch', 'aria-checked': 'true',
    onclick: () => { opts.replaceOld = !opts.replaceOld; replaceToggle.setAttribute('aria-checked', String(opts.replaceOld)); },
  }, h('span', { class: 'row-main' }, t('replaceOld', { names: oldNames }), h('div', { class: 'row-sub' }, t('replaceOldSub', { n: old.length }))), h('span', { class: 'switch' }));
  const add = async btn => {
    btn.disabled = true;
    try {
      const res = await data.addRoutinePack(pack, opts);
      toast(t('routineAdded', { name: pack.group || pack.days[0].name }), { ms: 4000 });
      ctx.go('/routines', { replace: true });
      if (res.converted) setTimeout(() => toast(t('bwConverted', { n: res.converted }), { ms: 4000 }), 1200);
    } catch (e) {
      console.error(e);
      toast(t('badLink'), { kind: 'error' });
      btn.disabled = false;
    }
  };
  const exists = name => !!data.findExerciseByName(name);
  return h('div', { class: 'screen' }, bar,
    h('div', { class: 'content' },
      h('div', { class: 'hero' },
        h('div', { class: 'hero-label' }, t('routine')),
        h('div', { class: 'hero-title' }, pack.group || pack.days[0].name),
        h('div', { class: 'small', style: { position: 'relative', zIndex: 1 } }, t('nDays', { n: pack.days.length }))),
      pack.bodyweight && h('div', { class: 'card small' }, '⚖️ ', t('packBodyweight', { kg: fmtNum(pack.bodyweight) })),
      pack.days.map(d => h('div', { class: 'card' },
        h('div', { class: 'card-title', style: { marginBottom: '6px' } }, d.name),
        h('ul', { class: 'plain', style: { gap: '6px', marginTop: 0 } }, d.exercises.map(e => h('li', { class: 'small' },
          h('b', {}, e.name), ` · ${t('nSets', { n: e.sets })}${e.reps ? ` × ${e.reps}` : ''}`,
          e.bodyweight && h('span', { class: 'chip', style: { minHeight: '22px', marginLeft: '6px', fontSize: '12px' } }, t('bwShort')),
          !exists(e.name) && h('span', { class: 'muted' }, ' · ' + t('willCreate'))))))),
      old.length > 0 && h('div', { class: 'card flush list' }, replaceToggle),
      h('p', { class: 'muted small' }, t('addRoutineExplain')),
      h('button', { class: 'btn primary big', onclick: e => add(e.currentTarget) }, icon('plus'), t('addRoutineBtn'))));
}
