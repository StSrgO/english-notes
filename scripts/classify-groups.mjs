// T3 (план словаря): распределение топ-200 по группам.
// Читает scripts/_top200.json (v1, rank, v2, v3), выдаёт scripts/_groups.json.
//
// Таксономия — по §3.2 плана; группы >35 слов разбиты на подгруппы (правило плана «дробить»):
//   1. aaa-identical  — v2===v1 && v3===v1
//   2. abb-ought      — v2===v3 на -ought/-aught
//   3. abb-t          — v2===v3 на -t (v1 без -t): feel→felt, build→built
//   4. abb-vowel      — v2===v3, зубной аблаут на -d/-t: have→had, meet→met (+ составные)
//   5. abb-u          — v2===v3, u/ou/o-аблаут: dig→dug, bind→bound, find→found (дробление abb-vowel)
//   6. abc-i-a-u      — i→a→u: sing→sang→sung
//   7. abc-en         — v3 на -en: take→took→taken
//   8. abc-n          — v3 на -n (не -en): wear→wore→worn (дробление abc-en)
//   9. abc-ew-own     — ew→own: know→knew→known
//  10. abc-mixed      — особые: be/go/do/see, v3===v1 (come), v2===v1 (beat), undo/overdo/undergo
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "_top200.json"), "utf8"));

const MIXED_HARD = new Set(["be", "go", "do", "see", "undo", "overdo", "undergo"]);
// v2===v3 с u/ou/o-аблаутом (не зубной -d/-t): dug, struck, won, shone + -ound-семья
const U_GROUP = new Set(["dig", "win", "shine", "hang", "strike", "sting", "stick", "cling", "fling", "sling", "swing", "spin", "sneak", "find", "bind", "wind", "grind", "abide"]);

function classify(v) {
  const { v1, v2, v3 } = v;
  if (v2 === v1 && v3 === v1) return "aaa-identical";
  if (v2 === v3) {
    if (v2.endsWith("ought") || v2.endsWith("aught")) return "abb-ought";
    if (U_GROUP.has(v1)) return "abb-u";
    if (v2.endsWith("t") && !v1.endsWith("t")) return "abb-t";
    return "abb-vowel";
  }
  if (v2.endsWith("ew") && v2 !== v1 && v3.endsWith("wn")) return "abc-ew-own";
  if (MIXED_HARD.has(v1) || v3 === v1 || v2 === v1) return "abc-mixed";
  if (v2 === v1.replace("i", "a") && v3 === v1.replace("i", "u")) return "abc-i-a-u";
  if (v3.endsWith("en")) return "abc-en";
  if (v3.endsWith("n")) return "abc-n";
  return "abc-mixed";
}

const groups = new Map();
for (const v of data.verbs) {
  const id = classify(v);
  if (!groups.has(id)) groups.set(id, []);
  groups.get(id).push(v);
}

const order = ["aaa-identical", "abb-ought", "abb-t", "abb-vowel", "abb-u", "abc-i-a-u", "abc-en", "abc-n", "abc-ew-own", "abc-mixed"];
let total = 0;
let bad = [];
for (const id of order) {
  const g = groups.get(id) || [];
  g.sort((a, b) => a.rank - b.rank);
  total += g.length;
  if (g.length < 8 || g.length > 35) bad.push(`${id}=${g.length}`);
  console.log(`${id.padEnd(14)} ${String(g.length).padStart(3)}  ${g.map((x) => x.v1).join(", ")}`);
}
console.log("total:", total, total === 200 ? "OK" : "!!! != 200");
console.log("нарушения размера 8–35:", bad.length ? bad.join(", ") : "нет");

fs.writeFileSync(path.join(__dirname, "_groups.json"), JSON.stringify({
  source: "scripts/_top200.json; таксономия §3.2 плана с дроблением групп >35",
  built: new Date().toISOString().slice(0, 10),
  groups: order.map((id) => ({
    id,
    words: (groups.get(id) || []).map((w) => ({ v1: w.v1, rank: w.rank, v2: w.v2, v3: w.v3 })),
  })),
}, null, 1));
console.log("saved: scripts/_groups.json");
