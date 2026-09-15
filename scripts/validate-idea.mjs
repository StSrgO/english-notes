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
//   D11 — самостоятельность версий (тема T19): classic и rock — два независимых урока.
//         ошибки: абзац idea дословно совпадает с абзацем другой версии; текст урока
//         ссылается на другую версию;
//         предупреждения: абзац idea — пересказ абзаца другой версии (близость ≥ 0.6);
//         одна и та же цитата (context.lines) в обеих версиях.
//         Методический аппарат (formula, structure, rules, tips, uses, markers, why,
//         summary) по замыслу одинаков в обеих версиях — D11 его не проверяет.
//   D13 — латиница вне [bold] в idea (решение 13.09.2026): жирным выделяется всё английское —
//         слова, буквы, названия времён, имена, названия книг и групп. Исключение — IPA:
//         транскрипции вида /eɪ/, /zed/, /ɑːr/ остаются без выделения, а перечисления через
//         слеш (am/is/are, I/he/she/it) выделяются по обычному правилу.
//   D14 — состав формы описан дважды в idea этого урока («форма состоит из трёх частей» дважды):
//         второй абзац должен говорить о другом, а не повторять строение формы.
//         Повтор итогового тезиса в закрывающем абзаце («Итог: …») — приём урока, не дефект.
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

// D13: латиница в idea должна быть внутри [bold]. Токен начинается с латинской буквы
// (числа не выделяем), но может содержать цифры и дефис — иначе MC5 и Blink-182 рвутся.
// IPA (/eɪ/, /zed/) не выделяется, но перечисление через слеш (am/is/are) — выделяется:
// различаем по примыканию латинской буквы к слешу.
const LAT = String.raw`\p{Script=Latin}`;
const TOK = String.raw`-?'?${LAT}[${LAT}\p{Nd}'’-]*`;
const LAT_RUN = new RegExp(String.raw`${TOK}(?:\s+${TOK})*`, "gu");
const IPA_CAND = /\/[^/\n\r]{1,25}\//g;
const latLetter = /\p{Script=Latin}/u;
const trimTail = (s) => s.replace(/['’-]+$/, "");
const ipaSpans = (seg) =>
  [...seg.matchAll(IPA_CAND)]
    .filter((m) => {
      const before = seg[m.index - 1];
      const after = seg[m.index + m[0].length];
      return !(before && latLetter.test(before)) && !(after && latLetter.test(after));
    })
    .map((m) => [m.index, m.index + m[0].length]);
const latinOutsideBold = (p) =>
  p
    .split(/(\[bold\][^[\]]*\[\/bold\])/g)
    .flatMap((seg) => {
      if (seg.startsWith("[bold]")) return [];
      const ipa = ipaSpans(seg);
      return [...seg.matchAll(LAT_RUN)]
        .filter((m) => !ipa.some(([a, b]) => m.index >= a && m.index < b))
        .map((m) => trimTail(m[0]))
        .filter((t) => latLetter.test(t));
    });

// D14: состав формы описан дважды. Так выглядел случай c1-past-perfect-continuous: idea[0]
// «Форма собирается из трёх частей: had, been, глагол с -ing» и idea[3] «Форма состоит из трёх
// частей. Had…, been…, а глагол с -ing…». Ловим именно состав (части/элементы/компоненты):
// повтор итогового тезиса в закрывающем абзаце — приём урока, а не дефект, и его не считаем.
// ПЕРВАЯ РЕДАКЦИЯ ТРЕБОВАЛА СЛОВА «ЧАСТЬ» и потому пропустила рок-версию того же урока, где
// перечень стоял без него («Форма состоит из had, been и смыслового глагола с окончанием -ing»).
// Теперь ловим и перечень без «части», и обороты «часть формы / часть формулы».
const COMPOSITION = new RegExp(
  [
    String.raw`(?:форм[а-яё]*|конструкц[а-яё]*|оборот|врем[яеё]|правил[а-яё]*|модел[а-яё]*)[^.!?]{0,60}(?:состоит|собира[ею]тся|стро[ия]тся|складыва[ею]тся|образуется)[^.!?]{0,60}(?:из|част|элемент|компонент)`,
    String.raw`(?:состоит|собира[ею]тся|стро[ия]тся|складыва[ею]тся)[^.!?]{0,30}(?:из\s+[^.!?]{0,50}(?:част|элемент|компонент))`,
    String.raw`част[а-яё]*\s+формул`,
    String.raw`част[а-яё]*\s+форм`,
  ].join("|"),
  "i"
);

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
// Правило «одна фраза живёт в одном блоке» касается английских ПРИМЕРОВ, то есть
// предложений. Названия песен, книг и альбомов в уроке повторяются законно, поэтому
// D5 делит находки: «пример» (есть глагольная форма) и «название» (упоминание).
const VERBISH =
  /\b(is|are|was|were|be|been|being|am|has|have|had|do|does|did|will|would|shall|should|can|could|may|might|must|go|goes|went|gone|say|says|said|see|saw|seen|know|knew|known|make|makes|made|take|takes|took|taken|give|gives|gave|given|come|comes|came|get|gets|got|find|finds|found|think|thinks|thought|feel|feels|felt|look|looks|looked|play|plays|played|sing|sings|sang|sung|write|writes|wrote|written|read|reads|walk|walks|walked|talk|talks|talked|tell|tells|told|ask|asks|asked|live|lives|lived|work|works|worked|want|wants|wanted|need|needs|needed|like|likes|liked|love|loves|loved|hate|hates|hated|start|starts|started|stop|stops|stopped|keep|keeps|kept|leave|leaves|left|stand|stands|stood|sit|sits|sat|wait|waits|waited|belong|belongs|seem|seems|seemed|become|becomes|became|bring|brings|brought|buy|buys|bought|call|calls|called|lose|loses|lost|meet|meets|met|move|moves|moved|open|opens|opened|put|puts|run|runs|ran|show|shows|showed|turn|turns|turned|understand|understands|understood|hear|hears|heard|hold|holds|held|let|lets|put|sell|sells|sold|send|sends|sent|speak|speaks|spoke|spend|spends|spent|stick|sticks|stuck|teach|teaches|taught|wear|wears|wore|win|wins|won|believe|believes|believed|remember|remembers|remembered|forget|forgets|forgot|forgotten|expect|expects|expected|decide|decides|decided|agree|agrees|agreed|allow|allows|allowed|avoid|avoids|avoided|finish|finishes|finished|mind|minds|minded|suggest|suggests|suggested|consider|considers|considered|notice|notices|noticed|realise|realises|realised|realize|realizes|realized|mean|means|meant|enjoy|enjoys|enjoyed|explain|explains|explained|describe|describes|described|appear|appears|appeared|happen|happens|happened|arrive|arrives|arrived|examine|examines|examined|visit|visits|visited|help|helps|helped|carry|carries|carried|watch|watches|watched|listen|listens|listened|reach|reaches|reached|offer|offers|offered|pay|pays|paid|choose|chooses|chose|chosen|drive|drives|drove|driven|eat|eats|ate|eaten|sleep|sleeps|slept|wake|wakes|woke|woken|break|breaks|broke|broken|build|builds|built|catch|catches|caught|draw|draws|drew|drawn|fall|falls|fell|fallen|fight|fights|fought|grow|grows|grew|grown|learn|learns|learnt|learned|ride|rides|rode|ridden|rise|rises|rose|risen|seek|seeks|sought|shake|shakes|shook|shaken|shoot|shoots|shot|steal|steals|stole|stolen|swim|swims|swam|swum|throw|throws|threw|thrown|hope|hopes|hoped|pass|passes|passed|try|tries|tried|stay|stays|stayed|plan|plans|planned|promise|promises|promised|refuse|refuses|refused|join|joins|joined|thank|thanks|thanked|travel|travels|travelled|traveled|study|studies|studied|cost|costs|cut|cuts|hurt|hurts|lend|lends|lent|shut|shuts|borrow|borrows|borrowed|cook|cooks|cooked|clean|cleans|cleaned|order|orders|ordered|argue|argues|argued|complain|complains|complained|mention|mentions|mentioned|admit|admits|admitted|accept|accepts|accepted|provide|provides|provided|suppose|supposes|supposed|imagine|imagines|imagined|tend|tends|tended|claim|claims|claimed|refer|refers|referred)\b/;
// Ошибку в сторону «это пример» выбрать безопаснее: лишнее предупреждение человек отсмотрит,
// а настоящий дубль, помеченный «названием», пройдёт приёмку незамеченным. Поэтому кроме
// списка форм ловим английские глагольные окончания (-ed/-ing) в нижнем регистре.
// Прилагательные и существительные, оканчивающиеся на -ed/-ing, дают ложное срабатывание:
// их выкидываем перед проверкой окончаний, чтобы «evening», «string», «speckled», «tired»
// не превращали название в пример.
const NOT_VERB = /\b(?:evening|morning|something|nothing|anything|everything|thing|string|during|tired|interested|excited|worried|married|supposed|based|speckled|dressed|looking|wing|king|ring|spring|bring)\b/g;
// Названия («Through the Looking-Glass», «The Number of the Beast», «Ace of Spades»)
// распознаём по капитализации: все слова либо с заглавной, либо служебные.
const FUNC = new Set(["the", "a", "an", "of", "and", "or", "in", "on", "at", "to", "for", "with", "de", "la", "le"]);
const isTitle = (ph) => {
  const w = ph.split(" ").filter(Boolean);
  if (!w.length || !w.some((x) => /^[A-Z]/.test(x))) return false;
  return w.every((x) => /^[A-Z]/.test(x) || FUNC.has(x));
};
// Вид фразы. С 13.09.2026 в idea жирным выделена ВСЯ латиница, поэтому фраз из [bold] стало
// намного больше и бинарное «пример/название» перестало работать: под него попадали обрывки
// («is getting used to», «than it was before») и названия времён. Разделяем три вида:
//   пример   — английское предложение (с заглавной, ≥ 3 слов, есть глагольная форма) — D5 следит за ним;
//   название — имя, книга, альбом, группа, название времени (по капитализации) — повторяются законно, только счётчик;
//   фрагмент — обрывок, формула, буква, окончание — D5 не интересует вовсе.
const isSentence = (ph) =>
  /^[A-Z]/.test(ph.trim()) &&
  ph.split(" ").filter(Boolean).length >= 3 &&
  (VERBISH.test(ph) || /\b[a-z]{3,}(?:ed|ing)\b/.test(ph.replace(NOT_VERB, " ")));
const phraseKind = (ph) => (isTitle(ph) ? "название" : isSentence(ph) ? "пример" : "фрагмент");

// Фразу храним в двух видах: `raw` — как в тексте (нужен, чтобы отличить название
// по капитализации) и `key` — нормализованный (по нему ищем дубли и совпадения в блоках).
// В одном [bold] часто стоит несколько примеров-предложений («There is a laboratory on the
// street. There is a problem.»). Правило «одна фраза — одно место» работает по предложениям,
// поэтому выделение делим на предложения: иначе группа из трёх предложений не совпадёт ни с чем
// и повтор пройдёт незамеченным.
const boldPhrases = (s) =>
  [...s.matchAll(/\[bold\]([^[\]]+)\[\/bold\]/g)]
    .flatMap((m) =>
      m[1]
        .split(/(?<=[.!?])\s+/)
        .map((x) => x.trim())
        .filter(Boolean)
        .map((raw) => ({ raw, key: norm(raw) }))
    )
    .filter((p) => p.key.split(" ").length >= 3 && p.key.split(" ").some((w) => w.length > 1));

// D11: текст урока не должен ссылаться на другую версию. Общие слова («в другой версии»
// о трактовках события) не ловим — только прямые упоминания версий урока.
const VERSION_REF = [
  [/(?:рок|rock)-?верси/i, "ссылка на рок-версию урока внутри урока"],
  [/classic-?верси|классическ[а-яё]+\s+верси/i, "ссылка на классическую версию урока внутри урока"],
  [/(?:обеих|этой)\s+верси[а-яё]+/i, "ссылка на версии урока"],
];

// Близость абзацев другой версии считаем по значимым словам: без стоп-слов, длиной > 3.
// Без стоп-списка любые два абзаца об одном правиле дают высокую близость на «и/в/не/что».
const STOP_RU = new Set(
  "и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли если или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между это который которая которые своих".split(" ")
);
const NEAR_MIN = 80; // короче — правило/формула, совпадение законно
const NEAR_DIST = 0.6;

const normRu = (s) =>
  s
    .replace(/\[bold\]|\[\/bold\]/g, " ")
    .toLowerCase()
    .replace(/[^a-zа-яё0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const sigWords = (s) => new Set(normRu(s).split(" ").filter((w) => w.length > 3 && !STOP_RU.has(w)));
const jaccard = (a, b) => {
  const inter = [...a].filter((w) => b.has(w)).length;
  return inter / (a.size + b.size - inter || 1);
};

// Все текстовые листья урока с путями: нужен текст всего урока, а не только idea.
const rawLeaves = (v, p, out = []) => {
  if (typeof v === "string") out.push([p, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => rawLeaves(x, `${p}[${i}]`, out));
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) rawLeaves(x, p ? `${p}.${k}` : k, out);
  return out;
};

// Тексты блоков урока (кроме idea) по верхнеуровневым ключам: нужно, чтобы D5
// называл блок, в котором живёт повторённая фраза, а не просто «другой блок».
const blockTexts = (lesson) => {
  const out = new Map();
  const walk = (v, key, path) => {
    if (typeof v === "string") out.set(path, (out.get(path) || "") + " " + v);
    else if (Array.isArray(v)) v.forEach((x) => walk(x, key, path));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k, path);
  };
  for (const [k, v] of Object.entries(lesson)) {
    if (k === "idea") continue;
    walk(v, k, k);
  }
  const normed = new Map();
  for (const [p, t] of out) normed.set(p, norm(t));
  return normed;
};

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const phrasesByTopic = new Map(); // тема без .rocknroll -> набор фраз idea
const versionsByTopic = new Map(); // тема без .rocknroll -> [файл, абзацы idea, цитаты context]
let paragraphs = 0;
let chars = 0;
let dupInIdea = 0;
let dupOutside = 0;
let dupNames = 0;
let dupFormulations = 0;
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
  const seen = new Map(); // нормализованная фраза idea → первый абзац, где встретилась
  const rawOf = new Map(); // нормализованная фраза → её исходное написание
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
    // D13: вся латиница в idea внутри [bold]
    for (const t of latinOutsideBold(p))
      err("D13", file, where(i, `латиница вне [bold] — «${t}»`));
    // D5: повторы английских фраз из [bold] внутри idea и в других блоках
    for (const { raw, key } of boldPhrases(p)) {
      if (seen.has(key)) {
        const kind = phraseKind(raw);
        if (kind === "пример") dupInIdea++;
        else if (kind === "название") dupNames++;
        if (kind === "пример")
          warn(file, `D5-пример: фраза «${key}» повторяется в idea [${seen.get(key)}] и [${i}]`);
      } else {
        seen.set(key, i);
        rawOf.set(key, raw);
      }
    }
    for (const [re, name] of MARKERS)
      for (const m of p.matchAll(new RegExp(re.source, "gi"))) {
        markers++;
        markerHits.push(`${file} [${i}]: «${m[0].trim()}» — ${name}`);
      }
  });

  const blocks = blockTexts(lesson);
  for (const ph of seen.keys()) {
    const where = [...blocks].filter(([, t]) => t.includes(ph)).map(([p]) => p);
    if (where.length) {
      const kind = phraseKind(rawOf.get(ph) || ph);
      if (kind === "пример") dupOutside++;
      else if (kind === "название") dupNames++;
      if (kind === "пример") warn(file, `D5-пример: фраза «${ph}» есть и в блоках: ${where.join(", ")}`);
    }
  }

  // D14: состав формы описан дважды — см. описание COMPOSITION выше.
  const compositions = idea.map((p, i) => [i, p.match(COMPOSITION)]).filter(([, m]) => m);
  if (compositions.length >= 2) {
    dupFormulations++;
    warn(
      file,
      `D14: состав формы описан ${compositions.length} раза — ${compositions
        .map(([i, m]) => `idea[${i}] «${m[0].slice(0, 60)}»`)
        .join(", ")}; один из абзацев должен говорить о другом`
    );
  }

  if (idea.length >= 22) warn(file, `D6: ${idea.length} абзацев idea — вероятная «вода» (типично 12–18)`);

  const dense = markers / (text.length / 1000);
  if (dense > 3) warn(file, `маркеры ИИ-стиля: ${markers} на ${text.length} знаков = ${dense.toFixed(2)}/1000 (порог 3)`);

  const topic = file.replace(/\.rocknroll\.json$/, "").replace(/\.json$/, "");
  if (!phrasesByTopic.has(topic)) phrasesByTopic.set(topic, []);
  phrasesByTopic.get(topic).push([file, rawOf]);

  // D11: текст урока не должен ссылаться на другую версию (проверяем весь урок).
  for (const [p, s] of rawLeaves(lesson, ""))
    for (const [re, note] of VERSION_REF) {
      const m = s.match(re);
      if (m) err("D11", file, `${p}: «${m[0].trim()}» — ${note}`);
    }

  if (!versionsByTopic.has(topic)) versionsByTopic.set(topic, []);
  versionsByTopic.get(topic).push([file, idea, (lesson.context?.lines || []).map((l) => l.en)]);
}

// D5: classic и rock одной темы не должны повторять одни и те же английские фразы
let dupVersions = 0;
for (const [topic, versions] of phrasesByTopic)
  if (versions.length === 2) {
    const [a, b] = versions;
    for (const [ph, raw] of a[1])
      if (b[1].has(ph)) {
        const kind = phraseKind(raw);
        if (kind === "пример") dupVersions++;
        else if (kind === "название") dupNames++;
        if (kind === "пример")
          warn(b[0], `D5-пример: фраза «${ph}» повторяется в ${a[0]} (тема ${topic})`);
      }
  }

// D11: classic и rock одной темы — два самостоятельных урока. Абзац idea одной версии
// не повторяет и не пересказывает абзац другой; цитаты у версий свои.
let dupParagraphs = 0;
let nearParagraphs = 0;
let dupQuotes = 0;
for (const [topic, versions] of versionsByTopic) {
  if (versions.length !== 2) continue;
  const [a, b] = versions; // a — классика, b — рок (сортировка файлов)
  const sigB = b[1].map(sigWords);
  a[1].forEach((pa, i) => {
    if (pa.length < NEAR_MIN) return;
    b[1].forEach((pb, j) => {
      if (pb.length < NEAR_MIN) return;
      if (normRu(pb) === normRu(pa)) {
        dupParagraphs++;
        err("D11", b[0], `idea[${j}] дословно совпадает с ${a[0]} idea[${i}] — версии самостоятельны, абзац нужно переписать`);
        return;
      }
      const s = jaccard(sigWords(pa), sigB[j]);
      if (s >= NEAR_DIST) {
        nearParagraphs++;
        warn(b[0], `D11: idea[${j}] — пересказ ${a[0]} idea[${i}] (близость ${s.toFixed(2)}), тема ${topic}`);
      }
    });
  });
  for (const q of a[2])
    if (norm(q).length > 3 && b[2].some((r) => norm(r) === norm(q))) {
      dupQuotes++;
      warn(b[0], `D11: цитата «${q}» есть и в ${a[0]} — у версий свой материал`);
    }
}

const byCode = new Map();
for (const e of errors) {
  if (!byCode.has(e.code)) byCode.set(e.code, []);
  byCode.get(e.code).push(`${e.tag} — ${e.s}`);
}

console.log(
  `idea: ${files.length} файлов, ${paragraphs} абзацев, ${chars} знаков. ` +
  `Дубли фраз (D5): внутри idea ${dupInIdea}, в других блоках ${dupOutside}, между версиями ${dupVersions}; ` +
  `повторов названий (норма) ${dupNames}.`
);
console.log(
  `Самостоятельность версий (D11): совпавших абзацев ${dupParagraphs}, пересказов ${nearParagraphs}, общих цитат ${dupQuotes}. ` +
  `Повторов тезиса внутри idea (D14): ${dupFormulations}.`
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
    const kind = w.includes("D5-")
      ? "D5 (повторы фраз)"
      : w.includes("D14:")
        ? "D14 (повтор тезиса внутри idea)"
        : w.includes("D11:")
          ? "D11 (самостоятельность версий)"
          : w.includes("D6:")
            ? "D6 (объём idea)"
            : "маркеры ИИ-стиля";
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
console.log("\nvalidate-idea.mjs: OK — блок idea чист по D1–D4, D9, D10, D13, терминам.");
