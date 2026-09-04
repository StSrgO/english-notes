// T6/T7 (план шпаргалок): валидация src/data/cheats/{a0..c2}.json.
// Проверяет: состав и порядок тем = LEVEL_ORDER классических уроков, у каждой
// карточки непустые use/formula/points/examples + titleRu, ссылки lesson ведут
// на существующие классические уроки, в файле уровня нет повторов примеров.
// Запуск: node scripts/validate-cheats.mjs  →  exit 0 = OK, exit 1 = найдены ошибки.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEVELS, LEVEL_ORDER } from "../src/data/lesson-order.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = (...p) => path.join(__dirname, "..", ...p);
const read = (...p) => JSON.parse(fs.readFileSync(root(...p), "utf8"));

const errors = [];
let totalTopics = 0;

for (const level of LEVELS) {
  const expected = LEVEL_ORDER[level] || [];
  const filePath = root("src", "data", "cheats", level.toLowerCase() + ".json");
  if (!fs.existsSync(filePath)) { errors.push(`${level}: нет файла cheats/${level.toLowerCase()}.json`); continue; }

  const file = read("src", "data", "cheats", level.toLowerCase() + ".json");
  if (file.level !== level) errors.push(`${level}: level = «${file.level}»`);
  if (!file.label || !file.label.startsWith(level + " · ")) errors.push(`${level}: label «${file.label}» не начинается с «${level} · »`);

  const ids = (file.topics || []).map((t) => t.id);
  if (ids.length !== expected.length) errors.push(`${level}: тем ${ids.length}, ожидалось ${expected.length}`);
  expected.forEach((slug, i) => {
    if (ids[i] !== slug) errors.push(`${level}: тема #${i + 1} = «${ids[i]}», ожидался урок «${slug}»`);
  });
  if (new Set(ids).size !== ids.length) errors.push(`${level}: повторяющиеся id тем`);
  totalTopics += ids.length;

  const seenEn = new Set();
  for (const t of file.topics || []) {
    const where = `${level}/${t.id}`;
    if (t.title !== undefined && !t.title) errors.push(`${where}: пустой title`);
    if (!t.titleRu) errors.push(`${where}: пустой titleRu`);
    if (!t.category) errors.push(`${where}: пустой category`);
    if (!t.use) errors.push(`${where}: пустой use`);
    if (!Array.isArray(t.formula) || !t.formula.length || t.formula.some((l) => typeof l !== "string" || !l.trim()))
      errors.push(`${where}: formula должен быть непустым массивом строк`);
    if (!Array.isArray(t.points) || !t.points.length || t.points.length > 4 || t.points.some((p) => typeof p !== "string" || !p.trim()))
      errors.push(`${where}: points — массив из 1–4 непустых строк`);
    if (!Array.isArray(t.examples) || !t.examples.length || t.examples.length > 2)
      errors.push(`${where}: examples — массив из 1–2 примеров`);
    for (const ex of t.examples || []) {
      if (!ex || typeof ex.en !== "string" || !ex.en.trim() || typeof ex.ru !== "string" || !ex.ru.trim())
        errors.push(`${where}: пример без en/ru`);
      else if (seenEn.has(ex.en)) errors.push(`${where}: повтор примера «${ex.en}»`);
      else seenEn.add(ex.en);
    }
    if (t.lesson !== "/grammar/" + t.id) errors.push(`${where}: lesson «${t.lesson}» не совпадает с id`);
    else if (!fs.existsSync(root("src", "data", "grammar", t.id + ".json")))
      errors.push(`${where}: нет классического урока grammar/${t.id}.json`);
  }
}

if (errors.length) {
  console.error("Ошибки шпаргалок:\n" + errors.join("\n"));
  process.exit(1);
}
console.log(`OK: шпаргалки валидны — ${totalTopics} тем в ${LEVELS.length} файлах уровней.`);
