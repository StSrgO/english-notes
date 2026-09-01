import phrases from '../../data/phrases.json';

// Компактная копия пула фраз для клиентской ротации «фразы дня».
// Формат: [en, ru, author?, source?] — author/source опускаются, когда их нет.
export function GET() {
  const compact = phrases.map((x) => {
    const item = [x.en, x.ru];
    if (x.author) item.push(x.author);
    if (x.source) item.push(x.source);
    return item;
  });
  return new Response(JSON.stringify(compact), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
