// T9 (план словаря): сборка финального src/data/vocabulary/irregular-verbs.json
// из scripts/_verbs.json (200 глаголов: v1/v2/v3/rank/ipa/ru) + метаданных групп.
// Схема записи — §3.1 плана; example/quiz появятся на T6/T7 (сейчас их нет — страница
// рендерит без них). Порядок групп и слов внутри — по рангу. Воспроизводимо: node scripts/build-irregular-verbs.mjs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Метаданные 10 групп (имена — рабочие, легко поменять в этом словаре):
// id: [groupName (EN), groupNameRu, chip (короткая подпись для sticky-навигации)]
const GROUP_META = {
  "aaa-identical": ["All three forms are the same", "Все три формы одинаковые", "same forms"],
  "abb-ought": ["V2 and V3 end in -ought / -aught", "Вторая и третья формы на -ought / -aught", "-ought / -aught"],
  "abb-t": ["V2 and V3 end in -t", "Вторая и третья формы на -t", "-t"],
  "abb-vowel": ["V2 and V3 change the vowel", "Вторая и третья формы меняют гласную", "vowel change"],
  "abb-u": ["V2 and V3: the vowel becomes u / ou", "Вторая и третья формы: гласная → u / ou", "u / ou"],
  "abc-i-a-u": ["Vowel pattern i → a → u", "Гласные i → a → u", "i → a → u"],
  "abc-en": ["V3 ends in -en", "Третья форма на -en", "-en"],
  "abc-n": ["V3 ends in -n", "Третья форма на -n", "-n"],
  "abc-ew-own": ["V2 in -ew, V3 in -own", "Вторая форма на -ew, третья на -own", "ew → own"],
  "abc-mixed": ["Special cases", "Особые случаи", "special"],
};

const groupsJson = JSON.parse(fs.readFileSync(path.join(__dirname, "_groups.json"), "utf8"));
const verbsJson = JSON.parse(fs.readFileSync(path.join(__dirname, "_verbs.json"), "utf8"));
const byV1 = new Map(verbsJson.verbs.map((v) => [v.v1, v]));

const groups = [];
let total = 0;
for (const g of groupsJson.groups) {
  const meta = GROUP_META[g.id];
  if (!meta) throw new Error(`нет метаданных для группы ${g.id}`);
  const words = g.words
    .map((w) => byV1.get(w.v1))
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank)
    .map((v) => ({
      v1: v.v1,
      v2: v.v2,
      v3: v.v3,
      rank: v.rank,
      ipa: v.ipa,
      ru: v.ru,
    }));
  if (words.length !== g.words.length) throw new Error(`группа ${g.id}: потеряны слова`);
  total += words.length;
  groups.push({ id: g.id, groupName: meta[0], groupNameRu: meta[1], chip: meta[2], words });
}
if (total !== 200) throw new Error(`total != 200: ${total}`);

const out = {
  slug: "irregular-verbs",
  title: "Irregular Verbs",
  titleRu: "Неправильные глаголы",
  icon: "⚡",
  intro:
    "200 самых частотных неправильных глаголов английского языка: все три формы, транскрипция и перевод. " +
    "Группы по типу образования форм помогают запомнить их быстрее.",
  total,
  groups,
};

const target = path.join(__dirname, "..", "src", "data", "vocabulary", "irregular-verbs.json");
fs.writeFileSync(target, JSON.stringify(out, null, 1) + "\n");
console.log("saved:", target, "| групп:", groups.length, "| слов:", total);
