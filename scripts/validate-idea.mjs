// Аудит блока idea («Как это работает») в src/data/grammar/*.json.
// Категории дефектов (план _idea-audit-plan.md §2):
//   D1  — методологический слой о статусе материала: «учебная модель», «не цитата»,
//         «документированный факт», «источник сообщает», «аналитическая реконструкция».
//   D2  — мета-рефлексия о материале и уроке: «история хорошо показывает»,
//         «главная идея урока», «в этом уроке», «такой способ работы».
//   D3  — ссылки на другие уроки и внутренняя нумерация курса.
//   D4  — уровень CEFR в тексте (поле level — единственное место уровня).
//   D9  — [bold] на кириллице: жирным выделяются только английские примеры.
//   термины — английские служебные термины в русской фразе (modal verb, evidence, V1,
//         нотация «subject + verb»); исключение — термин-предмет урока (cleft sentence).
//   D10 — типографика: пробел перед знаком, висячий пробел, дефис вместо тире.
// Предупреждения (решение 1 плана — не блокируют приёмку):
//   D5 — одна английская фраза живёт в одном блоке: считаются повторы внутри idea,
//        в других блоках урока и между classic/rock одной темы;
//   плотность маркеров ИИ-стиля (мы/здесь/именно/важно/не просто…а и др.), порог 3/1000;
//   D6 — объём idea ≥ 22 абзацев при 3–4 тезисах.
// Запуск: node scripts/validate-idea.mjs [--list]
//   --list — печатать каждое совпадение с контекстом (полный список правок).
//   Код возврата: 1 — есть ошибки, 0 — только предупреждения или чисто.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dir = path.join(root, "src/data/grammar");
const list = process.argv.includes("--list");

const errors = [];
const warns = [];
const err = (code, tag, s) => errors.push({ code, tag, s });
const warn = (tag, s) => warns.push(`${tag}: ${s}`);

// Слово на кириллице целиком: \b в JS работает по ASCII и с кириллицей бесполезен.
const cy = (w) => `(?<![а-яё])${w}(?![а-яё])`;

// Ошибки: D1–D4 и термины-заимствования ищутся в прозе (без [bold] и кавычек).
// Внимание: \w и \b в JS работают по ASCII и с кириллицей не срабатывают —
// кириллические слова описываем классом [а-яё], границы — через cy().
const PROSE_RULES = [
  ["D1", /учебн[а-яё]*/i, "учебная модель/схема/описание — служебный слой о статусе материала"],
  ["D1", /не\s+(?:явля[а-яё]+\s+)?(?:его\s+)?цитат/i, "«не цитата» — цитату либо дают дословно, либо не упоминают"],
  ["D1", /документирован[а-яё]*/i, "«документированный факт» — служебная оговорка об источнике"],
  ["D1", /источник[а-яё]*\s+(?:сообща|указыва|описыва|говор)|в источниках|официальн[а-яё]+\s+(?:сайт|дискограф|описан)/i, "ссылка на источник в тексте урока"],
  ["D1", /аналитическ[а-яё]*/i, "«аналитическая реконструкция» — служебный слой"],
  ["D1", /реальн[а-яё]+\s+(?:фраз|слов|цитат|факт)/i, "«реальная фраза/цитата» — служебный слой"],
  ["D1", /без\s+\S+\s+цитат|выдава[а-яё]+\s+(?:её\s+|его\s+)?за\s+(?:факт|слова)|первоисточник/i, "оговорка об атрибуции"],
  ["D2", /в этом уроке|в конце урока|в уроке(?![а-яё])|для урока|задач[а-яё]*\s+урока|иде[а-яё]*\s+урока|тема урока|цель урока/i, "речь о самом уроке, а не о языке"],
  ["D2", /главн[а-яё]+\s+(?:иде|вопрос|задач)/i, "«главная идея/задача урока»"],
  ["D2", /вид[а-яё]*[^.!?]{0,35}(?:в истории|на примере|в примере)/i, "«видно в истории/на примере» — рефлексия о материале"],
  ["D2", /(?:истори[а-яё]+|рассказ|текст|материал|пример|цитат[а-яё]*|песн[а-яё]*|альбом|ситуаци[а-яё]*)\s+(?:хорошо\s+|отлично\s+|особенно\s+|естественно\s+)?(?:показыва[а-яё]*|иллюстриру[а-яё]*|помога[а-яё]*|подход[а-яё]*|соответству[а-яё]*|демонстриру[а-яё]*)/i, "«материал/история показывает» — рефлексия о материале"],
  ["D2", /(?:ключев|главн)[а-яё]*\s+(?:разниц|мысл)[а-яё]*/i, "«ключевая разница / главная мысль» — рамка урока"],
  ["D2", /идеально подходит|(?:составляют|составляет)\s+основу|сам\s+предмет[а-яё]*\s+(?:разговора|урока)/i, "«идеально подходит / составляет основу темы» — рамка урока"],
  ["D3", /(?<![а-яё])\d+-м уроке|предыдущ[а-яё]+\s+урок|следующ[а-яё]+\s+урок|в уроке\s+[A-Z]|из урока|котор[а-яё]+\s+мы\s+(?:уже\s+)?изучали|мы\s+уже\s+изучали|как в детективной истории/i, "ссылка на другой урок или нумерацию курса"],
  ["D4", /на\s+(?:начальном|продвинутом|этом|простом|базовом|среднем)\s+уровне|уровн[а-яё]+\s+[ABC][012](?![0-9])|слова\s+A[012](?![0-9])|начинающ[а-яё]+\s+уровн|продвинут[а-яё]+\s+письменн[а-яё]+\s+английск[а-яё]*/i, "уровень CEFR в тексте урока"],
  ["термины", new RegExp(`(?<![a-z])modal verbs?(?![a-z])`, "i"), "термин modal verb в русской фразе — «модальный глагол»"],
  ["термины", new RegExp(`(?<![a-z])if-clauses?(?![a-z])`, "i"), "термин if-clause в русской фразе — «условная часть»"],
  ["термины", new RegExp(`(?<![a-z])live-(?=[а-яё])`, "i"), "гибрид live- + русское слово"],
  ["термины", new RegExp(`(?<![a-z])evidence(?![a-z])`, "i"), "термин evidence в русской фразе — «свидетельства»"],
  ["термины", new RegExp(`(?<![a-z])(?:countable|uncountable)(?![a-z])`, "i"), "термин countable/uncountable — «исчисляемое/неисчисляемое»"],
  ["термины", /существительн[а-яё]*\s+групп/i, "калька с noun phrase — «именная группа»"],
  ["термины", new RegExp(`(?<![a-z])stable boy(?![a-z])`, "i"), "профессия латиницей в русской прозе"],
  ["термины", new RegExp(`(?<![a-z])imperative-like(?![a-z])`, "i"), "гибрид Imperative-like в русской фразе"],
  ["термины", new RegExp(`(?<![a-z])question words?(?![a-z])`, "i"), "термин question word — «вопросительное слово»"],
  ["термины", new RegExp(`(?<![a-z])numbers(?![a-z])`, "i"), "слово numbers латиницей в русской прозе"],
  ["термины", /(?<![A-Za-z0-9])V[123](?![A-Za-z0-9])/, "нотация V1/V2/V3 в русской фразе"],
  ["термины", /(?<![A-Za-z])[A-Za-z'’]+(?:\s+[A-Za-z'’]+){0,2}\s\+\s[A-Za-z'-]+/, "английская нотация схемы (subject + verb)"],
];

// Ошибки разметки и типографики: ищутся в абзаце как есть (включая содержимое [bold]).
// Многоточие через пробел — норма английской формулы («does ... do»), поэтому одиночная
// точка и знаки «, ; : ? !» — ошибка, а ряд точек — нет.
const MARKUP = [
  [/ {2,}/, "двойной пробел"],
  [/\s+[,;:?!]/, "пробел перед знаком препинания"],
  [/\s+\.(?!\.)/, "пробел перед точкой"],
  [/^\s|\s$/, "висячий пробел по краю абзаца"],
  [/\s-\s/, "дефис вместо тире"],
];

// Маркеры ИИ-стиля (D2-плотность, план §3).
const MARKERS = [
  [new RegExp(cy("(?:мы|нас|нам|наш[а-яё]*|наши)"), "i"), "мы/наш"],
  [new RegExp(cy("здесь"), "i"), "здесь"],
  [new RegExp(cy("именно"), "i"), "именно"],
  [new RegExp(cy("важ[а-яё]+"), "i"), "важно"],
  [/не просто[^.!?]{1,70}(?:,\s*а|—|:|;)\s/i, "не просто…а"],
  [/это\s+(?:даёт|дает|позволяет|показывает)/i, "это даёт/позволяет/показывает"],
  [/такой способ|таким образом|если мы рассказываем/i, "такой способ работы"],
  [/помогает (?:показать|увидеть)/i, "помогает показать"],
  [/естествен[а-яё]*/i, "естественно"],
  [/хорош[а-яё]+\s+(?:пример|иллюстраци|модел)|удобн[а-яё]+\s+(?:истори|пример|модел)|наглядн[а-яё]+\s+(?:пример|модел)/i, "хороший/удобный пример"],
];

const strip = (s) => s
  .replace(/\[bold\][^[\]]*\[\/bold\]/g, " ")
  .replace(/«[^»]*»/g, " ")
  .replace(/“[^”]*”/g, " ");
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
const boldPhrases = (s) =>
  [...s.matchAll(/\[bold\]([^[\]]+)\[\/bold\]/g)]
    .map((m) => norm(m[1]))
    .filter((p) => p.split(" ").length >= 3 && p.split(" ").some((w) => w.length > 1));

const restText = (lesson) => {
  const out = [];
  const walk = (v, key) => {
    if (key === "idea") return;
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  for (const [k, v] of Object.entries(lesson)) walk(v, k);
  return norm(out.join(" \n "));
};

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const phrasesByTopic = new Map(); // тема без .rocknroll -> набор фраз idea
let paragraphs = 0;
let chars = 0;
let dupInIdea = 0;
let dupOutside = 0;
const markerHits = [];

for (const file of files) {
  const lesson = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  const idea = lesson.idea;
  if (!Array.isArray(idea) || idea.length === 0) {
    err("схема", file, "idea — непустой массив абзацев");
    continue;
  }
  const text = idea.join("\n");
  paragraphs += idea.length;
  chars += text.length;
  const where = (i, s) => `[${i}] ${s}`;
  const seen = new Map(); // фразы idea → первый абзац, где встретились
  let markers = 0;

  idea.forEach((p, i) => {
    if (typeof p !== "string" || !p.trim()) {
      err("схема", file, `idea[${i}] — пустой абзац`);
      return;
    }
    const prose = strip(p);
    for (const [code, re, note] of PROSE_RULES) {
      const m = prose.match(re);
      if (m) err(code, file, where(i, `«${m[0].trim()}» — ${note}`));
    }
    // разметка: [bold] только латиницей и только парными тегами
    for (const m of p.matchAll(/\[bold\]([^[\]]*)\[\/bold\]/g))
      if (/[а-яё]/i.test(m[1]))
        err("D9", file, where(i, `[bold] на кириллице — «${m[1].slice(0, 60)}»`));
    if ((p.match(/\[bold\]/g) || []).length !== (p.match(/\[\/bold\]/g) || []).length)
      err("D9", file, where(i, "непарные теги [bold]"));
    for (const [re, note] of MARKUP)
      for (const m of p.matchAll(new RegExp(re.source, "g")))
        err("D10", file, where(i, `${note} — «…${p.slice(Math.max(0, m.index - 25), m.index + m[0].length + 20).trim()}…»`));
    // D5: повторы английских фраз из [bold] внутри idea и в других блоках
    for (const ph of boldPhrases(p)) {
      if (seen.has(ph)) {
        dupInIdea++;
        warn(file, `D5: фраза «${ph}» повторяется в idea [${seen.get(ph)}] и [${i}]`);
      } else seen.set(ph, i);
    }
    for (const [re, name] of MARKERS)
      for (const m of p.matchAll(new RegExp(re.source, "gi"))) {
        markers++;
        markerHits.push(`${file} [${i}]: «${m[0].trim()}» — ${name}`);
      }
  });

  const rest = restText(lesson);
  for (const ph of seen.keys())
    if (rest.includes(ph)) {
      dupOutside++;
      warn(file, `D5: фраза «${ph}» есть и в другом блоке урока`);
    }

  if (idea.length >= 22) warn(file, `D6: ${idea.length} абзацев idea — вероятная «вода» (типично 12–18)`);

  const dense = markers / (text.length / 1000);
  if (dense > 3) warn(file, `маркеры ИИ-стиля: ${markers} на ${text.length} знаков = ${dense.toFixed(2)}/1000 (порог 3)`);

  const topic = file.replace(/\.rocknroll\.json$/, "").replace(/\.json$/, "");
  if (!phrasesByTopic.has(topic)) phrasesByTopic.set(topic, []);
  phrasesByTopic.get(topic).push([file, new Set(seen.keys())]);
}

// D5: classic и rock одной темы не должны повторять одни и те же английские фразы
let dupVersions = 0;
for (const [topic, versions] of phrasesByTopic)
  if (versions.length === 2) {
    const [a, b] = versions;
    for (const ph of a[1])
      if (b[1].has(ph)) {
        dupVersions++;
        warn(b[0], `D5: фраза «${ph}» повторяется в ${a[0]} (тема ${topic})`);
      }
  }

const byCode = new Map();
for (const e of errors) {
  if (!byCode.has(e.code)) byCode.set(e.code, []);
  byCode.get(e.code).push(`${e.tag} — ${e.s}`);
}

console.log(
  `idea: ${files.length} файлов, ${paragraphs} абзацев, ${chars} знаков. ` +
  `Дубли фраз (D5): внутри idea ${dupInIdea}, в других блоках ${dupOutside}, между версиями ${dupVersions}.`
);
if (list) {
  console.log("\n=== список ошибок ===");
  for (const [code, arr] of byCode) {
    console.log(`\n--- ${code} (${arr.length})`);
    arr.forEach((s) => console.log("   " + s));
  }
  console.log("\n=== предупреждения ===");
  warns.forEach((w) => console.log("   " + w));
  console.log(`\n=== маркеры ИИ-стиля (${markerHits.length}) ===`);
  markerHits.forEach((m) => console.log("   " + m));
} else if (errors.length) {
  console.log("\n=== ошибки по категориям (полный список — с --list) ===");
  for (const [code, arr] of [...byCode].sort((a, b) => b[1].length - a[1].length))
    console.log(`${code}: ${arr.length}`);
}
if (!list && warns.length) {
  const byKind = new Map();
  for (const w of warns) {
    const kind = w.includes("D5:") ? "D5 (повторы фраз)" : w.includes("D6:") ? "D6 (объём idea)" : "маркеры ИИ-стиля";
    byKind.set(kind, (byKind.get(kind) || 0) + 1);
  }
  console.log("\n=== предупреждения (полный список — с --list) ===");
  for (const [kind, n] of byKind) console.log(`${kind}: ${n}`);
}
if (errors.length) {
  console.error(`\n✖ Ошибки idea (${errors.length}):`);
  for (const [code, arr] of byCode) {
    console.error(`  ${code} (${arr.length}) — первые 12:`);
    arr.slice(0, 12).forEach((s) => console.error("    " + s));
    if (arr.length > 12) console.error(`    …и ещё ${arr.length - 12} (см. --list)`);
  }
  process.exit(1);
}
console.log("\nvalidate-idea.mjs: OK — блок idea чист по D1–D4, D9, терминам и D10.");
