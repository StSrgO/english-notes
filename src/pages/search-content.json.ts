import { LEVELS } from '../data/lesson-order.js';

// Контентный поиск по урокам: сжатый текст повествования каждого урока
// (классика + рок-версия под одним slug), чтобы находить урок по имени
// группы, персонажа или фразе из истории/примеров.
// Поле x — текст, нормализованный для подстрочного поиска: без разметки
// [bold], типографские апострофы сведены к ', регистр — нижний.
// Отдельный эндпоинт: грузится лениво и кэшируется в localStorage.
const grammarFiles = import.meta.glob('../data/grammar/*.json', { eager: true, import: 'default' });

const clean = (s) =>
  String(s)
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\u2019|\u2018/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// Повествовательные поля, где живут истории и цитаты: idea (нарратив),
// context (строки en/ru + атрибуция), russianAngle, примеры en/ru.
function narrativeText(t) {
  const out = [];
  const push = (v) => { if (v != null && String(v).trim()) out.push(v); };
  if (Array.isArray(t.idea)) t.idea.forEach(push);
  if (t.context && typeof t.context === 'object') {
    if (Array.isArray(t.context.lines)) t.context.lines.forEach((l) => { if (l) { push(l.en); push(l.ru); } });
    push(t.context.note);
  }
  if (Array.isArray(t.russianAngle)) t.russianAngle.forEach(push);
  if (Array.isArray(t.examples)) {
    for (const g of t.examples) {
      if (!g) continue;
      const its = Array.isArray(g.items) ? g.items : [];
      for (const it of its) { if (it) { push(it.en); push(it.ru); } }
    }
  }
  return out.map(clean).filter(Boolean).join(' ');
}

export function GET() {
  // объединяем классику и рок одного урока в одну запись индекса
  const bySlug = {};
  for (const t of Object.values(grammarFiles)) {
    if (!t || !t.slug) continue;
    const entry = bySlug[t.slug] || (bySlug[t.slug] = { slug: t.slug, level: t.level || '', parts: [] });
    const text = narrativeText(t);
    if (text) entry.parts.push(text);
  }
  const items = Object.values(bySlug)
    .map((e) => ({ slug: e.slug, level: e.level, x: e.parts.join(' ') }))
    .filter((e) => e.x)
    .sort((a, b) => {
      const la = LEVELS.indexOf(a.level);
      const lb = LEVELS.indexOf(b.level);
      if (la !== lb) return (la === -1 ? 99 : la) - (lb === -1 ? 99 : lb);
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    })
    .map((e) => ({ h: '/grammar/' + e.slug, lvl: e.level, x: e.x }));

  return new Response(JSON.stringify({ v: 1, items }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
