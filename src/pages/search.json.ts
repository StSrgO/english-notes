import { LEVELS } from '../data/lesson-order.js';

// Глобальный поиск по сайту: статический JSON-индекс, собираемый при сборке.
// Подключается клиентом (Base.astro) и фильтруется на лету.
// Формат записи: { t, lvl, title, sub, d?, href }
//   t — тип: 'g' урок грамматики · 'n' карточка заметки · 'v' словарная тема/группа
//   lvl — уровень CEFR (пусто, если нет); title/sub/d — поля поиска и показа;
//   href — ссылка на страницу (для заметок — якорь карточки).
const grammarFiles = import.meta.glob(
  ['../data/grammar/*.json', '!../data/grammar/*.rocknroll.json'],
  { eager: true, import: 'default' }
);
const cheatsFiles = import.meta.glob('../data/cheats/*.json', { eager: true, import: 'default' });
const vocabFiles = import.meta.glob('../data/vocabulary/*.json', { eager: true, import: 'default' });

// Якорь слова на странице темы: 'w-' + слаг — повторяет функцию из
// vocabulary/[slug].astro (там по этому id рендерятся строки слов).
const wSlug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function GET() {
  const items = [];

  // Уроки грамматики (рок-версии исключены glob-ом: slug у них тот же)
  for (const t of Object.values(grammarFiles)) {
    if (!t || !t.slug || !t.title) continue;
    items.push({
      t: 'g',
      lvl: t.level || '',
      title: t.title,
      sub: t.category || '',
      d: (t.summary || '').slice(0, 120),
      href: '/grammar/' + t.slug,
    });
  }

  // Карточки заметок: тема за темой по уровням, ссылка — на якорь карточки
  const byLevel = {};
  for (const f of Object.values(cheatsFiles)) {
    if (f && f.level && Array.isArray(f.topics)) byLevel[f.level] = f;
  }
  for (const lvl of LEVELS) {
    const f = byLevel[lvl];
    if (!f) continue;
    for (const topic of f.topics) {
      if (!topic || !topic.id) continue;
      items.push({
        t: 'n',
        lvl,
        title: topic.title || '',
        sub: topic.titleRu || '',
        href: '/notes/' + lvl.toLowerCase() + '#' + topic.id,
      });
    }
  }

  // Слова: темы словаря + группы тренажёра + сами слова из карточек
  // (слово ищется по любой из трёх форм и по русскому переводу; ссылка
  // ведёт на строку-карточку через якорь #w-<v1>)
  for (const v of Object.values(vocabFiles)) {
    if (!v || !v.slug || !v.title) continue;
    items.push({ t: 'v', lvl: '', title: v.title, sub: v.titleRu || '', href: '/vocabulary/' + v.slug });
    if (Array.isArray(v.groups)) {
      // имена групп в списках: у тренажёра форм — русские (типы форм),
      // у тематических тем — английские (частицы), как в меню и карточке
      const hasVerbForms = v.groups.some((g) => g.words?.some((w) => w.v1));
      for (const g of v.groups) {
        if (!g || !g.id) continue;
        items.push({
          t: 'v',
          lvl: '',
          title: hasVerbForms ? g.groupNameRu || g.groupName : g.groupName,
          sub: v.title,
          href: '/vocabulary/' + v.slug + '#' + g.id,
        });
        if (!Array.isArray(g.words)) continue;
        for (const w of g.words) {
          if (!w) continue;
          if (w.v1) {
            // тренажёр неправильных глаголов: слово ищется по любой из трёх
            // форм и по русскому переводу; ссылка — на строку #w-<v1>
            const forms = [w.v1, w.v2, w.v3].filter(Boolean);
            items.push({
              t: 'v',
              lvl: '',
              title: forms.join(' — '),
              sub: w.ru || '',
              f: forms,
              href: '/vocabulary/' + v.slug + '#w-' + w.v1,
            });
          } else if (w.en) {
            // тематическая тема: у слова одна форма (en) + перевод;
            // якорь строки — #w-<en> (в слаге, без пробелов)
            items.push({
              t: 'v',
              lvl: '',
              title: w.en,
              sub: w.ru || '',
              f: [w.en],
              href: '/vocabulary/' + v.slug + '#w-' + wSlug(w.en),
            });
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ v: 1, items }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
