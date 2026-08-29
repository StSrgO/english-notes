import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://englishnotes.example',
  build: { format: 'directory' },
  redirects: {
    // старые (ошибочные) slug уроков -> канонические (slug = имя файла)
    '/grammar/alphabet-pronunciation': '/grammar/a0-alphabet-pronunciation',
    '/grammar/symbols-abbreviations': '/grammar/a0-symbols-abbreviations',
    '/grammar/numbers-dates-time': '/grammar/a1-numbers-dates-time',
    '/grammar/introductions-greetings': '/grammar/a0-introductions-greetings',
    '/grammar/colours-clothes': '/grammar/a1-colours-clothes',
    '/grammar/family-house': '/grammar/a0-family-house',
    '/grammar/c1-inversion-in-conditional': '/grammar/c1-inversion-in-conditionals',
    '/grammar/c2-mixed-conditionals-advanced': '/grammar/c2-mixed-conditionals',
    '/grammar/b2-mixed-conditional': '/grammar/c1-mixed-conditionals',
    '/grammar/c2-mixed-conditional': '/grammar/c2-mixed-conditionals',
    // переносы уроков между уровнями (CEFR-аудит)
    '/grammar/a0-colours-clothes': '/grammar/a1-colours-clothes',
    '/grammar/a0-numbers-dates-time': '/grammar/a1-numbers-dates-time',
    '/grammar/a2-used-to': '/grammar/b1-used-to',
    '/grammar/b1-present-perfect-continuous': '/grammar/b2-present-perfect-continuous',
    '/grammar/b2-past-perfect': '/grammar/b1-past-perfect',
    '/grammar/b2-second-conditional': '/grammar/b1-second-conditional',
    '/grammar/b2-mixed-conditionals': '/grammar/c1-mixed-conditionals',
    '/grammar/b2-past-perfect-continuous': '/grammar/c1-past-perfect-continuous',
    '/grammar/c2-participle-clauses': '/grammar/c1-participle-clauses',
  }
});