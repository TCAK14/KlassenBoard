const PIXABAY_KEY = process.env.PIXABAY_API_KEY;

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
  if (!PIXABAY_KEY) {
    return { statusCode: 200, headers, body: JSON.stringify({ url: null, error: 'PIXABAY_API_KEY nicht konfiguriert' }) };
  }

  try {
    const { query } = JSON.parse(event.body);
    if (!query || typeof query !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ url: null }) };
    }

    const url = 'https://pixabay.com/api/?key=' + PIXABAY_KEY
      + '&q=' + encodeURIComponent(query)
      + '&image_type=photo&per_page=5&lang=de&safesearch=true';

    const res = await fetch(url);
    if (!res.ok) throw new Error('Pixabay ' + res.status);

    const data = await res.json();
    if (!data.hits || data.hits.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ url: null }) };
    }

    const pick = data.hits[Math.floor(Math.random() * Math.min(data.hits.length, 5))];
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: pick.webformatURL })
    };

  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ url: null, error: err.message }) };
  }
};
