const GEMINI_KEY = process.env.GEMINI_API_KEY;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://klassenboard.netlify.app',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

async function translateQuery(query) {
  if (!GEMINI_KEY) return query;
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Translate to precise English search keywords for Wikimedia Commons image search. Max 5 words. Reply ONLY with the keywords.\n\nExamples:\nbanane -> banana fruit\nschwarze hose -> black trousers pants\naudi a5 -> Audi A5 car\niphone 3g -> iPhone 3G\nstift -> pen pencil\n\nTranslate: ' + query }] }],
          generationConfig: { maxOutputTokens: 15, temperature: 0 }
        })
      }
    );
    if (!res.ok) return query;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || query;
  } catch (e) { return query; }
}

async function searchWikimedia(query) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query'
    + '&generator=search&gsrnamespace=6&gsrsearch=' + encodeURIComponent(query)
    + '&gsrlimit=15&prop=imageinfo&iiprop=url|size|extmetadata'
    + '&iiurlwidth=640&format=json';
  const res = await fetch(url, { headers: { 'User-Agent': 'KlassenBoard/1.0' } });
  if (!res.ok) return [];
  const data = await res.json();
  if (!data.query?.pages) return [];

  return Object.values(data.query.pages)
    .filter(p => p.imageinfo?.[0]?.thumburl)
    .map((p, i) => ({
      index: i,
      title: p.title.replace('File:', ''),
      url: p.imageinfo[0].thumburl,
      width: p.imageinfo[0].width || 0,
      height: p.imageinfo[0].height || 0,
      desc: p.imageinfo[0].extmetadata?.ImageDescription?.value?.replace(/<[^>]*>/g, '')?.slice(0, 100) || ''
    }))
    .filter(img => img.width >= 200 && img.height >= 150);
}

async function pickBestImage(query, images) {
  if (!GEMINI_KEY || images.length <= 1) return images[0] || null;

  const listing = images.map((img, i) =>
    (i + 1) + '. "' + img.title + '"' + (img.desc ? ' - ' + img.desc : '')
  ).join('\n');

  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'The user searched for: "' + query + '"\n\nWhich image BEST shows exactly this subject as a clear, single photo? Pick the number that shows ONLY this subject, not a group, not a scene, not a diagram.\n\nImages:\n' + listing + '\n\nReply with ONLY the number (e.g. 3). Nothing else.' }] }],
          generationConfig: { maxOutputTokens: 5, temperature: 0 }
        })
      }
    );
    if (!res.ok) return images[0];
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '1';
    const num = parseInt(text) - 1;
    return (num >= 0 && num < images.length) ? images[num] : images[0];
  } catch (e) { return images[0]; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const { query } = JSON.parse(event.body);
    if (!query || typeof query !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ url: null }) };
    }

    const englishQuery = await translateQuery(query);
    const images = await searchWikimedia(englishQuery);

    if (images.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ url: null }) };
    }

    const best = await pickBestImage(query, images);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: best ? best.url : null })
    };

  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ url: null, error: err.message }) };
  }
};
