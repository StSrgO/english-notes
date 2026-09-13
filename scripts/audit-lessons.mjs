// Аудит уроков и заметок (план _full-audit-plan.md). Только чтение и отчёт:
// слой A — схема и целостность данных, слой B — канон-метрики и выбросы,
// структурная часть слоя D — заметки (cheats).
// Правила, уже покрытые стражами (D5/D11/D12, квизы, кросс-версии), здесь НЕ дублируются.
//
// Запуск: node scripts/audit-lessons.mjs [--list] [--json]
//   --list — печатать каждую находку;
//   --json — выгрузить _audit-report/lessons.json и _audit-report/cheats.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const GDIR = path.join(root, "src/data/grammar");
const CDIR = path.join(root, "src/data/cheats");
const list = process.argv.includes("--list");
const dump = process.argv.includes("--json");

const { LEVEL_ORDER } = await import(pathToFileURL(path.join(root, "src/data/lesson-order.js")).href);

// ---------- находки ----------
const F = [];
const add = (severity, cls, file, p, msg) => F.push({ severity, cls, file, p, msg });
const ERR = (cls, f, p, m) => add("ERROR", cls, f, p, m);
const WARN = (cls, f, p, m) => add("WARN", cls, f, p, m);
const INFO = (cls, f, p, m) => add("INFO", cls, f, p, m);

// ---------- ожидаемая схема урока ----------
const KEYS = [
  "variant", "slug", "level", "title", "category", "readingTime", "summary", "idea", "why", "context",
  "russianAngle", "howToLearn", "formula", "structure", "markers", "uses", "rules", "examples",
  "mistakes", "compare", "tips", "quiz", "related",
];
// Поля, которые встречаются не везде и схемой допускаются.
const OPTIONAL = new Set(["alphabet", "highlight"]);
const LINE_TYPES = new Set(["lesson_scene", "lesson_example", "authentic_quote", "authentic_context_question", "authentic_short_fragment"]);

const CYR = /[а-яё]/i;
const LAT = /[a-z]/i;
const isStr = (v) => typeof v === "string";
const nonEmptyStr = (v) => isStr(v) && v.trim().length > 0;
const arrOfStr = (v) => Array.isArray(v) && v.length > 0 && v.every((x) => nonEmptyStr(x));
const stripTags = (s) => String(s).replace(/\[bold\]|\[\/bold\]/g, "");
const words = (s) => stripTags(s).trim().split(/\s+/).filter(Boolean).length;

const files = fs.readdirSync(GDIR).filter((f) => f.endsWith(".json")).sort();
const lessons = new Map(); // topic -> {classic, rock}
const slugOwner = new Map(); // slug -> file
const englishLines = new Map(); // нормализованное предложение -> [файл блок[индекс]]
const normEn = (s) => stripTags(s).toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

const metrics = []; // {file, key, value} по количественным блокам
const collect = (file, L) => {
  const m = {
    file,
    "idea": L.idea?.length,
    "why": L.why?.length,
    "context.lines": L.context?.lines?.length,
    "context.note.words": words(L.context?.note || ""),
    "russianAngle": L.russianAngle?.length,
    "howToLearn.steps": L.howToLearn?.steps?.length,
    "exercise.items": L.howToLearn?.exercise?.items?.length,
    "markers": L.markers?.length,
    "uses": L.uses?.length,
    "rules": L.rules?.length,
    "examples.groups": L.examples?.length,
    "examples.items": (L.examples || []).reduce((a, g) => a + (g.items?.length || 0), 0),
    "mistakes": L.mistakes?.length,
    "compare.rows": L.compare?.rows?.length,
    "tips": L.tips?.length,
    "quiz": L.quiz?.length,
    "related": L.related?.length,
    "summary.words": words(L.summary || ""),
    "readingTime": L.readingTime,
    "chars": JSON.stringify(L).length,
  };
  metrics.push(m);
};

for (const file of files) {
  const raw = fs.readFileSync(path.join(GDIR, file), "utf8");
  let L;
  try {
    L = JSON.parse(raw);
  } catch (e) {
    ERR("схема", file, "—", `файл не парсится: ${e.message}`);
    continue;
  }
  const slug = file.replace(/\.rocknroll\.json$/, "").replace(/\.json$/, "");
  const isRock = file.includes(".rocknroll.");
  const topic = slug;

  // --- A1. обязательные поля и типы
  for (const k of KEYS) if (!(k in L)) ERR("схема", file, k, "обязательное поле отсутствует");
  for (const k of Object.keys(L))
    if (!KEYS.includes(k) && !OPTIONAL.has(k)) WARN("схема", file, k, "поле вне схемы (проверить, не мёртвое ли)");

  if (L.slug !== slug) ERR("схема", file, "slug", `slug «${L.slug}» не совпадает с именем файла`);
  if (isRock && L.variant !== "rocknroll") ERR("схема", file, "variant", `variant «${L.variant}» у рок-файла`);
  if (!isRock && L.variant !== "classic") ERR("схема", file, "variant", `variant «${L.variant}» у классики`);

  // --- A2. непустые блоки
  const needStr = ["title", "category", "summary"];
  for (const k of needStr) if (!nonEmptyStr(L[k])) ERR("пусто", file, k, `«${k}» пустой или не строка`);
  const needArr = ["idea", "why", "russianAngle", "uses", "tips", "related"];
  for (const k of needArr) if (!arrOfStr(L[k])) ERR("пусто", file, k, `«${k}» — не непустой массив непустых строк`);
  if (!nonEmptyStr(L.context?.note)) WARN("пусто", file, "context.note", "нет пометки о материале сцены");
  if (!Array.isArray(L.context?.lines) || !L.context.lines.length) ERR("пусто", file, "context.lines", "сцена пустая");
  if (!arrOfStr(L.howToLearn?.steps)) ERR("пусто", file, "howToLearn.steps", "шаги пустые");
  if (!nonEmptyStr(L.howToLearn?.exercise?.prompt)) ERR("схема", file, "howToLearn.exercise.prompt", "нет prompt");
  if (!Array.isArray(L.structure) && !L.structure) ERR("пусто", file, "structure", "structure отсутствует");
  // formula/markers могут быть пустыми только у уроков фонетики (поле alphabet) — там формулы нет по природе урока
  if (!nonEmptyStr(L.formula) && !L.alphabet) ERR("пусто", file, "formula", "«formula» пустой");
  if (!nonEmptyStr(L.formula) && L.alphabet) INFO("метрики", file, "formula", "формулы нет (урок фонетики)");
  if (!arrOfStr(L.markers) && !L.alphabet) ERR("пусто", file, "markers", "«markers» пустой");
  if (!arrOfStr(L.markers) && L.alphabet) INFO("метрики", file, "markers", "маркеров нет (урок фонетики)");

  // --- A3. quiz / mistakes / compare / exercise
  (L.quiz || []).forEach((q, i) => {
    if (!nonEmptyStr(q.q)) ERR("схема", file, `quiz[${i}].q`, "пустой вопрос");
    if (!Array.isArray(q.options) || q.options.length < 3) WARN("канон", file, `quiz[${i}].options`, `опций ${q.options?.length ?? 0} (<3)`);
    if (!nonEmptyStr(q.why)) WARN("схема", file, `quiz[${i}].why`, "нет объяснения ответа");
  });
  (L.mistakes || []).forEach((m, i) => {
    if (!nonEmptyStr(m.wrong) || !nonEmptyStr(m.right)) ERR("схема", file, `mistakes[${i}]`, "пустой wrong/right");
    else if (m.wrong.trim() === m.right.trim()) ERR("схема", file, `mistakes[${i}]`, "wrong совпадает с right");
    if (!nonEmptyStr(m.note)) WARN("схема", file, `mistakes[${i}].note`, "нет пояснения");
  });
  (L.compare?.rows || []).forEach((r, i) => {
    if (!isStr(r?.left) || !isStr(r?.right)) ERR("схема", file, `compare.rows[${i}]`, "строка не объект {left,right}");
  });
  (L.howToLearn?.exercise?.items || []).forEach((it, i) => {
    if (!nonEmptyStr(it.q) || !nonEmptyStr(it.a)) ERR("схема", file, `exercise.items[${i}]`, "нет q или a");
  });

  // --- A4. контекст: типы и источники строк
  (L.context?.lines || []).forEach((l, i) => {
    if (!nonEmptyStr(l?.en) || !nonEmptyStr(l?.ru)) ERR("схема", file, `context.lines[${i}]`, "нет en или ru");
    if (l?.type && !LINE_TYPES.has(l.type)) WARN("схема", file, `context.lines[${i}].type`, `неизвестный type «${l.type}»`);
    if ("source" in (l || {}) && !nonEmptyStr(l.source)) WARN("схема", file, `context.lines[${i}].source`, "source пустой");
    if (nonEmptyStr(l?.en) && CYR.test(l.en)) ERR("язык", file, `context.lines[${i}].en`, "кириллица в английской строке");
  });

  // --- A5. examples: highlight-токены внутри en, язык полей
  (L.examples || []).forEach((g, gi) => {
    if (!nonEmptyStr(g.group)) ERR("схема", file, `examples[${gi}].group`, "группа без названия");
    if (!Array.isArray(g.items) || !g.items.length) ERR("схема", file, `examples[${gi}].items`, "группа без примеров");
    (g.items || []).forEach((it, ii) => {
      const p = `examples[${gi}].items[${ii}]`;
      if (!nonEmptyStr(it.en) || !nonEmptyStr(it.ru)) ERR("схема", file, p, "нет en или ru");
      if (nonEmptyStr(it.en) && CYR.test(it.en)) ERR("язык", file, `${p}.en`, "кириллица в английском примере");
      (it.highlight || []).forEach((tok) => {
        if (!it.en.toLowerCase().includes(String(tok).toLowerCase()))
          WARN("подсветка", file, `${p}.highlight`, `токен «${tok}» не найден в примере`);
      });
    });
  });

  // --- A6. язык полей, где ожидается русская проза.
  // Нотация и формулы («Past Continuous = was/were + V-ing.», «Enjoy, avoid → V-ing.») — законный
  // методический аппарат вне idea (решение T18), поэтому строки без кириллицы с символами
  // нотации (= → + /) или короче пяти слов не считаются русской прозой.
  const NOTATION = /[=→+/]|\bV[123]\b|V-ing|V3/;
  const isProse = (s) => nonEmptyStr(s) && !NOTATION.test(s) && s.trim().split(/\s+/).length >= 5;
  for (const [k, v] of [["summary", L.summary], ["context.note", L.context?.note]]) {
    if (nonEmptyStr(v) && !CYR.test(v) && isProse(v)) WARN("язык", file, k, "русское поле без кириллицы");
  }
  (L.why || []).forEach((w, i) => { if (isProse(w) && !CYR.test(w)) WARN("язык", file, `why[${i}]`, "русский пункт без кириллицы"); });
  (L.russianAngle || []).forEach((w, i) => { if (isProse(w) && !CYR.test(w)) WARN("язык", file, `russianAngle[${i}]`, "русский пункт без кириллицы"); });
  (L.tips || []).forEach((w, i) => { if (isProse(w) && !CYR.test(w)) WARN("язык", file, `tips[${i}]`, "совет без кириллицы"); });
  (L.uses || []).forEach((w, i) => { if (isProse(w) && !CYR.test(w)) WARN("язык", file, `uses[${i}]`, "пункт без кириллицы"); });

  // --- A7. related
  (L.related || []).forEach((r, i) => {
    if (r === slug) ERR("ссылки", file, `related[${i}]`, "ссылка на сам себя");
  });

  // --- A8. сбор английских предложений для корпусного дедупа
  const push = (s, p) => {
    if (!nonEmptyStr(s) || !LAT.test(s) || CYR.test(s)) return;
    const key = normEn(s);
    if (key.split(" ").length < 4) return;
    if (!englishLines.has(key)) englishLines.set(key, []);
    englishLines.get(key).push(`${file} ${p}`);
  };
  (L.context?.lines || []).forEach((l, i) => push(l.en, `context.lines[${i}].en`));
  (L.examples || []).forEach((g, gi) => (g.items || []).forEach((it, ii) => push(it.en, `examples[${gi}].items[${ii}].en`)));
  (L.mistakes || []).forEach((m, i) => { push(m.right, `mistakes[${i}].right`); });
  (L.compare?.rows || []).forEach((r, i) => { push(r.left, `compare.rows[${i}].left`); push(r.right, `compare.rows[${i}].right`); });
  (L.quiz || []).forEach((q, i) => (q.options || []).forEach((o, oi) => push(o, `quiz[${i}].options[${oi}]`)));

  collect(file, L);
  if (!lessons.has(topic)) lessons.set(topic, {});
  lessons.get(topic)[isRock ? "rock" : "classic"] = { file, L };
  slugOwner.set(slug, (slugOwner.get(slug) || []).concat(file));
}

// ---------- A9. паритет версий ----------
// Жёсткий канон (CONTEXT §4): why и summary обязаны совпадать. Остальные метаполя должны
// совпадать по смыслу «различается только контент» — расхождение помечаем как замечание.
const PARITY_MUST = ["why", "summary", "level", "title"];
const PARITY_SHOULD = ["category", "readingTime", "related"];
for (const [topic, v] of [...lessons].sort()) {
  if (!v.classic || !v.rock) {
    ERR("пары", `${topic}.json`, "—", `нет пары: ${v.classic ? "rock" : "classic"} отсутствует`);
    continue;
  }
  for (const k of PARITY_MUST) {
    const a = JSON.stringify(v.classic.L[k]);
    const b = JSON.stringify(v.rock.L[k]);
    if (a !== b) ERR("пары", v.rock.file, k, `«${k}» расходится с ${v.classic.file} (обязан совпадать)`);
  }
  for (const k of PARITY_SHOULD) {
    const a = JSON.stringify(v.classic.L[k]);
    const b = JSON.stringify(v.rock.L[k]);
    if (a !== b) WARN("пары", v.rock.file, k, `«${k}» расходится с ${v.classic.file} (версии различаются только контентом)`);
  }
}

// ---------- A10. каталог LEVEL_ORDER ----------
const inOrder = new Map();
for (const [lvl, slugs] of Object.entries(LEVEL_ORDER))
  slugs.forEach((s, i) => {
    if (inOrder.has(s)) ERR("каталог", "lesson-order.js", s, "слаг встречается в каталоге дважды");
    inOrder.set(s, lvl);
  });
for (const [topic, v] of lessons) {
  if (!inOrder.has(topic)) ERR("каталог", "lesson-order.js", topic, "темы нет в LEVEL_ORDER");
  else {
    const lvl = inOrder.get(topic);
    const L = v.classic?.L || v.rock?.L;
    if (L && L.level !== lvl) ERR("каталог", "lesson-order.js", topic, `в каталоге ${lvl}, в файле ${L.level}`);
  }
}
for (const s of inOrder.keys()) if (!lessons.has(s)) ERR("каталог", "lesson-order.js", s, "слаг каталога без файла урока");

// ---------- A11. корпусный дедуп английских предложений ----------
// Классы по смыслу правила «одно предложение — одно место» (CONTEXT §5, T16):
//   WARN  дубли-сцена           — предложение сцены (context) повторено в другом блоке урока;
//   WARN  дубли-между_версиями  — одно предложение в classic и rock одной темы;
//   WARN  дубли-между_уроками   — одно предложение в разных темах;
//   INFO  дубли-упражнения      — повтор между examples/mistakes/compare/quiz: так устроены
//                                 упражнения (квиз проверяет примеры, mistakes показывает ошибку
//                                 на примере, compare ссылается на пример) — не дефект.
const dupStat = { "сцена": 0, "между версиями": 0, "между уроками": 0, "упражнения": 0 };
const blockOf = (p) => p.split(".")[0].replace(/\[\d+\]/g, "");
for (const [key, where] of englishLines) {
  const uniq = [...new Set(where)];
  if (uniq.length < 2) continue;
  const files = uniq.map((w) => w.split(" ")[0]);
  const blocks = uniq.map((w) => (w.split(" ")[1] || "").split(".")[0]);
  const uniqFiles = [...new Set(files)];
  const hasContext = blocks.includes("context");
  let cls;
  if (uniqFiles.length === 1) cls = hasContext ? "сцена" : "упражнения";
  else if (uniqFiles.length === 2 && uniqFiles[0].replace(/\.rocknroll\.json$/, ".json") === uniqFiles[1].replace(/\.rocknroll\.json$/, ".json"))
    cls = "между версиями";
  else cls = "между уроками";
  dupStat[cls]++;
  const sev = cls === "упражнения" ? "INFO" : "WARN";
  add(sev, `дубли-${cls.replace(/ /g, "_")}`, uniqFiles.join(" + "), "—", `«${key}»: ${uniq.join(" | ")}`);
}

// ---------- A12. оценка readingTime ----------
// Считаем прозу урока (русский текст, который читает человек), ~150 слов в минуту.
const proseWords = (L) => {
  const parts = [
    L.summary, ...(L.idea || []), ...(L.why || []), ...(L.russianAngle || []), ...(L.tips || []), ...(L.uses || []),
    (L.context?.lines || []).map((l) => l.ru).join(" "), L.context?.note, ...(L.rules || []).map((r) => r.text),
    ...(L.mistakes || []).map((m) => m.note), ...(L.quiz || []).map((q) => q.why), ...(L.howToLearn?.steps || []),
    ...(L.examples || []).flatMap((g) => (g.items || []).map((it) => it.ru)),
    ...(L.compare?.rows || []).map((r) => `${r.left} ${r.right}`),
  ];
  return parts.filter(Boolean).join(" ").split(/\s+/).filter(Boolean).length;
};
for (const file of files) {
  const L = JSON.parse(fs.readFileSync(path.join(GDIR, file), "utf8"));
  const est = Math.max(3, Math.round(proseWords(L) / 150));
  if (Math.abs((L.readingTime || 0) - est) >= 4)
    WARN("readingTime", file, "readingTime", `заявлено ${L.readingTime} мин, по объёму текста (${proseWords(L)} слов) ≈ ${est} мин`);
}

// ---------- B. канон-метрики: распределения и выбросы ----------
const percent = (arr, p) => {
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(p * a.length))];
};
const KEYS_M = Object.keys(metrics[0]).filter((k) => k !== "file");
const dist = {};
for (const k of KEYS_M) {
  const vals = metrics.map((m) => m[k]).filter((v) => typeof v === "number");
  if (!vals.length) continue;
  const p10 = percent(vals, 0.1);
  const p90 = percent(vals, 0.9);
  dist[k] = { min: Math.min(...vals), p10, median: percent(vals, 0.5), p90, max: Math.max(...vals) };
  for (const m of metrics) {
    const v = m[k];
    if (typeof v !== "number") continue;
    if (v < p10) INFO("метрики", m.file, k, `${k} = ${v} ниже типичного (p10 = ${p10})`);
    else if (v > p90) INFO("метрики", m.file, k, `${k} = ${v} выше типичного (p90 = ${p90})`);
  }
}
// Канон-конфликты: то, что канон описывает числами (SKILLS.md / CONTEXT.md).
for (const m of metrics) {
  if (m["why"] < 6 || m["why"] > 10) WARN("канон", m.file, "why", `why = ${m["why"]} (канон: 6–10)`);
  if (m["quiz"] !== 6) WARN("канон", m.file, "quiz", `вопросов ${m["quiz"]} (канон: 6)`);
  if (m["mistakes"] < 5 || m["mistakes"] > 7) WARN("канон", m.file, "mistakes", `mistakes = ${m["mistakes"]} (канон: 6)`);
  if (m["examples.items"] < 18) WARN("канон", m.file, "examples.items", `примеров ${m["examples.items"]} (канон: 18–24)`);
}

// ---------- D. заметки ----------
const cards = [];
const cheats = new Map(); // id карточки -> {file, card}
for (const f of fs.readdirSync(CDIR).filter((x) => x.endsWith(".json")).sort()) {
  const C = JSON.parse(fs.readFileSync(path.join(CDIR, f), "utf8"));
  const topicIds = new Set();
  for (const c of C.topics || []) {
    cards.push({ file: f, card: c });
    const p = `topics[${c.id}]`;
    if (topicIds.has(c.id)) ERR("заметки", f, p, "карточка с таким id в файле дважды");
    topicIds.add(c.id);
    cheats.set(c.id, { file: f, card: c });
    for (const k of ["id", "title", "titleRu", "category", "use", "points", "examples", "pitfalls", "note"])
      if (!(k in c)) ERR("заметки", f, p, `нет поля ${k}`);
    // formula/markers у справочных карточек не обязательны — на них валидатор cheats не жалуется
    if (!("formula" in c)) WARN("заметки", f, p, "нет поля formula");
    if (!("markers" in c)) WARN("заметки", f, p, "нет поля markers");
    if (!nonEmptyStr(c.note)) WARN("заметки", f, p, "нет полей note");
    if (!Array.isArray(c.use) || c.use.length < 2) WARN("заметки", f, p, `use = ${c.use?.length ?? 0} (мало)`);
    if (!Array.isArray(c.points) || c.points.length < 2) WARN("заметки", f, p, `points = ${c.points?.length ?? 0} (мало)`);
    if (!Array.isArray(c.examples) || c.examples.length < 6) WARN("заметки", f, p, `examples = ${c.examples?.length ?? 0} (меньше 6 — кандидат на расширение)`);
    if (!Array.isArray(c.pitfalls) || !c.pitfalls.length) WARN("заметки", f, p, "нет pitfalls");
    if (c.lesson && !lessons.has(String(c.lesson).replace(/^\/grammar\//, "")))
      ERR("заметки", f, p, `lesson «${c.lesson}» не найден среди уроков`);
    (c.examples || []).forEach((e, i) => {
      if (!nonEmptyStr(e.en) || !nonEmptyStr(e.ru)) ERR("заметки", f, p, `examples[${i}] без en/ru`);
    });
  }
}
// покрытие: у каждого урока есть карточка; справочные карточки без lesson — норма
for (const [topic, v] of lessons) {
  const card = cheats.get(topic);
  if (!card) WARN("заметки", `${topic}.json`, "—", "нет карточки заметок для урока");
}
// согласованность карточки с уроком: формула/маркеры/примеры
for (const [id, { file, card }] of cheats) {
  const v = lessons.get(id);
  if (!v) continue; // справочная карточка
  const L = v.classic.L;
  const cardEx = new Set((card.examples || []).map((e) => normEn(e.en)));
  const lessonEx = new Set();
  (L.examples || []).forEach((g) => (g.items || []).forEach((it) => lessonEx.add(normEn(it.en))));
  const dup = [...cardEx].filter((x) => lessonEx.has(x));
  if (dup.length) INFO("заметки", file, id, `примеры карточки повторяются в уроке: ${dup.length}`);
  const mCard = (card.markers || []).map((s) => String(s).toLowerCase());
  const mLesson = (L.markers || []).map((s) => String(s).toLowerCase());
  const missing = mCard.filter((m) => !mLesson.includes(m));
  if (missing.length) INFO("заметки", file, id, `маркеры карточки вне списка урока: ${missing.join(", ")}`);
  if (JSON.stringify(card.formula) === JSON.stringify(L.formula)) INFO("заметки", file, id, "formula карточки дословно совпадает с уроком");
}

// ---------- отчёт ----------
const byClass = new Map();
for (const f of F) {
  const k = `${f.severity} ${f.cls}`;
  byClass.set(k, (byClass.get(k) || 0) + 1);
}
const perFile = new Map();
for (const f of F) {
  if (!perFile.has(f.file)) perFile.set(f.file, { ERROR: 0, WARN: 0, INFO: 0 });
  perFile.get(f.file)[f.severity]++;
}

console.log(`Аудит: уроков ${lessons.size} тем / ${files.length} файлов, карточек заметок ${cards.length}.`);
console.log(`Находок: ${F.length} (ERROR ${F.filter((f) => f.severity === "ERROR").length}, WARN ${F.filter((f) => f.severity === "WARN").length}, INFO ${F.filter((f) => f.severity === "INFO").length}).\n`);
console.log("=== по классам ===");
[...byClass].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${n} — ${k}`));
console.log("\n=== распределения (min / p10 / медиана / p90 / max) ===");
for (const [k, d] of Object.entries(dist)) console.log(`  ${k}: ${d.min} / ${d.p10} / ${d.median} / ${d.p90} / ${d.max}`);
if (list) {
  console.log("\n=== находки ===");
  const order = { ERROR: 0, WARN: 1, INFO: 2 };
  [...F].sort((a, b) => order[a.severity] - order[b.severity] || a.cls.localeCompare(b.cls)).forEach((f) =>
    console.log(`  [${f.severity}] ${f.cls} | ${f.file} ${f.p} — ${f.msg}`)
  );
}
if (dump) {
  const dir = path.join(root, "_audit-report");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "lessons.json"), JSON.stringify({ metrics, dist, perFile: Object.fromEntries(perFile), findings: F.filter((f) => !f.cls.includes("заметки")) }, null, 1), "utf8");
  fs.writeFileSync(path.join(dir, "cheats.json"), JSON.stringify({ cards: cards.length, findings: F.filter((f) => f.cls.includes("заметки")) }, null, 1), "utf8");
  console.log(`\nВыгружено: _audit-report/lessons.json, _audit-report/cheats.json`);
}
