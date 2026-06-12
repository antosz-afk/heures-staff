const https = require('https');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Clé API non configurée' }) };
  }

  try {
    const { pdfBase64, staffNames } = JSON.parse(event.body);

    const payload = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: `Planning hebdomadaire. Membres connus: ${staffNames || 'inconnus'}.\nRetourne UNIQUEMENT un JSON valide (sans markdown ni backticks):\n{"weekStart":"YYYY-MM-DD","schedule":{"Prenom":{"0":"HH:MM-HH:MM","1":"Repos",...}}}\n0=lundi, 6=dimanche. Format horaires HH:MM-HH:MM. Mets "Repos" si absent ou vide.` }
        ]
      }]
    });

    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    const data = JSON.parse(result);
    if (data.error) return { statusCode: 400, body: JSON.stringify({ error: data.error.message }) };

    const text = data.content.map(i => i.text || '').join('').replace(/```json|```/g, '').trim();
    console.log('Réponse IA:', text);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: text
    };

  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
