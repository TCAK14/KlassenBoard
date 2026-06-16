// Supabase Edge Function: ai-generate
// Handles: content generation, Q&A, auto-board generation, voice commands

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const GROQ_KEY = Deno.env.get('GROQ_API_KEY');
    if (!GROQ_KEY) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY nicht konfiguriert' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { type } = body;
    let systemPrompt = '', userPrompt = '', maxTokens = 600, temperature = 0.7;

    // ── 1. Free Q&A ──
    if (type === 'ask') {
      systemPrompt = `Du bist ein hilfreicher Assistent für Lehrerinnen und Lehrer an deutschen Schulen.
Beantworte Fragen präzise und auf den Punkt (max. 150 Wörter). Antworte immer auf Deutsch.`;
      userPrompt = body.question;
      maxTokens = 400;

    // ── 2. Auto-Board Generator ──
    } else if (type === 'board-generate') {
      const { topic, grade, duration, lessonType } = body;
      maxTokens = 1000;
      temperature = 0.3;

      systemPrompt = `Du bist ein Experte für Unterrichtsplanung an deutschen Schulen.
Erstelle einen optimalen Board-Plan als reines JSON — kein Text davor oder danach, nur JSON.

Verfügbare Widgets (nur diese):
- "clock": Uhr — config: {}
- "timer": Countdown — config: { "seconds": <zahl> }
- "goal": Stundenziel — config: { "text": "<prägnantes Ziel, max 80 Zeichen>" }
- "text": Hinweis/Info — config: { "content": "<text, max 120 Zeichen>" }
- "phases": Unterrichtsphasen — config: { "items": [{"label":"<name>","minutes":<min>}] }
- "checklist": Aufgabenliste — config: { "items": [{"text":"<aufgabe>","done":false}] }
- "homework": Hausaufgaben — config: { "text": "<aufgabe>" }
- "names": Schüler-Zufallsaufruf — config: {}
- "noise": Lautstärkemesser — config: {}
- "timer": Timer für Gruppenarbeit/Pausen
- "agenda": Stundenablauf — config: { "items": [{"time":"<uhrzeit>","text":"<punkt>"}] }

Antworte NUR mit diesem JSON (exakt):
{
  "boardName": "<thema> – Klasse <klasse>",
  "imagePrompt": "<Detaillierter englischer Prompt für KI-Bildgenerator, 10-20 Wörter. Beschreibe das Thema visuell, historische Szene, Personen, Landschaft, Stil. Beispiele: 'french revolution 1789 storming bastille napoleon dramatic oil painting cinematic epic lighting' oder 'photosynthesis plant cell biology microscope nature vibrant colors scientific illustration' oder 'roman empire colosseum gladiators ancient rome dramatic sunset historical'>",
  "widgets": [
    { "type": "<typ>", "config": { ... } }
  ]
}

Pflichtwidgets: clock, goal, phases
Gesamtdauer der Phasen = ${body.duration} Minuten
Wähle insgesamt 5-7 passende Widgets.
Alle Texte in Deutsch, inhaltlich auf das Thema angepasst.`;

      userPrompt = `Thema: ${topic}\nKlasse: ${grade}\nDauer: ${duration} Minuten\nArt: ${lessonType}`;

    // ── 3. Sprachsteuerung ──
    } else if (type === 'voice-command') {
      maxTokens = 250;
      temperature = 0.1;

      systemPrompt = `Du interpretierst Sprachbefehle für KlassenBoard (ein digitales Klassenzimmer-Tool).
Antworte NUR mit JSON — kein Text.

Widget-Typen: clock, timer, stopwatch, text, traffic, qr, names, homework, goal, timetable, image, youtube, dice, randomnum, groups, agenda, checklist, phases, status, noise, poll, ai, ask

Aktionen:
- "add-widget": Widget hinzufügen
- "configure-widget": Bestehendes Widget aktualisieren
- "add-and-configure": Hinzufügen + konfigurieren
- "new-board": Neue Tafel erstellen
- "ai-board": KI-Board-Generator öffnen

JSON-Format: { "action": "...", "widgetType": "...", "config": {}, "name": "..." }

Beispiele:
"Öffne Stoppuhr" → { "action": "add-widget", "widgetType": "stopwatch", "config": {} }
"Öffne YouTube" → { "action": "add-widget", "widgetType": "youtube", "config": {} }
"Timer 5 Minuten" → { "action": "add-widget", "widgetType": "timer", "config": { "seconds": 300 } }
"Timer 10 Minuten" → { "action": "add-widget", "widgetType": "timer", "config": { "seconds": 600 } }
"Öffne Gruppenarbeit mit den Namen Lena, Lisa, Charlotte" → { "action": "add-and-configure", "widgetType": "groups", "config": { "names": "Lena\nLisa\nCharlotte", "size": 2 } }
"Füge Namen ein: Max, Anna, Tom" → { "action": "configure-widget", "widgetType": "names", "config": { "names": "Max\nAnna\nTom" } }
"Neue Tafel" → { "action": "new-board", "name": "Neue Tafel" }
"Erstelle KI-Board" → { "action": "ai-board" }
"Würfel hinzufügen" → { "action": "add-widget", "widgetType": "dice", "config": {} }
"Lautstärkemesser öffnen" → { "action": "add-widget", "widgetType": "noise", "config": {} }
"Zufällige Nummer" → { "action": "add-widget", "widgetType": "randomnum", "config": {} }`;

      userPrompt = body.transcript;

    // ── 4. Strukturierte Unterrichtsinhalte ──
    } else {
      const { topic, grade } = body;
      systemPrompt = 'Du bist ein erfahrener Lehrassistent für deutsche Schulen. Antworte immer auf Deutsch.';
      const prompts: Record<string, string> = {
        quiz:    `Erstelle 5 Multiple-Choice-Fragen zum Thema "${topic}" für Klasse ${grade}. Optionen A-D, markiere die Antwort.`,
        goal:    `3 Lernziele zum Thema "${topic}" für Klasse ${grade}. Beginne mit "Die SuS können…"`,
        tasks:   `4 differenzierte Aufgaben zu "${topic}" für Klasse ${grade}. Stufe nach Schwierigkeit ab (★☆☆ bis ★★★).`,
        summary: `Fasse "${topic}" für Klasse ${grade} zusammen (max. 150 Wörter).`,
        explain: `Erkläre "${topic}" für Klasse ${grade} mit einem Alltagsbeispiel.`,
      };
      userPrompt = prompts[type] ?? `Erkläre "${topic}" für Klasse ${grade}.`;
    }

    const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!groqResp.ok) {
      const err = await groqResp.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `Groq HTTP ${groqResp.status}`);
    }

    const data = await groqResp.json();
    const text = data.choices?.[0]?.message?.content ?? '(Keine Antwort)';
    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
