# KlassenBoard – Projektkontext für Claude Code

## Überblick
Classroom-Board-App für Lehrkräfte. Statische HTML/JS-App (modular, kein Build-Step) deployed auf Netlify via GitHub Auto-Deploy.
- **Live:** https://klassenboard.netlify.app
- **Repo:** https://github.com/TCAK14/KlassenBoard

## Dateistruktur
```
index.html                          ← HTML-Gerüst (Markup + Script-Tags, ~175 Zeilen)
css/styles.css                      ← Gesamtes App-CSS
js/01-config.js                     ← Supabase-Konfiguration (URL + anon key)
js/02-auth.js                       ← AUTH-Modul (Login, Cloud-Sync)
js/03-registry.js                   ← REGISTRY, WIDGET_CATS, Freemium-Limits, Upgrade-Modal
js/04-templates.js                  ← BUILT_IN_TEMPLATES
js/05-state.js                      ← APP (zentraler State, save/load, Undo)
js/06-utils.js                      ← uid, toast, el, openModal, Board-CRUD, Widget-CRUD, Intervalle
js/07-render.js                     ← renderAll, Board-Tabs, Widgets bauen, Drag/Resize
js/08-widgets.js                    ← WIDGET_RENDERERS (alle 26 Widget-Render-Funktionen)
js/09-timetable.js                  ← Stundenplan + iCal-Parser
js/10-widget-settings.js            ← Alle openXxxSettings/openXxxEdit-Dialoge
js/11-modals.js                     ← Widget-Menü, Templates, Hintergrund, Export, Fullscreen, Edit-Mode
js/12-auth-ui.js                    ← Login-Modal UI
js/13-voice.js                      ← VOICE (Sprachsteuerung)
js/14-ai-generator.js               ← KI-Board-Generator + globale Toolbar-Event-Bindings
js/15-init.js                       ← migrateLocalStorage, init, setupDemo
js/16-voting.js                     ← Live-Umfrage Voting-Page (?poll=…)
js/17-classes.js                    ← CLASSES (Klassenverwaltung)
js/18-draw.js                       ← DRAW (Zeichentool) + Floating-KI-Chat
js/19-toolbar.js                    ← TOOLBAR_ITEMS, Toolbar-Prefs, Customizer, Watchdog
js/20-startup.js                    ← Startup-Sequenz (läuft als letztes)
landing.html                        ← Landing Page (Pricing, FAQ, Checkout)
impressum.html / datenschutz.html   ← Rechtliches
netlify/functions/create-checkout.js ← Stripe Backend (Serverless Function)
netlify/functions/ai-chat.js        ← KI-Chat Backend (Groq)
netlify/functions/image-search.js   ← Bildersuche Backend
```

## Architektur
- **Klassische Scripts, KEINE ES-Module:** Die `js/`-Dateien werden in `index.html` in
  nummerierter Reihenfolge als normale `<script src>` geladen und teilen den globalen Scope
  (wie früher ein einziger `<script>`-Block). Kein `import`/`export` verwenden!
- **Ladereihenfolge ist wichtig:** Die Nummerierung `01–20` = Ladereihenfolge. Code, der beim
  Laden sofort ausgeführt wird (IIFEs, Event-Bindings), darf nur auf frühere Dateien zugreifen.
  Funktionsaufrufe in Callbacks (Klick-Handler etc.) dürfen auf alles zugreifen.
- **Wichtige globale Objekte:** `APP`, `AUTH`, `DRAW`, `CLASSES`, `REGISTRY`, `WIDGET_RENDERERS`
- **Widget-System:** `REGISTRY` (Metadaten) + `WIDGET_RENDERERS` (Render-Funktionen) + `renderWidgetContent(w, body)`
- **Startup-Sequenz** (in `js/20-startup.js`): `AUTH.init()` → `DRAW.init()` → `applyToolbarPrefs()` → `init()`
- **Toolbar:** `z-index:99999`, `pointer-events:all` — darf nie blockiert werden
- **Neues Widget hinzufügen:** Eintrag in `js/03-registry.js` (REGISTRY) + Renderer in
  `js/08-widgets.js` + ggf. Settings-Dialog in `js/10-widget-settings.js`

## Stripe / Payments
- **Publishable Key** (im Code erlaubt): `pk_test_51TibNc9fJyerANl5...`
- **Secret Key:** NUR als Netlify Env-Variable `STRIPE_SECRET_KEY` — NIEMALS in Dateien schreiben
- Checkout-Funktion: `netlify/functions/create-checkout.js`
- Pläne: pro-monthly (250ct/Mo), pro-yearly (2200ct/Jahr), school (dynamisch)

## Supabase
- Auth + Cloud-Sync für Boards
- `AUTH.user`, `AUTH.client` für DB-Zugriff

## Vor jedem Push — PFLICHT: JS-Syntax prüfen
```bash
npm run check
```
Prüft alle `js/*.js` und `netlify/functions/*.js` mit `node --check`.
**Wenn der Check fehlschlägt → NICHT pushen, erst fixen.**

## Häufige Fallstricke
- **Kein `import`/`export`:** Die js/-Dateien sind klassische Scripts mit globalem Scope.
  ES-Module-Syntax führt zu `SyntaxError` bzw. bricht die App.
- **`'use strict';`** steht am Anfang jeder js/-Datei — beim Anlegen neuer Dateien beibehalten.
- **Ladereihenfolge:** Neue Dateien in `index.html` an der richtigen Stelle einbinden
  (vor `js/20-startup.js`); Nummerierung fortführen.
- **Toolbar nicht klickbar:** Meistens ein JS-Fehler der den Startup-Code verhindert → `npm run check`
- **`el()` Funktion:** In `js/06-utils.js` — kann in Widget-Renderern verwendet werden
- **Widget-Config** persistent über `w.config` + `APP.save()`
- **Backticks in Python-Strings:** Template-Literals `` `...` `` in Python-heredocs können falsch
  escaped werden → führt zu `SyntaxError` (nur relevant bei Skript-generierten Massen-Edits)

## Offene Aufgaben
- [ ] Impressum + Datenschutz Seiten (rechtlich nötig vor Live-Payments)
- [ ] Stripe auf Live-Mode umschalten
- [ ] Freemium-Limits enforzen (1 Klasse / 3 Boards für Free-User via Supabase)
- [ ] Text-Tool: weitere Verbesserungen (Schriftauswahl, Größe)
- [ ] Optional: Vite + TypeScript einführen (js/-Dateien zu ES-Modulen konvertieren)
