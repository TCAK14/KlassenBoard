const GEMINI_KEY = process.env.GEMINI_API_KEY;

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
  if (!GEMINI_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'GEMINI_API_KEY nicht konfiguriert' }) };
  }

  try {
    const { question, history } = JSON.parse(event.body);
    if (!question || typeof question !== 'string' || question.length > 2000) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ungueltige Anfrage' }) };
    }

    const systemInstruction = 'Du bist ein intelligenter KI-Assistent in KlassenBoard, einer App fuer Lehrkraefte an deutschen Schulen. Du kannst alles beantworten: Unterrichtsfragen, Allgemeinwissen, aktuelle Themen, Texte schreiben, Aufgaben erstellen, Ideen geben. Antworte immer auf Deutsch, klar und hilfreich. Sei konkret und gib echte Antworten statt auszuweichen. Nutze deine Web-Suche fuer aktuelle Fragen. Halte dich kurz (max 200 Woerter), ausser der Nutzer will mehr Detail.';

    const contents = [];

    if (Array.isArray(history)) {
      history.slice(-6).forEach(h => {
        if (h.role === 'user') {
          contents.push({ role: 'user', parts: [{ text: String(h.content).slice(0, 1000) }] });
        } else if (h.role === 'assistant') {
          contents.push({ role: 'model', parts: [{ text: String(h.content).slice(0, 1000) }] });
        }
      });
    }

    contents.push({ role: 'user', parts: [{ text: question }] });

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        tools: [{ googleSearch: {} }],
        generationConfig: {
          maxOutputTokens: 800,
          temperature: 0.7,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.error?.message || 'Gemini Fehler ' + res.status;
      throw new Error(msg);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '(Keine Antwort)';

    return { statusCode: 200, headers, body: JSON.stringify({ text }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
