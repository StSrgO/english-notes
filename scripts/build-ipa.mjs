// T4 (план словаря): IPA для V1/V2/V3 топ-200 неправильных глаголов.
// Источник: en.wiktionary.org, страницы отдельных форм (read, took, was, taken...).
// Решение пользователя: BrE (RP/UK/SSB) основной; AmE (GA/US/GenAm) добавляется через "/",
//   только когда произношение заметно отличается после нормализации:
//   игнорируются длина гласной (ː), ударение и ротацизм-после-гласной.
// Омографы и «бедные» страницы (только US/только аудио) — ручные OVERRIDES.
// Вывод: scripts/_verbs.json (плоский список 200: v1,v2,v3,rank,group,ipa[3]).
// Кэш страниц: %TEMP%\vocab-redesign\wiktionary-pages\<token>.txt (вне репо).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(os.tmpdir(), "vocab-redesign", "wiktionary-pages");
fs.mkdirSync(CACHE_DIR, { recursive: true });

const UA = { "User-Agent": "EnglishNotes-vocab-builder/0.1 (offline IPA extraction)" };

// ---------- ручные правки: (v1 + slot) -> точная IPA-строка (BrE[/AmE]) ----------
const OVERRIDES = {
  "be:v1": "biː",
  "be:v2": "wɒz/wɜː",        // was/were (сильные формы; AmE-варианты was/were не зеркалим)
  "be:v3": "biːn/bɪn",       // been: BrE biːn, AmE преим. bɪn
  "read:v1": "riːd",
  "read:v2": "rɛd",
  "read:v3": "rɛd",
  "wind:v1": "waɪnd",
  "wind:v2": "waʊnd",
  "wind:v3": "waʊnd",
  "lead:v1": "liːd",
  "tear:v1": "tɛə",
  "sow:v1": "səʊ/soʊ",
  "arise:v2": "əˈrəʊz/əˈroʊz",  // страница arose без UK-варианта
  "overhear:v1": "ˌəʊvəˈhɪə/ˌoʊvərˈhɪr", // на странице только US + аудио UK
  "foresee:v2": "fɔːˈsɔː/ˌfɔːrˈsɑː",   // страница foresaw только US
  "foresee:v3": "fɔːˈsiːn/ˌfɔːrˈsiːn", // страница foreseen только US
  "write:v1": "raɪt",        // US-чтение /rəɪt/ — канадский подъём, не GA-норма
  "slay:v2": "sluː",         // /slɪu/ Welsh и /sl(j)uː/ — не то
  "resend:v1": "riːˈsɛnd",   // на странице мусор "<q:verb>"
  "resend:v2": "riːˈsɛnt",
  "resend:v3": "riːˈsɛnt",
  "forbid:v2": "fəˈbæd",     // страница forbad может отсутствовать
  "alight:v2": "əˈlɪt",      // alit может редиректить на alight
  "alight:v3": "əˈlɪt",
  "saw:v2": "sɔːd",          // sawed: только аудио на странице
  "saw:v3": "sɔːn",          // sawn: то же
  "undergo:v3": "ˌʌndəˈɡɒn/ˌʌndərˈɡɔːn", // undergone: только аудио
  "input:v1": "ɪnˈpʊt",
  "input:v2": "ɪnˈpʊt",
  "input:v3": "ɪnˈpʊt",
  "output:v1": "aʊtˈpʊt",
  "output:v2": "aʊtˈpʊt",
  "output:v3": "aʊtˈpʊt",
  "offset:v1": "ɒfˈsɛt/ɔːfˈsɛt",
  "offset:v2": "ɒfˈsɛt/ɔːfˈsɛt",
  "offset:v3": "ɒfˈsɛt/ɔːfˈsɛt",
  "wed:v1": "wɛd",
  "upset:v1": "ʌpˈsɛt",
  "upset:v2": "ʌpˈsɛt",
  "upset:v3": "ʌpˈsɛt",
  "shake:v2": "ʃʊk",          // shook: на странице только диалектные чтения
  "strive:v2": "strəʊv/stroʊv", // strove: страница даёт только обобщённое /strɔʊv/
  "thrive:v1": "θraɪv",        // thrive: на странице /θɹajv/ — опечатка вики
  "sing:v2": "sæŋ",            // sang: GA-чтение с æ-raising — региональное
  "sink:v2": "sæŋk",           // sank: то же
  "shrink:v2": "ʃræŋk",        // shrank: то же
  "break:v3": "ˈbrəʊkən/ˈbroʊkən", // broken: /broʊkɪn/ — вариант, основной GA /broʊkən/
  "overtake:v1": "ˌəʊvəˈteɪk/ˌoʊvərˈteɪk",  // страница: /əʊvəːˈteɪk/ c əː
  "overtake:v3": "ˌəʊvəˈteɪkən/ˌoʊvərˈteɪkən", // overtaken: только /ˈəʊvəɹteɪkən/ без ударения на 2-м
  "overthrow:v2": "ˌəʊvəˈθruː/ˌoʊvərˈθruː", // overthrew: на странице только US
  "overthrow:v3": "ˌəʊvəˈθrəʊn/ˌoʊvərˈθroʊn", // overthrown: только US
  "underwrite:v1": "ˌʌndəˈraɪt/ˌʌndərˈraɪt",
  "underwrite:v2": "ˌʌndəˈrəʊt/ˌʌndərˈroʊt",
  "underwrite:v3": "ˌʌndəˈrɪtən/ˌʌndərˈrɪtən",
  "rewrite:v1": "riːˈraɪt",    // страница даёт /ˈriːraɪt/ — ударение не на write
  "awake:v2": "əˈwəʊk/əˈwoʊk", // awoke: страница без US-чтения
  "awake:v3": "əˈwəʊkən/əˈwoʊkən",
  "fight:v1": "faɪt",          // US /fəɪt/ — канадский подъём, GA-норма faɪt
  "forecast:v1": "ˈfɔːkɑːst/ˈfɔːrkæst",
  "forecast:v2": "ˈfɔːkɑːst/ˈfɔːrkæst",
  "forecast:v3": "ˈfɔːkɑːst/ˈfɔːrkæst",
  "broadcast:v1": "ˈbrɔːdkɑːst/ˈbrɔːdkæst",
  "broadcast:v2": "ˈbrɔːdkɑːst/ˈbrɔːdkæst",
  "broadcast:v3": "ˈbrɔːdkɑːst/ˈbrɔːdkæst",
};

// ---------- загрузка/кэш страниц ----------
const PACE_MS = Number(process.env.IPA_PACE_MS || 300);
const WORKERS_N = Number(process.env.IPA_WORKERS || 3);

async function fetchRaw(token) {
  const file = path.join(CACHE_DIR, `${token}.txt`);
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`https://en.wiktionary.org/wiki/${encodeURIComponent(token)}?action=raw`, { headers: UA });
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after")) || 5 + attempt * 10;
      console.log(`429 ${token}: ждём ${wait}s`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${token}`);
    const text = await res.text();
    fs.writeFileSync(file, text);
    return text;
  }
  throw new Error(`429 x6 for ${token}`);
}

// ---------- парсер викитекста ----------
// Многословные ярлыки акцентов (сначала длиннейшие, чтобы не разбить "Northern England")
const BR_PHRASES = ["Southern England", "England", "RP", "UK", "SSB", "BrE"];
const US_PHRASES = ["N.Amer", "GenAm", "GA", "US", "North American"];
const DIALECT_PHRASES = ["Mid-Atlantic US", "Southern US", "Midland US", "Northern US", "Western US",
  "Upper Midwestern US", "Inland North", "Ottawa Valley", "New England", "Northern England",
  "Midlands", "Northumbria", "Wearside", "Teesside", "Scouse", "Lancashire", "Humberside", "MLE",
  "Yorkshire", "Scotland", "Wales", "Welsh", "Ireland", "Dublin", "Cork", "Ulster", "Australia",
  "New Zealand", "NZ", "South Africa", "AU", "AusE", "AAVE", "Southern American", "Philippine",
  "Singapore", "Hong Kong", "India", "Indian", "South African", "General South African",
  "Canada", "CA", "Canadian"];
// полный словарь для жадного разбора: длина -> scope
const ACCENT_PHRASES = [
  ...BR_PHRASES.map((p) => ({ p, s: "br" })),
  ...US_PHRASES.map((p) => ({ p, s: "us" })),
  ...DIALECT_PHRASES.map((p) => ({ p, s: "dialect" })),
].sort((a, b) => b.p.length - a.p.length);

function parseAccentValue(s) {
  // Разобрать содержимое a=/aa=: вернуть {scopes:[], tags:[]}
  const scopes = [];
  const tags = [];
  const clean = s.replace(/<<|>>/g, "").trim();
  let rest = clean;
  while (rest) {
    const t = rest.trimStart();
    let matched = false;
    for (const { p, s: scope } of ACCENT_PHRASES) {
      if (t === p || t.startsWith(p + ",") || t.startsWith(p + " ")) {
        scopes.push(scope);
        rest = t.slice(p.length).replace(/^[,;\s]+/, "");
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (t.startsWith("weak form") || t.startsWith("strong form")) {
      const kw = t.startsWith("weak form") ? "weak form" : "strong form";
      tags.push(kw);
      rest = t.slice(kw.length).replace(/^[,;\s]+/, "");
      continue;
    }
    // отдельное слово/мусор — до следующей запятой-пробела
    const m = /^([^,;\s]+)[,;\s]*/.exec(t);
    if (m) {
      tags.push(m[1].replace(/[;.]$/, ""));
      rest = t.slice(m[0].length);
    } else break;
  }
  return { scopes, tags };
}

function splitTop(s) {
  const out = [];
  let depth = 0, cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s.startsWith("{{", i)) { depth++; cur += "{{"; i++; continue; }
    if (s.startsWith("}}", i)) { depth = Math.max(0, depth - 1); cur += "}}"; i++; continue; }
    if (s[i] === "|" && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += s[i];
  }
  if (cur.trim()) out.push(cur);
  return out;
}

// чтение валидно: без wiki-разметки и пробелов; комбинируемые диакритики чистим позже
const IPA_READING_RE = /^[^\[\]{}<>\s]{1,40}$/;

function parseIpaTemplate(body) {
  // body — содержимое {{IPA|en|...}} (без обёртки)
  const params = splitTop(body);
  const readings = [];
  const meta = { scopes: [], tags: [] };
  for (const p of params) {
    const t = p.trim();
    if (t.startsWith("/") && t.endsWith("/")) {
      const ipa = t.slice(1, -1).trim();
      if (IPA_READING_RE.test(ipa) && !/[[\]{}<>]/.test(ipa)) readings.push(ipa);
    } else if (/^a{1,2}\d*=/.test(t) || /^a=/.test(t)) {
      const { scopes, tags } = parseAccentValue(t.replace(/^a{1,2}\d*=/, ""));
      meta.scopes.push(...scopes);
      meta.tags.push(...tags);
    } else if (/^a\d+=/.test(t)) {
      const { scopes, tags } = parseAccentValue(t.replace(/^a\d*=/, ""));
      meta.scopes.push(...scopes);
      meta.tags.push(...tags);
    }
  }
  return readings.map((ipa) => ({ ipa, scopes: [...meta.scopes], tags: [...meta.tags] }));
}

function extractIpaTemplates(line) {
  const out = [];
  let i = 0;
  while ((i = line.indexOf("{{IPA|en|", i)) !== -1) {
    let depth = 0, j = i;
    for (; j < line.length; j++) {
      if (line.startsWith("{{", j)) { depth++; j += 1; }
      else if (line.startsWith("}}", j)) { depth--; j += 1; if (depth === 0) break; }
    }
    const body = line.slice(i + 9, j - 1);
    out.push(...parseIpaTemplate(body));
    i = j;
  }
  return out;
}

// enPR-шаблон на строке: {{enPR|tôt|a=RP}} или {{enPR|tät|a=cot-caught}}
function lineEnprMeta(line) {
  const scopes = [];
  const tags = [];
  const re = /\{\{enPR\|[^}]*?\|\s*a=([^}|]+)/g;
  let m;
  while ((m = re.exec(line))) {
    const { scopes: s, tags: t } = parseAccentValue(m[1].trim());
    scopes.push(...s);
    tags.push(...t);
  }
  return { scopes, tags };
}

function parseEnglish(text) {
  const lines = text.split(/\n/);
  let enStart = -1, enEnd = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(={2})\s*([^=]+?)\s*\1\s*$/.exec(lines[i]);
    if (!m) continue;
    if (m[2].trim() === "English") enStart = i;
    else if (enStart !== -1) { enEnd = i; break; }
  }
  if (enStart === -1) return [];
  return lines.slice(enStart + 1, enEnd);
}

function collectReadings(text) {
  const en = parseEnglish(text);
  const isHead = (l) => /^(={2,6})\s*([^=]+?)\s*\1\s*$/.exec(l);

  const sections = [];
  let cur = null;
  for (const line of en) {
    const h = isHead(line);
    if (h) {
      const depth = h[1].length;
      const name = h[2].trim();
      if ((name === "Pronunciation" || name.startsWith("Pronunciation ")) && (depth === 3 || depth === 4)) {
        cur = { bullets: [] };
        sections.push(cur);
      } else if (depth <= 4) cur = null;
      continue;
    }
    if (cur && /^\*+/.test(line.trimStart())) cur.bullets.push(line.trimStart());
  }

  // Несколько секций — берём первую (главное значение/этимологию страницы)
  const restrict = sections.length > 1 ? [sections[0]] : sections;
  const readings = [];
  for (const sec of restrict) {
    const accStack = []; // акцент-скоупы, объявленные на меньшей глубине буллета
    for (const line of sec.bullets) {
      const bd = (line.match(/^\*+/) || [""])[0].length;
      accStack.length = bd - 1;
      // скоупы, объявленные НА ЭТОЙ строке: {{a|en|...}}, a=/aa= у IPA, a= у enPR
      const ownScopes = new Set();
      const aRe = /\{\{a\|en\|([^}|]+)/g;
      let m;
      while ((m = aRe.exec(line))) {
        const { scopes } = parseAccentValue(m[1]);
        for (const sc of scopes) ownScopes.add(sc);
      }
      const ambient = new Set();
      for (const s of accStack) if (s) for (const x of s) ambient.add(x);
      const enpr = lineEnprMeta(line);
      for (const sc of enpr.scopes) ownScopes.add(sc);
      const ipas = extractIpaTemplates(line);
      for (const r of ipas) for (const sc of r.scopes) ownScopes.add(sc);
      // распространить на под-буллеты (cot-caught вложен под GA-чтением)
      if (ownScopes.size) {
        accStack[bd - 1] ??= new Set();
        for (const sc of ownScopes) accStack[bd - 1].add(sc);
      }
      for (const r of ipas) {
        const scopes = [...new Set([...ambient, ...ownScopes])];
        const tags = [...r.tags, ...enpr.tags];
        readings.push({ ipa: r.ipa, scopes, tags });
      }
    }
  }
  return readings;
}

// ---------- нормализация и выбор ----------
function cleanIpa(s) {
  return s
    .replace(/\(r\)/g, "").replace(/\(ɹ\)/g, "").replace(/\(j\)/g, "").replace(/\(ə\)/g, "ə")
    .replace(/\(ː\)/g, "ː").replace(/[()]/g, "")
    .replace(/\./g, "")
    .replace(/n\u0329/g, "ən").replace(/l\u0329/g, "əl").replace(/m\u0329/g, "əm")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ɐ/g, "ʌ").replace(/ɫ/g, "l").replace(/ɻ/g, "r").replace(/ɹ/g, "r")
    .trim();
}
function normForCompare(s) {
  return cleanIpa(s)
    .replace(/ɚ/g, "ər").replace(/ɝ/g, "ɜr")
    .replace(/o(?!ʊ)/g, "ɔ") // AmE "o" (born) = BrE ɔː
    .replace(/([ɑɔɛəɜɪʊɒʌa])(ː?)(r)/g, "$1$2") // ротацизм после гласной — не отличие
    .replace(/[ːˈˌ]/g, "")
    .replace(/[()]/g, "");
}
function forDisplay(s) {
  // снять ударение с односложных (в слове нет ˌ и только одна гласная группа)
  const cleaned = cleanIpa(s).replace(/ɚ/g, "ər").replace(/ɝ/g, "ɜr");
  const noStress = cleaned.replace(/[ˈˌ]/g, "");
  const vowelGroups = (noStress.match(/[iɪeɛæɑɒɔouʊʌəɜaɐ]+/g) || []).length;
  if (vowelGroups === 1 && !cleaned.includes("ˌ")) return cleaned.replace(/^ˈ/, "");
  return cleaned;
}

const TAG_SKIP = ["obsolete", "early", "dialectal", "colloquial", "nonstandard", "regional",
  "archaic", "rare", "rapid", "idiosyncratic", "dated"];
// предпочтения среди US-чтений: cot-caught (слияние — норма GA) важнее non-cot-caught
function isUsScope(r) { return r.scopes.includes("us"); }
function isBrScope(r) { return r.scopes.includes("br"); }

function pick(readings, wantUs) {
  const accMatch = (r) => (wantUs ? isUsScope(r) : isBrScope(r));
  const score = (r) => {
    let s = 0;
    if (accMatch(r)) s = 0;
    else if (r.scopes.length === 0) s = 1;
    else if (r.scopes.includes("dialect")) s = 3;
    else s = 2; // br при выборе us и наоборот
    const hasSkip = r.tags.some((t) => TAG_SKIP.some((k) => t.toLowerCase().includes(k)));
    if (hasSkip) s += 4;
    if (r.tags.includes("weak form")) s += 2;
    if (r.tags.includes("strong form")) s -= 1;
    if (wantUs && r.tags.some((t) => t === "cot-caught")) s -= 0.5;
    if (wantUs && r.tags.some((t) => t === "non-cot-caught")) s += 0.5;
    return s;
  };
  const sorted = readings
    .map((r) => ({ r, s: score(r) }))
    .sort((a, b) => a.s - b.s);
  const good = sorted.filter((x) => x.s <= 1.5);
  return good.length ? good[0].r : sorted[0] ? sorted[0].r : null;
}

function chooseIpa(readings) {
  if (!readings.length) return null;
  const br = pick(readings, false);
  const us = pick(readings, true);
  if (!br) return us ? forDisplay(us.ipa) : null;
  if (us && us !== br && normForCompare(us.ipa) !== normForCompare(br.ipa)) {
    return `${forDisplay(br.ipa)}/${forDisplay(us.ipa)}`;
  }
  return forDisplay(br.ipa);
}

// ---------- основное ----------
async function main() {
  const verbsFile = path.join(__dirname, "_verbs.json");
  let verbs;
  if (fs.existsSync(verbsFile)) {
    verbs = JSON.parse(fs.readFileSync(verbsFile, "utf8")).verbs;
  } else {
    const groups = JSON.parse(fs.readFileSync(path.join(__dirname, "_groups.json"), "utf8"));
    verbs = [];
    for (const g of groups.groups) {
      for (const w of g.words) verbs.push({ v1: w.v1, rank: w.rank, v2: w.v2, v3: w.v3, group: g.id });
    }
    if (verbs.length !== 200) throw new Error(`seed != 200: ${verbs.length}`);
  }

  const tokens = new Set();
  for (const v of verbs) {
    tokens.add(v.v1);
    for (const t of [v.v2, v.v3]) for (const part of t.split("/")) tokens.add(part.trim());
  }
  console.log("уникальных токенов:", tokens.size);

  const pool = [...tokens];
  const cache = new Map();
  let done = 0;
  const workers = Array.from({ length: WORKERS_N }, async () => {
    while (pool.length) {
      const t = pool.pop();
      try { cache.set(t, await fetchRaw(t)); }
      catch (e) { console.error("FETCH FAIL", t, e.message); cache.set(t, null); }
      done++;
      if (done % 25 === 0) console.log(`загружено ${done}/${tokens.size}`);
      await new Promise((r) => setTimeout(r, PACE_MS));
    }
  });
  await Promise.all(workers);
  console.log("загрузка завершена");

  const byToken = new Map();
  for (const t of tokens) {
    const text = cache.get(t);
    if (!text) continue;
    if (text.startsWith("#REDIRECT")) {
      const m = /#REDIRECT\s*\[\[([^\]|#]+)/.exec(text);
      const target = m ? decodeURIComponent(m[1].replace(/_/g, " ")) : null;
      const targetText = target ? cache.get(target) : null;
      byToken.set(t, targetText ? collectReadings(targetText) : []);
      continue;
    }
    byToken.set(t, collectReadings(text));
  }

  const missing = [];
  let changed = 0;
  for (const v of verbs) {
    if (v.ipa && v.ipa.every(Boolean)) continue;
    const slots = [
      { k: "v1", toks: [v.v1] },
      { k: "v2", toks: v.v2.split("/").map((s) => s.trim()) },
      { k: "v3", toks: v.v3.split("/").map((s) => s.trim()) },
    ];
    const ipa = [];
    for (const slot of slots) {
      const key = `${v.v1}:${slot.k}`;
      if (OVERRIDES[key]) { ipa.push(OVERRIDES[key]); continue; }
      const parts = slot.toks.map((t) => chooseIpa(byToken.get(t) || []));
      if (parts.some((p) => !p)) { missing.push(`${key}: ${slot.toks.join("+")}`); ipa.push(null); continue; }
      ipa.push(parts.join("/"));
    }
    v.ipa = ipa;
    changed++;
  }
  console.log("заполнено записей:", changed, "| пропущено:", missing.length);
  if (missing.length) console.log("MISSING:\n" + missing.join("\n"));

  fs.writeFileSync(verbsFile, JSON.stringify({ source: "scripts/_groups.json + en.wiktionary IPA (T4)", verbs }, null, 1));
  console.log("saved:", verbsFile);
}

main().catch((e) => { console.error(e); process.exit(1); });
