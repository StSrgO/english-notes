// T2 (план словаря): топ-200 неправильных глаголов по частотности.
// Источники (проверяемые, BNC-производные):
//   1. Kilgarriff A. BNC lemmatised word frequency list (lemma.num) — ранг глаголов,
//      попавших в топ-1281 глагольных лемм BNC (лемматизация Килгарриффа, >800 вхождений).
//   2. Сырой BNC-список all.num.o5 — для глаголов ниже порога lemma.num ранг считается
//      как сумма частот форм (v1+v2+v3) по POS-тегам глагола.
//   3. Wiktionary Appendix:English irregular verbs — канонический набор неправильных
//      глаголов с формами V2/V3 (включая составные: understand, forbid, …).
// Исключения: модальные (can/may/will/…), глаголы, неправильные только архаично (work→*wrought).
// Вывод: scripts/_top200.json — [{v1, rank, forms{...}}], rank = место в топ-200.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmp = process.env.TEMP + "\\vocab-redesign";
const BNC_LEMMA = process.argv[2] || path.join(tmp, "bnc-lemma.num");
const BNC_RAW = process.argv[3] || path.join(tmp, "bnc-all.num.o5");
const WIKT = process.argv[4] || path.join(tmp, "wiktionary-irregular.txt");

const MODALS = new Set(["can", "could", "may", "might", "must", "shall", "should", "will", "would", "ought"]);
// Регулярные в современном стандартном английском; «неправильность» — только в
// архаичных/диалектных вариантах, которые вики-таблица не пометила звёздочкой:
// stay (staid), shape (shapen), drag (drug), dive (dove), bless (blest), shave (shaven),
// heave (hove), wend (went — форма глагола go), wreak (wrought — форма work), undress (undrest),
// lade (архаичный; laden живёт только как прилагательное), rend (past rent коллизирует с регулярным rent).
const REGULAR_IN_MODERN = new Set(["stay", "shape", "drag", "dive", "bless", "shave", "heave", "wend", "wreak", "undress", "lade", "rend"]);
const VERB_TAGS = ["vvb", "vvi", "vvd", "vvn", "vvg", "vvz", "vb0", "vbi", "vbd", "vbn", "vbg", "vbz", "vbm", "vbr", "vbb"];

// --- 1. lemma.num: rank word pos ---
const lemmaVerbs = new Map(); // word -> {rank, freq}
for (const line of fs.readFileSync(BNC_LEMMA, "utf8").split("\n")) {
  const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+v$/);
  if (m) lemmaVerbs.set(m[3], { rank: Number(m[1]), freq: Number(m[2]) });
}

// --- 2. raw list: freq per (word, verb POS) ---
const rawFreq = new Map(); // "word|TAG" -> freq
for (const line of fs.readFileSync(BNC_RAW, "utf8").split("\n")) {
  const m = line.trim().match(/^(\d+)\s+(\S+)\s+([a-z0-9]+)\s+\d+$/);
  if (!m) continue;
  const [, freq, word, tag] = m;
  if (VERB_TAGS.includes(tag)) rawFreq.set(`${word}|${tag}`, (rawFreq.get(`${word}|${tag}`) || 0) + Number(freq));
}

// --- 3. Wiktionary rows: v1 + формы ---
function clean(cell) {
  return cell
    .replace(/<sup>[^<]*<\/sup>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/'''/g, "")
    .replace(/''/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
const verbs = new Map(); // v1 -> {forms: Set, archaic: Set, tokens: string[], rawTokens: string[]}
for (const line of fs.readFileSync(WIKT, "utf8").split("\n")) {
  const m = line.match(/^[|:]\s*(?:'')?\[\[([a-z][a-z-]*)(?:\|[^\]]*)?\]\]\s*(.*)$/);
  if (!m) continue;
  const v1 = m[1];
  if (verbs.has(v1)) continue; // первый смысл (напр. bid → bid/bid/bid)
  const cell = clean(m[2]);
  const forms = new Set();
  const archaic = new Set();
  const tokens = [];
  const rawTokens = [];
  for (const raw of cell.split(/\s+/).filter(Boolean)) {
    const parts = raw.split("/").map((p) => ({ t: p.replace(/^\*+/, "").replace(/[?]+$/, ""), arch: p.startsWith("*") })).filter((p) => /^[a-z]+$/.test(p.t));
    if (parts.length === 0) continue;
    rawTokens.push(raw);
    tokens.push(parts[0].t); // предпочтительный вариант — первый в строке вики
    for (const { t, arch } of parts) {
      forms.add(t);
      if (arch) archaic.add(t);
    }
  }
  if (forms.size === 0) continue;
  verbs.set(v1, { forms, archaic, tokens, rawTokens });
}

// --- 4. фильтры: модальные; «неправильные только архаично» ---
// Глагол исключаем, если среди форм нет самого v1 (нет same-form употребления)
// и все не-архаичные варианты регулярны (напр. work: worked + *wrought → исключён;
// wed/wed/wed и wet/wet/wet — оставлены, т.к. same-form вариант основной).
function regularForms(v1) {
  const cand = [v1 + "ed", v1.endsWith("e") ? v1 + "d" : v1 + "ed"];
  const doubled = v1.replace(/([aeiou])([bcdfgjklmnpqrstvz])$/, "$1$2$2ed");
  if (doubled !== v1) cand.push(doubled);
  return new Set(cand);
}
for (const [v1, v] of [...verbs]) {
  if (MODALS.has(v1) || REGULAR_IN_MODERN.has(v1)) { verbs.delete(v1); continue; }
  if (v.forms.has(v1)) continue; // same-form вариант есть (cut/cut, wed/wed) — неправильный
  const nonArchaic = [...v.forms].filter((f) => !v.archaic.has(f) && !/^(was|were|am|is|are)$/.test(f));
  if (nonArchaic.length > 0 && nonArchaic.every((f) => regularForms(v1).has(f))) {
    verbs.delete(v1); // напр. work: worked (+ *wrought архаично)
  }
}

// --- 5. частота: lemma.num ранг, иначе сумма форм по сырому списку ---
function rawSum(v1, forms) {
  const extra = v1 === "be" ? ["am", "is", "are", "being"] : [];
  let sum = 0;
  for (const f of new Set([v1, ...forms, ...extra])) {
    for (const tag of VERB_TAGS) sum += rawFreq.get(`${f}|${tag}`) || 0;
  }
  return sum;
}
const ranked = []; // {v1, forms, v2, v3, rank}
// Архаичный вариант стоит в вики-строке первым — фиксируем основной (совр. англ.);
// get: BrE-основной V3 — got (gotten — AmE-вариант, остаётся в forms).
const FORM_OVERRIDES = {
  spin: { v2: "spun" }, sling: { v2: "slung" }, swing: { v2: "swung" },
  get: { v3: "got" }, sow: { v2: "sowed" }, swell: { v2: "swelled" },
  // в вики-строке «предпочтительный» вариант стоит первым, но для топ-200 он неверен:
  drink: { v3: "drunk" }, hide: { v3: "hidden" }, strike: { v3: "struck" }, abide: { v3: "abode" },
  forbid: { v3: "forbidden" }, show: { v2: "showed" }, strew: { v2: "strewed" },
};
for (const [v1, v] of verbs) {
  const lm = lemmaVerbs.get(v1);
  const ov = FORM_OVERRIDES[v1] || {};
  const v2 = ov.v2 || (v1 === "be" ? "was/were" : preferIrregular(v1, v.rawTokens[0]) || v.tokens[0] || v1);
  const v3 = ov.v3 || (v1 === "be" ? "been" : preferIrregular(v1, v.rawTokens[1]) || v.tokens[0] || v1);
  ranked.push(lm
    ? { v1, forms: v.forms, v2, v3, measure: lm.rank, inLemma: true }
    : { v1, forms: v.forms, v2, v3, measure: -rawSum(v1, v.forms), inLemma: false });
}
// для группировки важна неправильная форма: из «sewed/sewn» берём sewn (нерегулярный вариант)
function preferIrregular(v1, token) {
  if (!token) return null;
  const regular = regularForms(v1);
  for (const raw of token.split("/")) {
    const p = raw.replace(/^\*+/, "").replace(/[?]+$/, "");
    if (!regular.has(p)) return p;
  }
  return token.split("/")[0].replace(/^\*+/, "");
}
ranked.sort((a, b) => (a.inLemma !== b.inLemma ? (a.inLemma ? -1 : 1) : a.measure - b.measure));
const top200 = ranked.slice(0, 200).map((x, i) => ({
  v1: x.v1,
  rank: i + 1,
  v2: x.v2,
  v3: x.v3,
  forms: [...x.forms].filter((f) => f !== x.v1),
}));

console.log(`lemma-ранг: ${ranked.filter((x) => x.inLemma).length} глаголов, raw-сумма: ${ranked.filter((x) => !x.inLemma).length}`);
console.log(`всего кандидатов: ${ranked.length}, берём 200`);
console.log("топ-30:", top200.slice(0, 30).map((x) => `${x.rank}.${x.v1}`).join(" "));
console.log("хвост:", top200.slice(190).map((x) => `${x.rank}.${x.v1}`).join(" "));

fs.writeFileSync(path.join(__dirname, "_top200.json"), JSON.stringify({
  source: "BNC lemma.num (Kilgarriff) + BNC all.num.o5 + Wiktionary Appendix:English irregular verbs",
  note: "rank = место в топ-200 по частотности (BNC-лемматизация Килгарриффа; ниже порога — сумма частот форм). Модальные и архаично-неправильные исключены.",
  built: new Date().toISOString().slice(0, 10),
  verbs: top200,
}, null, 1));
console.log("saved: scripts/_top200.json");
