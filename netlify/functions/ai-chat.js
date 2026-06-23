const GROQ_KEY = process.env.GROQ_API_KEY;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://klassenboard.netlify.app',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }
  if (!GROQ_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'GROQ_API_KEY nicht konfiguriert' }) };
  }

  try {
    const { question, history } = JSON.parse(event.body);
    if (!question || typeof question !== 'string' || question.length > 2000) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ungültige Anfrage' }) };
    }

    const messages = [
      {
        role: 'system',
        content: 'Du bist ein intelligenter KI-Assistent in KlassenBoard, einer App für Lehrkräfte an deutschen Schulen. Du kannst alles beantworten — Unterrichtsfragen, Allgemeinwissen, aktuelle Themen, Texte schreiben, Aufgaben erstellen, Ideen geben. Antworte immer auf Deutsch, klar und hilfreich. Sei konkret und gib echte Antworten statt auszuweichen. Halte dich kurz (max 200 Wörter), außer der Nutzer will mehr Detail.'
      }
    ];

    if (Array.isArray(history)) {
      history.slice(-6).forEach(h => {
        if (h.role === 'user' || h.role === 'assistant') {
          messages.push({ role: h.role, content: String(h.content).slice(0, 1000) });
        }
      });
    }

    messages.push({ role: 'user', content: question });

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'groq/compound',
        messages,
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Groq Fehler ' + res.status);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '(Keine Antwort)';
    return { statusCode: 200, headers, body: JSON.stringify({ text }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
