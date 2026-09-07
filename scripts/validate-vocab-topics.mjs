// Аудит тематических тем словаря (src/data/vocabulary/*.json, кроме тренажёра
// неправильных глаголов — у него отдельные validate-verbs.mjs и пул-квизы).
// Тематическая тема: groups[].words[].{en, ru, example{en,ru}} (+transcription);
// quiz — стандартные вопросы уроков (answer = индекс опции).
// Запуск: node scripts/validate-vocab-topics.mjs  ->  exit 1 = найдены ошибки.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

const errors = [];
const warns = [];
const err = (s) => errors.push(s);
const warn = (s) => warns.push(s);

const files = fs
  .readdirSync(path.join(root, "src/data/vocabulary"))
  .filter((f) => f.endsWith(".json") && f !== "irregular-verbs.json" && f !== "irregular-verbs-quiz.json");

const RE_RU = /^Что означает (?:фразовый )?глагол (.+?)\?$/;
let wordTotal = 0;

for (const file of files) {
  const t = read("src/data/vocabulary/" + file);
  const tag = file;
  if (!t.slug || !t.title || !t.titleRu) err(`${tag}: нужны slug/title/titleRu`);
  if (!Array.isArray(t.groups) || t.groups.length === 0) {
    err(`${tag}: пусто (нет groups) — тематическая тема строится на группах`);
    continue;
  }

  const seenIds = new Set();
  const seenWords = new Set();
  let qCount = 0;

  for (const g of t.groups) {
    const gtag = `${tag} → группа «${g.groupName || g.groupNameRu || g.id || "?"}»`;
    if (!g.id || seenIds.has(g.id)) err(`${gtag}: id отсутствует или повторяется`);
    if (g.id) seenIds.add(g.id);
    if (!Array.isArray(g.words) || g.words.length === 0) {
      err(`${gtag}: нет слов`);
      continue;
    }
    for (const w of g.words) {
      const key = (w.v1 || w.en || "").toString().toLowerCase();
      const wtag = `${gtag} → «${key}»`;
      if (seenWords.has(key)) err(`${wtag}: дубль слова в теме`);
      if (key) seenWords.add(key);
      if (!w.en) err(`${wtag}: нет en`);
      if (!w.ru) err(`${wtag}: нет ru`);
      if (!w.example || !w.example.en || !w.example.ru)
        err(`${wtag}: нужен example{en, ru}`);
    }
    wordTotal += g.words.length;
  }

  const qs = t.quiz || [];
  const seenQ = new Set();
  const words = t.groups.flatMap((g) => g.words);
  const byKey = new Map(words.map((w) => [(w.v1 || w.en || "").toString().toLowerCase(), w]));
  qs.forEach((q, i) => {
    const qtag = `${tag} quiz[${i}]`;
    qCount++;
    if (!q.q) return err(`${qtag}: пустой вопрос`);
    if (!Array.isArray(q.options) || q.options.length < 2) return err(`${qtag}: опций < 2`);
    if (new Set(q.options).size !== q.options.length) err(`${qtag}: дубли опций`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length)
      err(`${qtag}: answer вне диапазона`);
    if (!q.why) warn(`${qtag}: пустой why`);
    const full = q.q + " ‖ " + (q.options || []).join(" / ");
    if (seenQ.has(full)) err(`${qtag}: полный дубль (вопрос+опции)`);
    seenQ.add(full);

    const m = q.q.match(RE_RU);
    if (!m) return;
    const key = m[1].trim().toLowerCase();
    const w = byKey.get(key);
    if (!w) return err(`${qtag}: в теме нет глагола «${m[1]}»`);
    const got = q.options[q.answer];
    const alts = w.ru.split(";").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const gl = got.toLowerCase();
    if (!alts.some((a) => a === gl || a.includes(gl) || gl.includes(a)))
      warn(`${qtag}: ответ «${got}» не найден в ru «${w.ru}» («${q.q}»)`);
  });

  const topicWords = words.map((w) => (w.v1 || w.en || "").toString().toLowerCase());
  if (topicWords.some((x, i) => topicWords.indexOf(x) !== i))
    err(`${tag}: в теме повторяются слова между группами`);
}

console.log(`Темы: ${files.length} файлов, слов всего: ${wordTotal}.`);
if (warns.length) {
  console.log(`\n⚠ Замечания (${warns.length}):`);
  warns.forEach((w) => console.log("  - " + w));
}
if (errors.length) {
  console.error(`\n✖ Ошибки (${errors.length}):`);
  errors.forEach((e) => console.error("  - " + e));
  process.exit(1);
}
console.log("\nvalidate-vocab-topics.mjs: OK — тематические темы в порядке.");
