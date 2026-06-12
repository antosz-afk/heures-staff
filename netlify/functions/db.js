const https = require('https');

function supabaseRequest(path, method, body) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error('Supabase non configuré');

  const hostname = url.replace('https://', '');
  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname,
      path: `/rest/v1/${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Prefer': method === 'POST' ? 'return=representation' : 'return=representation',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
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

  try {
    if (event.httpMethod === 'GET') {
      const rows = await supabaseRequest('app_state?select=data&order=id.desc&limit=1', 'GET');
      if (Array.isArray(rows) && rows.length > 0) {
        return { statusCode: 200, headers, body: rows[0].data };
      }
      return { statusCode: 200, headers, body: 'null' };
    }

    if (event.httpMethod === 'POST') {
      const { data } = JSON.parse(event.body);
      // Upsert: delete all then insert
      await supabaseRequest('app_state?id=gt.0', 'DELETE', null);
      await supabaseRequest('app_state', 'POST', { data });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
