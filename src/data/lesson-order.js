// Единый методический порядок уроков по уровням (CEFR-аудит 2026-08-29)
// Используется каталогом (index.astro) и навигацией «следующий/предыдущий урок» ([slug].astro)
export const LEVEL_ORDER = {
  'A0': [
    'a0-alphabet-pronunciation',
    'a0-introductions-greetings',
    'a0-family-house',
    'a0-symbols-abbreviations'
  ],
  'A1': [
    'a1-verb-to-be',
    'a1-pronouns',
    'a1-nouns',
    'a1-plural-nouns',
    'a1-articles-a-an',
    'a1-there-is-there-are',
    'a1-numbers-dates-time',
    'a1-colours-clothes',
    'a1-present-simple',
    'a1-imperative-and-frequency',
    'a1-present-continuous',
    'a1-past-simple',
    'a1-questions'
  ],
  'A2': [
    'a2-articles',
    'a2-comparatives-superlatives',
    'a2-prepositions-in-on-at',
    'a2-some-any-much-many',
    'a2-past-continuous',
    'a2-be-going-to',
    'a2-future-simple',
    'a2-modals-can-must-have-to'
  ],
  'B1': [
    'b1-zero-conditional',
    'b1-first-conditional',
    'b1-second-conditional',
    'b1-used-to',
    'b1-present-perfect',
    'b1-past-perfect',
    'b1-passive-voice-simple',
    'b1-modals-should-might-may',
    'b1-gerund-vs-infinitive',
    'b1-reported-speech'
  ],
  'B2': [
    'b2-present-perfect-continuous',
    'b2-third-conditional',
    'b2-wish-if-only',
    'b2-passive-voice-advanced',
    'b2-modals-in-the-past',
    'b2-relative-clauses'
  ],
  'C1': [
    'c1-emphasis-do-and-fronting',
    'c1-cleft-sentences',
    'c1-inversion-after-negative-adverbials',
    'c1-inversion-in-conditionals',
    'c1-mixed-conditionals',
    'c1-participle-clauses',
    'c1-past-perfect-continuous',
    'c1-subjunctive-wish-regret'
  ],
  'C2': [
    'c2-inversion-so-such',
    'c2-mixed-conditionals',
    'c2-mandative-subjunctive',
    'c2-modals-past-deduction',
    'c2-cohesion-and-register'
  ]
};

export const LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// Порядковый индекс урока внутри уровня; неизвестные slug — в конец (по алфавиту)
export function lessonRank(level, slug) {
  const order = LEVEL_ORDER[level] || [];
  const i = order.indexOf(slug);
  if (i !== -1) return i;
  return 1000 + slug.localeCompare(order.join('|'));
}
