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
netlify/functions/ai-chat.js        ← KI-Assistent (Gemini 2.5 Flash; Web-Suche nur bei Bedarf)
netlify/functions/image-search.js   ← Bildersuche des KI-Assistenten (Pixabay/Wikimedia, liefert data:-URL)
netlify/functions/ical.js           ← Stundenplan-Abruf (iCal/WebUntis), ersetzt fremden CORS-Proxy
fonts/                              ← Atkinson Hyperlegible Next (lokal gehostet, OFL) — nie von Google-Servern laden
supabase/functions/ai-generate/     ← KI-Tafel-Generator + Sprachbefehle (Groq) — separat via Supabase deployen
```

## Architektur (index.html)
- **Single-file HTML** — kein Build-Step, kein Framework
- **Wichtige globale Objekte:** `APP`, `AUTH`, `DRAW`, `CLASSES`, `REGISTRY`, `WIDGET_RENDERERS`
- **Widget-System:** `REGISTRY` (Metadaten) + `WIDGET_RENDERERS` (Render-Funktionen) + `renderWidgetContent(w, body)`
- **Startup-Sequenz:** `AUTH.init()` → `DRAW.init()` → `initChromeIcons()` → `renderDock()` → `applyChromePrefs()` → `init()`
- **Toolbar (oben):** `z-index:99999`, `pointer-events:all` — darf nie blockiert werden

## Oberfläche (seit Nov 2026, „Etappe 1")
- **Obere Leiste `#toolbar`:** nur Navigation (Klasse, Tafel-Reiter, Zeichnen, Bearbeiten, Vollbild, `⋯`, Anmelden)
- **Untere Leiste `#dock`:** Elemente mit einem Klick hinzufügen — `renderDock()`, Auswahl in `kb_dock_items`
  (`openDockCustomizer()`); „Mehr" (`#btn-add-widget`) öffnet `openWidgetMenu()`
- **Menü `⋯`:** `openMoreMenu()` — Vorlagen, Hintergrund, Stundenplan, Sprache, Export, Karten hell/dunkel (`kb_cards`),
  Leisten ausblenden (`kb_autohide`), Zurücksetzen. Auf schmalen Bildschirmen wandern versteckte Leisten-Knöpfe hierher
- **Symbole:** `ICONS` + `icon(name, size)` (Inline-SVG, Schlüssel = Widget-Typ). Keine Emojis für Bedienelemente
- **Karten-Farben:** Widgets sind standardmäßig HELL. In Renderern nie Weiß/Schwarz fest verdrahten, sondern
  `var(--w-ink)`, `--w-muted`, `--w-faint`, `--w-line`, `--w-fill`, `--w-fill-2`, `--w-danger` … (definiert an `.widget`)
- **Schriftgrößen in Widgets:** `cqw`/`cqh` (`.widget-body` ist Container) bzw. `fitFontSize()`; Listen setzen `--n` (Zeilenzahl)
- **Tafelfarbe:** `DEFAULT_BG` (#1F3531). Der alte Indigo-Verlauf (`LEGACY_DEFAULT_BG`) wird beim Anzeigen wie „Standard" behandelt
- **Einrasten:** `snapLines/snapAxis/showSnapGuide` in `initDrag`/`initResize` (8-px-Raster, Kanten anderer Widgets, Alt = frei)
- **Textgrößen messen:** `textWidthEm()` / `countWrappedLines()` / `fitFontSize()` (Canvas-Messung mit der geladenen Schrift)
- **Vorlagen + Demo:** `BUILT_IN_TEMPLATES` sind für die Fläche `LAYOUT_BASE` (1076×532) entworfen; `fitLayout()` rechnet
  beim Anwenden auf den Bildschirm um (Handy: untereinander). Neue Vorlagen immer in diesem Raster anlegen
- **Start-Dialog:** `openStartDialog('new' | 'replace')` — Vorlagen-Galerie mit automatischen Vorschaubildern + KI-Feld;
  „+" in der oberen Leiste öffnet ihn. `applyTemplate(tpl, mode)`
- **Timer:** Ring + direkte Bedienung (−/+, Voreinstellungen); Layout `wide`/`tall`/`compact` je nach Größe.
  Laufzeit-Zustand weiter auf dem Widget-Objekt (`_timerRunning/_timerEndAt/_timerRemaining`)
- **Ampel = „Arbeitsform":** Liste mit Wort + Symbol (ab ca. 230×170), sonst drei Lichter; `config.state` bleibt red/yellow/green
- **Leere Elemente:** `emptyCta(icon, text, onClick)` statt Hinweistext „⚙ Einstellungen" — funktioniert auch in der Ansicht
- **Demo:** bewusst nur 2 Tafeln (Gratis-Limit 3), damit „+" beim ersten Besuch nicht sofort die Bezahl-Meldung zeigt

## PDF-Element (`pdf`)
- Dateien liegen in IndexedDB (`PDFSTORE`, DB `classpuls_files`, bis 60 MB) — NICHT in localStorage/Cloud. Auf einem
  anderen Gerät zeigt das Element „liegt nicht auf diesem Gerät" und lässt die Datei neu wählen
- Anzeige über PDF.js 3.11.174 von cdnjs, erst bei Bedarf geladen (`loadPdfJs()`); Großansicht `openPdfFullscreen()`
- Das ältere Element „Dateien" kann PDFs nur bis 2 MB per iframe — für PDFs immer das PDF-Element nehmen

## KI-Assistent (Fenster `#ki-panel`, Knopf „KI" in der unteren Leiste)
- Antworten kommen als Markdown und werden mit `renderMarkdown()` sicher als DOM aufgebaut (nie `innerHTML`)
- Aktionen an der Antwort: „Auf die Tafel" (`addWidget('text', …, size)`), „Ohne Lösungen" (der Prompt verlangt
  eine eigene Zeile „Lösungen:"), „Kopieren", „Im Web prüfen" (`web:true`)
- **Web-Suche (Google Grounding):** nur wenn `needsWeb()` in `ai-chat.js` anschlägt oder `web:true`. Antworten aus der
  Web-Suche MÜSSEN mit Quellen und Googles Suchvorschlägen (`searchHtml`, im sandboxed iframe) angezeigt werden und
  bekommen deshalb kein „Auf die Tafel" — Vorgabe aus Googles Gemini-API-Bedingungen, nicht entfernen
- **Bilder:** „Zeige/Male …" → `image-search` (Pixabay mit safesearch, Jugendschutz-Prüfung über Gemini). Der Server
  lädt das Bild und liefert eine data:-URL, damit kein Schul-Browser Drittanbieter aufruft und das Bild dauerhaft bleibt
- **Server-Schutz:** beide Funktionen verlangen `Origin: https://klassenboard.netlify.app` (auch fehlender Origin → 403)
  und haben eine einfache Bremse pro IP (nur pro Instanz!). Lokal (python http.server) laufen die Funktionen nicht —
  zum Testen `fetch` nachstellen oder auf der Live-Seite testen. Fehler gehen als Kürzel (`busy`, `rate`, `timeout`)
  an den Browser, Details nur ins Netlify-Protokoll

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
- **Bash-Heredocs:** `\\n` in Python-Patches wird zu einem echten Zeilenumbruch → zerbricht JS-Strings. Patch-Skripte
  mit JS-Escapes als Datei schreiben (Write-Tool), nicht per Heredoc
- **Browser-Preview drosselt Animationen:** Screenshots direkt nach einer Aktion zeigen oft den Zwischenzustand
  (Menü/Dialog noch unsichtbar) → 2–3 s warten oder per JS messen
- **Cloud-Sync:** nie direkt `upsert` aufrufen — `APP.save()` → `AUTH.syncToCloud()` gleicht erst mit der Cloud ab
  (`_reconcile`). Automatische Speicherungen beim Start laufen mit `APP._booting = true` und gelten nicht als Nutzer-Änderung
- **Pro-Status:** `isPro()` liest `app_metadata.plan` (nur serverseitig setzbar) — bis ein Stripe-Webhook existiert, manuell im Supabase-Dashboard setzen

## Offene Aufgaben
- [ ] Impressum: Platzhalter durch echte Angaben ersetzen (rechtlich nötig vor Live-Payments); AGB fehlen
- [ ] Kontakt-Adresse: `info@classpuls.de` auf der Landing Page existiert nicht
- [ ] Stripe auf Live-Mode umschalten + Webhook, der nach Zahlung `app_metadata.plan` setzt
- [ ] Preistabelle vs. tatsächliche Sperren abgleichen (Cloud-Sync, Datei-Widget, KI sind laut Landing Page Pro, technisch aber frei)
- [ ] Text-Tool: weitere Verbesserungen (Schriftauswahl, Größe)
- [ ] Redesign Etappe 2 (Rest): direkte Bedienung für weitere Elemente (Zufallszahl-Bereich, Namen/Checkliste direkt
      im Element bearbeiten, QR-Link eintippen); KI-Tafel-Generator nutzt noch ein einfaches Fließ-Layout
- [ ] Redesign Etappe 3: fehlende Elemente (Arbeitssymbole, Punktetafel, visueller Timer, Countdown, Kalender, Webcam)
- [ ] Rest aus Etappe 1: Zeichen-Leiste und Dialog-Überschriften nutzen noch Emojis; Dialoge sind noch dunkel;
      Landing Page hat noch das alte Indigo-Branding und die Systemschrift
