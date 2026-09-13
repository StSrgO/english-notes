// Аудит текста урока ВНЕ блока idea: служебный слой о статусе материала (D1),
// рефлексия о самом уроке (D2), ссылки на другие уроки (D3), уровень CEFR в тексте (D4),
// английские служебные термины в русской прозе, следы плана, [bold] вне idea
// (тег отрендерится буквально) и типографика.
//
// Почему отдельный скрипт: validate-idea.mjs проверяет только массив idea, а те же
// формулировки остаются в why/rules/tips/uses/howToLearn/russianAngle/quiz[].why
// (остаток T21). Поля блоками ниже исключены осознанно:
//   context.note          — по стандарту здесь и живёт атрибуция («источник», «учебный пример»);
//   context.lines[].source — служебная метка происхождения строки, на странице не рендерится;
//   formula/structure/rules/tips/uses/markers/quiz/summary/russianAngle — методический аппарат,
//                            где допустимы нотация V1/V2/V3 и схемы вида «X + Y» (решение T18);
//   английские строки (.en, options, q) — английские примеры и термины внутри них норма.
//
// Запуск: node scripts/validate-lesson-text.mjs [--list]
//   --list — печатать каждое совпадение с путём и контекстом.
//   Код возврата: 1 — есть ошибки, 0 — чисто.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dir = path.join(root, "src/data/grammar");
const list = process.argv.includes("--list");

// Служебные и неконтентные поля урока.
const SKIP_KEYS = new Set(["idea", "variant", "slug", "level", "title", "related", "readingTime", "category", "alphabet"]);
// Пути, где служебный слой допустим (см. шапку).
const ALLOWED_D1 = new Set(["context.note"]);
const isAllowed = (p, code) => {
  if (p.startsWith("context.lines") && p.endsWith(".source") && code === "D1") return true;
  return ALLOWED_D1.has(p) && code === "D1";
};

const RULES = [
  // D1 — методологический слой о статусе материала.
  ["D1", /учебн(?!ик)[а-яё]*\s+(?:модел|схем|описан|вывод|пример|трансформ|формулиров|реконструкц|гипотез|анализ|задач)/i, "«учебная модель/схема/вывод» — служебный слой о материале"],
  ["D1", /не\s+(?:явля[а-яё]+\s+)?(?:его\s+)?цитат|не\s+становится\s+цитат/i, "«не цитата» — цитату либо дают дословно, либо не обсуждают её статус"],
  ["D1", /документирован[а-яё]*\s+(?:факт|истори|хронолог|событ|последовательн|данн|основани|материал)/i, "«документированный факт/история» — служебная оговорка"],
  ["D1", /аналитическ[а-яё]*\s+(?:реконструкц|гипотез|модел|пример|вывод|схем|описан|анализ|конструкц|альтернатив)/i, "«аналитическая реконструкция/гипотеза» — служебный слой"],
  ["D1", /реальн[а-яё]+\s+(?:фраз|слов|цитат|факт)|дословн[а-яё]+\s+цитат|фальшив[а-яё]+\s+цитат/i, "«реальная/дословная цитата» — служебный слой"],
  ["D1", /выдава[а-яё]+\s+(?:её\s+|его\s+|их\s+)?за\s+(?:факт|слов|цитат)|приписыва[а-яё]+/i, "оговорка об атрибуции вместо содержания"],
  ["D1", /не\s+(?:выдава[а-яё]+|превраща[а-яё]+|называ[а-яё]+)[^.!?]{0,45}(?:цитат|реконструкц|слова\s+музыкант|(?:историческ|установленн)[а-яё]*\s+факт)/i, "служебная оговорка об атрибуции вместо совета по языку"],
  ["D1", /(?:источник[а-яё]*\s+(?:не\s+)?(?:подтвержда|сообща|говор)|в\s+источниках|официальн[а-яё]+\s+(?:сайт|дискограф|хронолог)|документальн[а-яё]+\s+цитат|цитат[а-яё]*\s+источник|подтвержден[а-яё]*\s+источником)/i, "ссылка на источник в тексте урока"],
  // D2 — рефлексия о самом уроке.
  ["D2", /в этом уроке|в конце урока|задач[а-яё]*\s+урока|иде[а-яё]*\s+урока|тема урока|цель урока/i, "речь о самом уроке, а не о языке"],
  ["D2", /главн[а-яё]+\s+(?:иде|вопрос|задач)/i, "«главная идея/вопрос/задача» — рамка урока"],
  ["D2", /(?:текст|материал|истори[а-яё]+|песн[а-яё]*|рассказ)\s+(?:хорошо\s+|отлично\s+|особенно\s+)?(?:помога[а-яё]*|показыва[а-яё]*|иллюстриру[а-яё]*|подход[а-яё]*)/i, "«материал/текст помогает» — рефлексия о материале"],
  // D3 — ссылки на другие уроки и нумерацию курса.
  ["D3", /(?<![а-яё])\d+-м уроке|предыдущ[а-яё]+\s+урок|следующ[а-яё]+\s+урок|в уроке\s+[A-Z]|котор[а-яё]+\s+мы\s+(?:уже\s+)?изучали/i, "ссылка на другой урок или нумерацию курса"],
  // D4 — уровень CEFR в тексте (поле level — единственное место уровня).
  ["D4", /на\s+(?:начальном|продвинутом|этом|простом|базовом|среднем)\s+уровне|уровн[а-яё]+\s+[ABC][012](?![0-9])|слова\s+A[012](?![0-9])|продвинут[а-яё]+\s+письменн[а-яё]+\s+английск/i, "уровень CEFR в тексте урока"],
  // Термины: только в русской прозе (в английских строках — норма).
  ["термины", /(?<![a-z])modal verbs?(?![a-z])/i, "modal verb — «модальный глагол»"],
  ["термины", /(?<![a-z])if-clauses?(?![a-z])/i, "if-clause — «условная часть»"],
  ["термины", /(?<![a-z])evidence(?![a-z])/i, "evidence — «свидетельства»"],
  ["термины", /(?<![a-z])(?:countable|uncountable)(?![a-z])/i, "countable/uncountable — «исчисляемое/неисчисляемое»"],
  ["термины", /существительн[а-яё]*\s+групп/i, "калька с noun phrase — «именная группа»"],
  ["термины", /(?<![a-z])stable boy(?![a-z])|(?<![a-z])live-(?=[а-яё])/i, "заимствование латиницей в русской прозе"],
  // Следы плана и ИИ-цитирования.
  ["план", /:contentReference|oaicite|Story Bank|V\d+ Audited|актуальная карта/i, "след плана или ИИ-цитирования"],
  ["план", /(?<![\w«»-])[A-Z]\d{2,3}(?![\w-])/, "код плана вида N26 / C13"],
  // Разметка: [bold] рендерится только в idea.
  ["разметка", /\[bold\]|\[\/bold\]/i, "[bold] вне idea — тег отрендерится буквально"],
];

// Типографика — по всему тексту блока.
const MARKUP = [
  [/ {2,}/, "двойной пробел"],
  [/\s+[,;:?!]/, "пробел перед знаком препинания"],
  [/\s+\.(?!\.)/, "пробел перед точкой"],
  [/^\s|\s$/, "висячий пробел по краю строки"],
  [/\s-\s/, "дефис вместо тире"],
];

const CYR = /[а-яё]/i;
// Блоки-схемы: их значения — нотация правила, английские термины там допустимы.
const SCHEMA_BLOCK = /^(?:formula|structure)/;
// Термин внутри английской вставки не является русской прозой: кавычки или соседнее
// латинское слово («the evidence», «Non-defining clause … the evidence»).
const insideQuotes = (s, at, len) => {
  const quoted =
    [...s.matchAll(/«[^»]*»|“[^”]*”/g)].some((m) => m.index <= at && at + len <= m.index + m[0].length);
  if (quoted) return true;
  const before = s.slice(0, at).trimEnd();
  const after = s.slice(at + len).trimStart();
  const latinBefore = /[A-Za-z][A-Za-z'’-]*$/.test(before);
  const latinAfter = /^[A-Za-z'’-]*[A-Za-z]/.test(after);
  return latinBefore || latinAfter;
};

const errors = [];
const err = (file, p, m, note) => errors.push(`${file} ${p}: «${m}» — ${note}`);

const walk = (v, p, out) => {
  if (typeof v === "string") out.push([p, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, p ? `${p}.${k}` : k, out);
  return out;
};

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
let leaves = 0;
for (const file of files) {
  const lesson = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  const flat = [];
  for (const [k, v] of Object.entries(lesson)) {
    if (SKIP_KEYS.has(k)) continue;
    walk(v, k, flat);
  }
  leaves += flat.length;
  for (const [p, s] of flat) {
    const cyr = CYR.test(s);
    for (const [code, re, note] of RULES) {
      if (isAllowed(p, code)) continue;
      if (code === "термины" && (!cyr || SCHEMA_BLOCK.test(p))) continue;
      const m = s.match(re);
      if (!m) continue;
      if (code === "термины" && insideQuotes(s, m.index, m[0].length)) continue;
      err(file, p, m[0].trim(), note);
    }
    for (const [re, note] of MARKUP)
      for (const m of s.matchAll(new RegExp(re.source, "g")))
        err(file, p, `…${s.slice(Math.max(0, m.index - 25), m.index + m[0].length + 20).trim()}…`, note);
  }
}

const byNote = new Map();
for (const e of errors) {
  const note = e.split(" — ").pop();
  byNote.set(note, (byNote.get(note) || 0) + 1);
}
console.log(`Текст вне idea: ${files.length} файлов, ${leaves} строк. Находки: ${errors.length}.`);
if (list) {
  console.log("\n=== список ===");
  errors.forEach((e) => console.log("  " + e));
} else if (errors.length) {
  console.log("\n=== по типам ===");
  [...byNote].sort((a, b) => b[1] - a[1]).forEach(([n, c]) => console.log(`${c} — ${n}`));
}
if (errors.length) {
  if (!list)
    for (const e of errors.slice(0, 15)) console.log("  • " + e);
  console.error(`\n✖ Ошибки текста вне idea (${errors.length}). Полный список: node scripts/validate-lesson-text.mjs --list`);
  process.exit(1);
}
console.log("\nvalidate-lesson-text.mjs: OK — текст вне idea чист.");
