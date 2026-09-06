// Аудит квизов: структурные проверки (все квизы уроков + словаря)
// и семантическая сверка словарного пула неправильных глаголов:
// шаблон вопроса -> ожидаемая V1/V2/V3/перевод; флаги «форма того же
// глагола в опциях переводного вопроса».
// Запуск: node scripts/validate-quizzes.mjs  ->  exit 1 = найдены ошибки.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const list = (dir, re) =>
  fs.readdirSync(path.join(root, dir)).filter((f) => re.test(f));

const errors = [];
const warns = [];
const err = (s) => errors.push(s);
const warn = (s) => warns.push(s);

// ---------- 1. Уроки грамматики: структурная проверка квизов ----------
const lessonFiles = list("src/data/grammar", /\.json$/);
let qCount = 0;
for (const file of lessonFiles) {
  const topic = read("src/data/grammar/" + file);
  const qs = topic.quiz || [];
  const seenQ = new Set();
  qs.forEach((q, i) => {
    const tag = `${file} quiz[${i}]`;
    if (!q.q) return err(`${tag}: пустой вопрос`);
    if (!Array.isArray(q.options) || q.options.length < 2) return err(`${tag}: опций < 2`);
    if (new Set(q.options).size !== q.options.length) err(`${tag}: дубли опций`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length)
      err(`${tag}: answer вне диапазона`);
    if (!q.why) warn(`${tag}: пустой why`);
    const full = q.q + " ‖ " + (q.options || []).join(" / ");
    if (seenQ.has(full)) err(`${tag}: полный дубль (вопрос+опции) «${q.q.slice(0, 60)}»`);
    seenQ.add(full);
  });
  qCount += qs.length;
}

// ---------- 2. Словарный пул неправильных глаголов: семантика ----------
const data = read("src/data/vocabulary/irregular-verbs.json");
const quiz = read("src/data/vocabulary/irregular-verbs-quiz.json");
const byV1 = new Map();
const formOwner = new Map(); // v2/v3 (lower) -> v1 владельца
for (const w of data.groups.flatMap((g) => g.words)) {
  byV1.set(w.v1.toLowerCase(), w);
  formOwner.set(w.v2.toLowerCase(), w.v1);
  formOwner.set(w.v3.toLowerCase(), w.v1);
}
const isForm = (s) => formOwner.has(s.toLowerCase());

const RE2 = /^Вторая форма глагола (.+?) — это…$/;
const RE3 = /^Третья форма глагола (.+?) — это…$/;
const RE_RU = /^Что означает глагол (.+?)\?$/;
const RE_V1 = /^Какой глагол означает «(.+?)»\?$/;

let vocabN = 0;
for (const [gid, listQs] of Object.entries(quiz.groupQuizzes || {})) {
  listQs.forEach((q, i) => {
    const tag = `квиз ${gid}[${i}]`;
    vocabN++;
    const text = q.q;
    let m;
    if ((m = text.match(RE2)) || (m = text.match(RE3))) {
      const isV2 = RE2.test(text);
      const v1 = m[1].trim().toLowerCase();
      const w = byV1.get(v1);
      if (!w) return err(`${tag}: неизвестный глагол «${m[1]}»`);
      const expected = isV2 ? w.v2 : w.v3;
      const got = q.options[q.answer];
      if (got !== expected)
        err(`${tag}: ждали ${isV2 ? "V2" : "V3"} «${expected}», а ответ — «${got}» («${text}»)`);
    } else if ((m = text.match(RE_RU))) {
      const v1 = m[1].trim().toLowerCase();
      const w = byV1.get(v1);
      if (!w) return err(`${tag}: неизвестный глагол «${m[1]}»`);
      const got = q.options[q.answer];
      // ответ-перевод: допускаем совпадение с одной из альтернатив ru (через ;)
      const alts = w.ru.split(";").map((s) => s.trim().toLowerCase()).filter(Boolean);
      const g = got.toLowerCase();
      if (!alts.some((a) => a === g || a.includes(g) || g.includes(a)))
        warn(`${tag}: перевод «${got}» не найден в ru «${w.ru}» («${text}»)`);
    } else if ((m = text.match(RE_V1))) {
      const phrase = m[1];
      const pl = phrase.trim().toLowerCase();
      // кандидаты: сначала точное совпадение альтернативы перевода или
      // склейки «учить; обучать» целиком; затем префикс; затем «содержит»
      // (len>=4, чтобы «петь» не ловилось внутри «терпеть»)
      const altsOf = (w) => w.ru.split(";").map((s) => s.trim().toLowerCase()).filter(Boolean);
      let cand = [...byV1.values()].filter((w) => altsOf(w).includes(pl) || altsOf(w).join("; ") === pl);
      if (!cand.length) cand = [...byV1.values()].filter((w) => altsOf(w).some((a) => a.startsWith(pl)));
      if (!cand.length) cand = [...byV1.values()].filter((w) => pl.length >= 4 && altsOf(w).some((a) => a.includes(pl)));
      if (cand.length === 0) return err(`${tag}: нет глагола с переводом «${phrase}»`);
      if (cand.length > 1)
        warn(`${tag}: перевод «${phrase}» у нескольких глаголов: ${cand.map((c) => c.v1).join(", ")} — вопрос неоднозначен`);
      const w = cand[0];
      const got = q.options[q.answer];
      if (!cand.some((c) => c.v1 === got))
        err(`${tag}: ждали V1 ${cand.map((c) => c.v1).join("/")}, а ответ — «${got}» («${text}»)`);
      // опции переводного вопроса должны быть начальными формами:
      // «голая» V2/V3 (без v1 в пуле) — источник бага «форма vs перевод»;
      // ещё один кандидат-перевод среди опций — два правильных ответа
      for (const opt of q.options) {
        const ol = opt.toLowerCase();
        if (ol === got.toLowerCase()) continue;
        if (!byV1.has(ol) && formOwner.has(ol))
          err(`${tag}: опция-форма «${opt}» (V2/V3 глагола ${formOwner.get(ol)}) — вопрос про перевод, опции — начальные формы («${text}»)`);
        else if (byV1.has(ol) && cand.some((c) => c.v1.toLowerCase() === ol && c.v1 !== got))
          err(`${tag}: «${opt}» тоже означает «${phrase}» — два правильных ответа («${text}»)`);
      }
    } else {
      warn(`${tag}: нераспознанный шаблон «${text.slice(0, 70)}»`);
    }
  });
}

// ---------- 3. Общие проверки пула ----------
const allVocabQs = Object.values(quiz.groupQuizzes || {}).flat();
const dupQ = allVocabQs.filter((x, i, a) => a.findIndex((y) => y.q === x.q) !== i);
if (dupQ.length) err(`повторы вопросов пула: ${dupQ.slice(0, 5).map((x) => x.q).join(" | ")}`);

console.log(`Уроки: ${lessonFiles.length} файлов, ${qCount} квиз-вопросов. Словарь: ${vocabN} вопросов пула.`);
if (warns.length) {
  console.log(`\n⚠ Замечания (${warns.length}):`);
  warns.forEach((w) => console.log("  - " + w));
}
if (errors.length) {
  console.error(`\n✖ Ошибки (${errors.length}):`);
  errors.forEach((e) => console.error("  - " + e));
  process.exit(1);
}
console.log("\nvalidate-quizzes.mjs: OK — структурных ошибок нет.");
