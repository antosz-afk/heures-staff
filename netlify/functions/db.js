const https = require('https');

function request(hostname, path, method, key, payload) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : null;
    const req = https.request({
      hostname,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Prefer': 'return=minimal',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase non configuré' }) };

  const hostname = url.replace('https://', '');

  try {
    if (event.httpMethod === 'GET') {
      const r = await request(hostname, '/rest/v1/app_state?select=id,data&order=id.desc&limit=1', 'GET', key);
      const rows = JSON.parse(r.body);
      if (Array.isArray(rows) && rows.length > 0) {
        return { statusCode: 200, headers, body: rows[0].data };
      }
      return { statusCode: 200, headers, body: 'null' };
    }

    if (event.httpMethod === 'POST') {
      const { data } = JSON.parse(event.body);
      const existing = await request(hostname, '/rest/v1/app_state?select=id&limit=1', 'GET', key);
      const rows = JSON.parse(existing.body);
      if (Array.isArray(rows) && rows.length > 0) {
        const id = rows[0].id;
        await request(hostname, `/rest/v1/app_state?id=eq.${id}`, 'PATCH', key, { data });
      } else {
        await request(hostname, '/rest/v1/app_state', 'POST', key, { data });
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
