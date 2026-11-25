// Alte Adresse (klassenboard.netlify.app): Die KI läuft nur noch auf scolavis.de. Dort zählt der Server die Fragen
// pro Konto (cloudflare/worker.js → kiQuota, Grenzen in wrangler.jsonc). Hier gäbe es kein Kontingent – deshalb
// antwortet diese Funktion nur noch mit dem Hinweis „umgezogen“ und ruft keinen kostenpflichtigen Dienst mehr auf.
exports.handler = async () => ({
  statusCode: 410,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': 'https://klassenboard.netlify.app' },
  body: JSON.stringify({ error: 'moved', url: null }),
});
