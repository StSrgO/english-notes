import recs from '../../data/recommendations.json';

// Компактная копия каталога рекомендаций для клиентской ротации «подборки дня».
// Формат: [type, level, title, meta, href] — typeLabel выводится на клиенте из type.
export function GET() {
  const compact = recs.map((x) => [x.type, x.level, x.title, x.meta, x.href]);
  return new Response(JSON.stringify(compact), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
