export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      if (request.method === 'POST' && url.pathname === '/candles') {
        return await handlePost(request, env);
      }

      if (request.method === 'GET' && url.pathname === '/candles') {
        return await handleGet(url, env);
      }

      if (request.method === 'GET' && url.pathname === '/') {
        return jsonResponse({ status: 'ok', service: 'forex-robot-backend' });
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }
};

async function handlePost(request, env) {
  const body = await request.json();
  const { pair, timeframe, candles } = body || {};

  if (!pair || !timeframe || !Array.isArray(candles)) {
    return jsonResponse({ error: 'Missing pair, timeframe, or candles' }, 400);
  }

  if (candles.length === 0) {
    return jsonResponse({ inserted: 0, skipped: 0 });
  }

  const stmt = env.DB.prepare(
    `INSERT OR IGNORE INTO candles (pair, timeframe, time, open, high, low, close, volume)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const batch = candles.map(c => stmt.bind(
    pair,
    timeframe,
    c.time,
    c.open,
    c.high,
    c.low,
    c.close,
    c.volume || 0
  ));

  const results = await env.DB.batch(batch);
  const inserted = results.reduce((sum, r) => sum + (r.meta?.changes || 0), 0);

  return jsonResponse({
    inserted,
    skipped: candles.length - inserted,
    total: candles.length
  });
}

async function handleGet(url, env) {
  const pair = url.searchParams.get('pair');
  const timeframe = url.searchParams.get('timeframe');
  const since = parseInt(url.searchParams.get('since') || '0', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '2000', 10), 5000);

  if (!pair || !timeframe) {
    return jsonResponse({ error: 'Missing pair or timeframe' }, 400);
  }

  const stmt = env.DB.prepare(
    `SELECT time, open, high, low, close, volume
     FROM candles
     WHERE pair = ? AND timeframe = ? AND time > ?
     ORDER BY time ASC
     LIMIT ?`
  ).bind(pair, timeframe, since, limit);

  const { results } = await stmt.all();

  return jsonResponse({
    pair,
    timeframe,
    count: results?.length || 0,
    candles: results || []
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
