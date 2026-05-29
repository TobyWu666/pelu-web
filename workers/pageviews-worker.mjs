const ALLOWED_ORIGIN = 'https://pelu.wutoby.com';
const ALLOWED_PATHS = new Set([
  '/',
  '/index.html',
  '/about.html',
  '/privacy.html',
  '/support.html',
  '/tutorial.html'
]);

const json = (body, init = {}) => new Response(JSON.stringify(body), {
  ...init,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...corsHeaders(init.origin),
    ...init.headers
  }
});

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  'Vary': 'Origin'
});

const today = () => new Date().toISOString().slice(0, 10);

function normalizePath(value) {
  if (typeof value !== 'string') return '/';
  let path = value.trim();
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  return ALLOWED_PATHS.has(path) ? path : null;
}

async function readPayload(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json') || contentType.includes('text/plain')) {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }
  return {};
}

async function recordView(request, env) {
  const origin = request.headers.get('origin');
  if (origin && origin !== ALLOWED_ORIGIN) {
    return json({ ok: false, error: 'origin_not_allowed' }, { status: 403, origin });
  }

  const payload = await readPayload(request);
  const path = normalizePath(payload.path);
  if (!path) return json({ ok: false, error: 'path_not_allowed' }, { status: 400, origin });

  await env.DB.prepare(`
    INSERT INTO pageviews (day, path, views)
    VALUES (?1, ?2, 1)
    ON CONFLICT(day, path) DO UPDATE SET views = views + 1
  `).bind(today(), path).run();

  return json({ ok: true }, { origin });
}

async function readStats(request, env) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const days = Math.min(366, Math.max(1, Number(url.searchParams.get('days') || 30)));
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);

  const daily = await env.DB.prepare(`
    SELECT day AS date, SUM(views) AS totalViews
    FROM pageviews
    WHERE day >= ?1
    GROUP BY day
    ORDER BY day ASC
  `).bind(since).all();

  const paths = await env.DB.prepare(`
    SELECT path, SUM(views) AS totalViews
    FROM pageviews
    WHERE day >= ?1
    GROUP BY path
    ORDER BY totalViews DESC, path ASC
  `).bind(since).all();

  const dailyRows = daily.results || [];
  const pathRows = paths.results || [];

  return json({
    ok: true,
    provider: 'pelu-worker',
    rangeDays: days,
    totalViews: dailyRows.reduce((sum, row) => sum + Number(row.totalViews || 0), 0),
    uniqueVisitors: null,
    daily: dailyRows.map((row) => ({
      date: row.date,
      totalViews: Number(row.totalViews || 0)
    })),
    paths: pathRows.map((row) => ({
      path: row.path,
      totalViews: Number(row.totalViews || 0)
    })),
    generatedAt: new Date().toISOString()
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
    }
    if (request.method === 'POST' && url.pathname === '/api/pageview') {
      return recordView(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/api/pageview/stats') {
      return readStats(request, env);
    }
    return json({ ok: false, error: 'not_found' }, { status: 404 });
  }
};
