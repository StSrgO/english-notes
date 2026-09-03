// T11 (план словаря): валидация данных тренажёра неправильных глаголов.
// Проверяет src/data/vocabulary/irregular-verbs.json (200 слов, ipa/ru/example)
// и src/data/vocabulary/irregular-verbs-quiz.json (квизы по группам, answer в диапазоне).
// Запуск: node scripts/validate-verbs.mjs  →  exit 0 = OK, exit 1 = найдены ошибки.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", p), "utf8"));

const data = read("src/data/vocabulary/irregular-verbs.json");
const quiz = read("src/data/vocabulary/irregular-verbs-quiz.json");
const errors = [];

// ---------- irregular-verbs.json ----------
if (data.slug !== "irregular-verbs") errors.push(`slug: «${data.slug}» вместо irregular-verbs`);
if (data.total !== 200) errors.push(`total != 200: ${data.total}`);

const words = data.groups.flatMap((g) => g.words);
const v1s = words.map((w) => w.v1);
if (new Set(v1s).size !== v1s.length) {
  const dup = v1s.filter((v, i) => v1s.indexOf(v) !== i);
  errors.push(`дубли v1: ${[...new Set(dup)].join(", ")}`);
}
if (v1s.length !== 200) errors.push(`всего слов != 200: ${v1s.length}`);
const ranks = words.map((w) => w.rank).sort((a, b) => a - b);
if (ranks.join(",") !== [...Array(200).keys()].map((i) => i + 1).join(",")) errors.push("rank не образуют 1..200");

const enExamples = words.map((w) => w.example && w.example.en);
if (new Set(enExamples).size !== 200) {
  const dup = enExamples.filter((v, i) => enExamples.indexOf(v) !== i);
  errors.push(`повторы example.en: ${[...new Set(dup)].slice(0, 5).join(" | ")}`);
}

const seenGroup = new Set();
for (const g of data.groups) {
  if (seenGroup.has(g.id)) errors.push(`дубль группы ${g.id}`);
  seenGroup.add(g.id);
  for (const key of ["groupName", "groupNameRu", "chip"]) if (!g[key]) errors.push(`группа ${g.id}: пустой ${key}`);
  if (!Array.isArray(g.words) || g.words.length === 0) { errors.push(`группа ${g.id}: нет слов`); continue; }
  const byRank = g.words.map((w) => w.rank);
  if (byRank.join(",") !== [...byRank].sort((a, b) => a - b).join(",")) errors.push(`группа ${g.id}: слова не по рангу`);
  for (const w of g.words) {
    const tag = `группа ${g.id} · ${w.v1}`;
    if (!w.v1 || !w.v2 || !w.v3) errors.push(`${tag}: пустая форма`);
    if (!Number.isInteger(w.rank) || w.rank < 1 || w.rank > 200) errors.push(`${tag}: rank вне 1..200`);
    if (!w.ru) errors.push(`${tag}: пустой ru`);
    if (!Array.isArray(w.ipa) || w.ipa.length !== 3 || w.ipa.some((x) => !x)) errors.push(`${tag}: ipa не [3 строки]`);
    if (!w.example || !w.example.en || !w.example.ru) errors.push(`${tag}: нет example{en,ru}`);
  }
}

// ---------- irregular-verbs-quiz.json ----------
const quizGroups = Object.keys(quiz.groupQuizzes || {});
if (quizGroups.length !== 10) errors.push(`квизов групп != 10: ${quizGroups.length}`);
const dataIds = new Set(data.groups.map((g) => g.id));
for (const id of quizGroups) if (!dataIds.has(id)) errors.push(`квиз для неизвестной группы ${id}`);
for (const id of dataIds) if (!quiz.groupQuizzes[id]) errors.push(`нет квиза для группы ${id}`);

const allQs = [];
for (const id of quizGroups) {
  const list = quiz.groupQuizzes[id];
  if (!Array.isArray(list)) { errors.push(`квиз ${id}: не массив`); continue; }
  if (list.length < 10 || list.length > 12) errors.push(`квиз ${id}: вопросов ${list.length} (нужно 10–12)`);
  list.forEach((q, i) => {
    const tag = `квиз ${id}[${i}]`;
    if (!q.q) errors.push(`${tag}: пустой вопрос`);
    if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`${tag}: опций < 2`);
    else if (new Set(q.options).size !== q.options.length) errors.push(`${tag}: дубли опций`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options || []).length) errors.push(`${tag}: answer вне диапазона`);
    if (!q.why) errors.push(`${tag}: пустой why`);
    allQs.push(q.q);
  });
}
if (new Set(allQs).size !== allQs.length) {
  const dup = allQs.filter((v, i) => allQs.indexOf(v) !== i);
  errors.push(`повторы вопросов квизов: ${[...new Set(dup)].slice(0, 5).join(" | ")}`);
}

if (errors.length) {
  console.error(`validate-verbs.mjs: ${errors.length} ошибок`);
  errors.forEach((e) => console.error("  - " + e));
  process.exit(1);
}
const qTotal = quizGroups.reduce((n, id) => n + quiz.groupQuizzes[id].length, 0);
console.log(`validate-verbs.mjs: OK — ${v1s.length} слов (10 групп), ${qTotal} вопросов квизов, все проверки пройдены.`);
