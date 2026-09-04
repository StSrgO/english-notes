// T2 (план шпаргалок): каркас src/data/cheats/{level}.json из уроков грамматики.
// Собирает темы уровня (id/title/category/lesson) в методическом порядке LEVEL_ORDER.
// Контент карточек (titleRu/use/formula/points/examples/note) заполняется вручную.
// Запуск: node scripts/scaffold-cheats.mjs [--force]  →  exit 0 = OK, exit 1 = ошибки.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEVELS, LEVEL_ORDER } from "../src/data/lesson-order.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = (...p) => path.join(__dirname, "..", ...p);
const outDir = root("src", "data", "cheats");

// Русские названия уровней для шапок/карточек (level — единственное место CEFR-кода в контенте)
const LEVEL_NAMES = {
  A0: "С нуля",
  A1: "Начальный",
  A2: "Элементарный",
  B1: "Средний",
  B2: "Выше среднего",
  C1: "Продвинутый",
  C2: "Свободный"
};

const readLesson = (slug) => {
  const p = root("src", "data", "grammar", slug + ".json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
};

// У карточки есть авторский контент — файл руками не перезаписываем без --force
const hasAuthored = (file) => {
  const t = file.topics || [];
  return t.some((x) => x.titleRu || x.use || x.note || x.formula?.length || x.points?.length || x.examples?.length);
};

fs.mkdirSync(outDir, { recursive: true });
const force = process.argv.includes("--force");
const errors = [];
const written = [];

for (const level of LEVELS) {
  const topics = (LEVEL_ORDER[level] || [])
    .map((slug) => {
      const lesson = readLesson(slug);
      if (!lesson) { errors.push(`${level}: нет классического урока ${slug}.json`); return null; }
      return {
        id: lesson.slug,
        title: lesson.title,
        titleRu: "",
        category: lesson.category,
        use: "",
        formula: [],
        points: [],
        examples: [],
        note: "",
        lesson: "/grammar/" + lesson.slug
      };
    })
    .filter(Boolean);

  const filePath = root("src", "data", "cheats", level.toLowerCase() + ".json");
  const file = {
    level,
    label: `${level} · ${LEVEL_NAMES[level]}`,
    topics
  };

  if (fs.existsSync(filePath)) {
    const existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!force && hasAuthored(existing)) { written.push(`skip ${filePath}`); continue; }
  }

  fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + "\n");
  written.push(`${level}: ${topics.length} тем → src/data/cheats/${level.toLowerCase()}.json`);
}

console.log(written.join("\n"));
if (errors.length) {
  console.error("\nОшибки:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("\nOK: каркас готов, контент карточек пуст — заполняется вручную.");
