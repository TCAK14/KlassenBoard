# KlassenBoard – Projektkontext für Claude Code

## Überblick
Classroom-Board-App für Lehrkräfte. Single-File HTML App deployed auf Netlify via GitHub Auto-Deploy.
- **Live:** https://klassenboard.netlify.app
- **Repo:** https://github.com/TCAK14/KlassenBoard

## Dateistruktur
```
index.html                          ← Haupt-App (gesamte Logik + UI)
landing.html                        ← Landing Page (Pricing, FAQ, Checkout)
impressum.html / datenschutz.html   ← Rechtsseiten (Impressum hat noch Platzhalter!)
netlify/functions/create-checkout.js ← Stripe Backend (Serverless Function)
netlify/functions/ai-chat.js        ← KI-Chat (Gemini 2.5 Flash + Web-Suche)
netlify/functions/ical.js           ← Stundenplan-Abruf (iCal/WebUntis), ersetzt fremden CORS-Proxy
supabase/functions/ai-generate/     ← KI-Tafel-Generator + Sprachbefehle (Groq) — separat via Supabase deployen
```

## Architektur (index.html)
- **Single-file HTML** — kein Build-Step, kein Framework
- **Wichtige globale Objekte:** `APP`, `AUTH`, `DRAW`, `CLASSES`, `REGISTRY`, `WIDGET_RENDERERS`
- **Widget-System:** `REGISTRY` (Metadaten) + `WIDGET_RENDERERS` (Render-Funktionen) + `renderWidgetContent(w, body)`
- **Startup-Sequenz:** `AUTH.init()` → `DRAW.init()` → `applyToolbarPrefs()` → `init()`
- **Toolbar:** `z-index:99999`, `pointer-events:all` — darf nie blockiert werden

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
python3 -c "
import re
with open('index.html') as f: c = f.read()
s = re.findall(r'<script>(.*?)</script>', c, re.DOTALL)
open('/tmp/_kb_syntax.js','w').write(s[0])
" && node --check /tmp/_kb_syntax.js && echo "✅ SYNTAX OK — Push erlaubt"
```
**Wenn der Check fehlschlägt → NICHT pushen, erst fixen.**

**Ohne Node.js auf dem Rechner** (Stand Nov 2026 nicht installiert): gleichwertiger Check im Browser-Preview
(`python -m http.server`, Config „classpuls" in `.claude/launch.json`) — derselbe V8-Parser, ohne Ausführung:
```js
const html = await (await fetch('/index.html?v=' + Date.now())).text();
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new Function(code);   // wirft SyntaxError, wenn der Code kaputt ist
```
Zusätzlich die Seite laden und die Konsole auf Fehler prüfen.

## Häufige Fallstricke
- **File-Truncation:** Bei großen Ersetzungen mit Python arbeiten (nicht Edit-Tool direkt), danach Syntax-Check
- **Backticks in Python-Strings:** Template-Literals `` `...` `` in Python-heredocs können falsch escaped werden → führt zu `SyntaxError`
- **Toolbar nicht klickbar:** Meistens ein JS-Fehler der den Startup-Code verhindert → Syntax prüfen
- **`el()` Funktion:** Existiert im App-Code — kann in Widget-Renderern verwendet werden
- **Widget-Config** persistent über `w.config` + `APP.save()`
- **Elemente in der Toolbar mit Dropdown:** Die Toolbar ist horizontal scrollbar (`overflow-x:auto`) und schneidet
  absolut positionierte Kinder ab → Menüs an `<body>` hängen (siehe `CLASSES.initUI`), nie in die Toolbar
- **Vollflächige Overlays** direkt an `<body>` brauchen `class="modal-overlay"` oder `data-kb-keep`, sonst entfernt sie der Toolbar-Guardian
- **Cloud-Sync:** nie direkt `upsert` aufrufen — `APP.save()` → `AUTH.syncToCloud()` gleicht erst mit der Cloud ab
  (`_reconcile`). Automatische Speicherungen beim Start laufen mit `APP._booting = true` und gelten nicht als Nutzer-Änderung
- **Pro-Status:** `isPro()` liest `app_metadata.plan` (nur serverseitig setzbar) — bis ein Stripe-Webhook existiert, manuell im Supabase-Dashboard setzen

## Offene Aufgaben
- [ ] Impressum: Platzhalter durch echte Angaben ersetzen (rechtlich nötig vor Live-Payments); AGB fehlen
- [ ] Kontakt-Adresse: `info@classpuls.de` auf der Landing Page existiert nicht
- [ ] Stripe auf Live-Mode umschalten + Webhook, der nach Zahlung `app_metadata.plan` setzt
- [ ] Preistabelle vs. tatsächliche Sperren abgleichen (Cloud-Sync, Datei-Widget, KI sind laut Landing Page Pro, technisch aber frei)
- [ ] Text-Tool: weitere Verbesserungen (Schriftauswahl, Größe)
