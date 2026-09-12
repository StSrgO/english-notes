// Аудит уроков аудирования (src/data/listening/*.json).
// Урок: {slug, level, title, titleRu?, intro?, cast[{who, ru, gender}]?,
// scenes[{id, title?, titleRu?, sentences[{who?, en, ru, audio?}],
// quiz[{q, options, answer, why}]}]}.
// answer — индекс опции; quiz-вопросы — формат уроков (структура как в
// validate-quizzes.mjs). Предложения en не должны повторяться между уроками.
// who — говорящий в реплике (одинаковые значения = один человек), cast — его
// подпись для русского интерфейса и пол (f/m) для подбора голоса. Без who
// сцена читается как монолог.
// Запуск: node scripts/validate-listening.mjs  ->  exit 1 = найдены ошибки.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

const LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"];
const errors = [];
const warns = [];
const err = (s) => errors.push(s);
const warn = (s) => warns.push(s);

const files = fs
  .readdirSync(path.join(root, "src/data/listening"))
  .filter((f) => f.endsWith(".json"))
  .sort();

const seenEn = new Set(); // глобальные дубли предложений между уроками
let sentCount = 0;
let quizCount = 0;

for (const file of files) {
  const l = read("src/data/listening/" + file);
  const tag = file;
  if (!l.slug) err(`${tag}: нет slug`);
  if (!l.title || !l.titleRu) err(`${tag}: нужны title/titleRu`);
  if (!LEVELS.includes(l.level)) err(`${tag}: level не из CEFR (${l.level})`);

  // cast: подписи говорящих для русского интерфейса (who → ru) + пол для озвучки
  const cast = new Map();
  if (l.cast !== undefined) {
    if (!Array.isArray(l.cast) || l.cast.length === 0) err(`${tag}: cast — непустой массив`);
    else
      l.cast.forEach((c, i) => {
        if (!c || !c.who || !c.ru) return err(`${tag}: cast[${i}] — нужны who и ru`);
        if (!["f", "m"].includes(c.gender))
          warn(`${tag}: cast[${i}] «${c.who}» — gender f/m не указан, голос подберётся произвольно`);
        if (cast.has(c.who)) err(`${tag}: cast — повтор участника «${c.who}»`);
        cast.set(c.who, c.ru);
      });
  }
  const usedWho = new Set();

  if (!Array.isArray(l.scenes) || l.scenes.length === 0) {
    err(`${tag}: нет scenes`);
    continue;
  }
  const sceneIds = new Set();
  const fileEn = new Set();

  for (const sc of l.scenes) {
    const stag = `${tag} → сцена «${sc.title || sc.id || "?"}»`;
    if (!sc.id || sceneIds.has(sc.id)) err(`${stag}: id отсутствует или повторяется`);
    if (sc.id) sceneIds.add(sc.id);
    if (!Array.isArray(sc.sentences) || sc.sentences.length < 3) {
      err(`${stag}: нужно минимум 3 предложения`);
      continue;
    }

    // говорящие: либо who у всех реплик сцены, либо ни у одной
    const whoSet = new Set(sc.sentences.map((s) => (s.who || "").trim()).filter(Boolean));
    const withoutWho = sc.sentences.filter((s) => !(s.who || "").trim()).length;
    if (whoSet.size && withoutWho) err(`${stag}: who есть не у всех предложений`);
    if (!whoSet.size) warn(`${stag}: говорящие не указаны (who) — сцена звучит как монолог`);
    whoSet.forEach((w) => usedWho.add(w));

    for (const s of sc.sentences) {
      sentCount++;
      if (!s.en || !s.ru) err(`${stag}: предложение без en/ru`);
      if (!s.en) continue;
      const k = s.en.toLowerCase();
      if (fileEn.has(k)) err(`${stag}: дубль предложения в файле «${s.en.slice(0, 60)}»`);
      fileEn.add(k);
      if (seenEn.has(k))
        err(`глобальный дубль предложения: «${s.en.slice(0, 60)}» (${tag})`);
      seenEn.add(k);
    }
    // для B1+ тексты длиннее: подсказываем, если сцена или квиз короткие
    if (l.level === "B1" && sc.sentences.length < 10)
      warn(`${stag}: всего ${sc.sentences.length} предложений — для B1 лучше 10+`);
    if (l.level === "B1" && (sc.quiz || []).length < 5)
      warn(`${stag}: всего ${(sc.quiz || []).length} вопросов — для B1 лучше 5+`);

    const qs = sc.quiz || [];
    const seenQ = new Set();
    qs.forEach((q, i) => {
      const qtag = `${stag} quiz[${i}]`;
      quizCount++;
      if (!q.q) return err(`${qtag}: пустой вопрос`);
      if (!Array.isArray(q.options) || q.options.length < 2) return err(`${qtag}: опций < 2`);
      if (new Set(q.options).size !== q.options.length) err(`${qtag}: дубли опций`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length)
        err(`${qtag}: answer вне диапазона`);
      if (!q.why) warn(`${qtag}: пустой why`);
      const full = q.q + " ‖ " + (q.options || []).join(" / ");
      if (seenQ.has(full)) err(`${qtag}: полный дубль (вопрос+опции)`);
      seenQ.add(full);
    });
  }

  // cast и who должны сходиться: подпись без английского who не отобразится
  for (const w of usedWho)
    if (!cast.has(w)) warn(`${tag}: участник «${w}» не описан в cast — подпись останется английской`);
  for (const w of cast.keys())
    if (!usedWho.has(w)) warn(`${tag}: cast — участник «${w}» не встречается в сценах`);
}

console.log(`Аудирование: ${files.length} уроков, предложений: ${sentCount}, вопросов: ${quizCount}.`);
if (warns.length) {
  console.log(`\n⚠ Замечания (${warns.length}):`);
  warns.forEach((w) => console.log("  - " + w));
}
if (errors.length) {
  console.error(`\n✖ Ошибки (${errors.length}):`);
  errors.forEach((e) => console.error("  - " + e));
  process.exit(1);
}
console.log("\nvalidate-listening.mjs: OK — уроки аудирования в порядке.");
