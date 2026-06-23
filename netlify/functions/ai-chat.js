const GROQ_KEY = process.env.GROQ_API_KEY;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://klassenboard.netlify.app',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

async function callGroq(messages, model, maxTokens) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Groq ' + res.status);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '(Keine Antwort)';
}

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
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ungueltige Anfrage' }) };
    }

    const messages = [
      {
        role: 'system',
        content: 'Du bist ein intelligenter KI-Assistent in KlassenBoard, einer App fuer Lehrkraefte an deutschen Schulen. Du kannst alles beantworten: Unterrichtsfragen, Allgemeinwissen, aktuelle Themen, Texte schreiben, Aufgaben erstellen, Ideen geben. Antworte immer auf Deutsch, klar und hilfreich. Sei konkret und gib echte Antworten statt auszuweichen. Halte dich kurz (max 200 Woerter), ausser der Nutzer will mehr Detail.'
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

    // Try Compound (has web search) first, fall back to GPT-OSS 120B
    let text;
    try {
      text = await callGroq(messages, 'groq/compound', 500);
    } catch (e) {
      text = await callGroq(messages, 'openai/gpt-oss-120b', 800);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ text }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
