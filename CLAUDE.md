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
vendor/                             ← QRCode.js + supabase-js (Version im Dateinamen) — keine fremden Server beim Start
manifest.webmanifest, sw.js, icons/ ← installierbare App (PWA). sw.js „lokal zuerst": Tafel-Seite höchstens 1,2 s aufs Netz warten,
                                      sonst gespeicherte Version; neue Version wird immer vollständig geladen und gespeichert.
                                      sw.js stempelt `<html data-kb-ver>` (Prüfsumme) → `KB_VER`; die Seite fragt per `kb-check` nach
                                      und lädt sich still neu (`maybeApplyUpdate`: frisch gestartet / 1 min unsichtbar / 20 min unberührt,
                                      nie bei laufendem Timer, Dialog, Zeichnen, Mikro/Kamera, Video, Vollbild — `canSilentReload`).
                                      /.netlify/ und fremde Adressen nie anfassen. Bei Änderungen an sw.js CACHE-Version erhöhen
                                      Symbole erzeugt per Python/PIL (Herz + Puls auf Petrol), auch favicon.png/apple-touch-icon.png
supabase/functions/ai-generate/     ← KI-Tafel-Generator + Sprachbefehle (Groq) — separat via Supabase deployen
```

## Architektur (index.html)
- **Single-file HTML** — kein Build-Step, kein Framework
- **Wichtige globale Objekte:** `APP`, `AUTH`, `DRAW`, `CLASSES`, `REGISTRY`, `WIDGET_RENDERERS`
- **Widget-System:** `REGISTRY` (Metadaten) + `WIDGET_RENDERERS` (Render-Funktionen) + `renderWidgetContent(w, body)`
- **Startup-Sequenz:** `AUTH.init()` → `DRAW.init()` → `initChromeIcons()` → `renderDock()` → `applyChromePrefs()` → `init()`
- **Toolbar (oben):** `z-index:99999`, `pointer-events:all` — darf nie blockiert werden

## Oberfläche (seit Nov 2026, „Etappe 1")
- **Obere Leiste `#toolbar`:** nur Navigation (Klasse, Tafel-Reiter, Schalter „Ansicht | Bearbeiten", Vollbild, `⋯`, Anmelden).
  Der Schalter `#edit-mode-btn` zeigt BEIDE Zustände (`.em-opt`, aktiver hell) — nie wieder ein einzelner Knopf, der nur den
  aktuellen Zustand nennt (Nutzer tippte „Bearbeiten" an und schaltete es damit aus). `setEditMode(on, explain)` zeigt einen Hinweis
- **Untere Leiste `#dock`:** Elemente mit einem Klick hinzufügen — `renderDock()`, Auswahl in `kb_dock_items`
  (`openDockCustomizer()`); rechts fest: „Zeichnen" (`#dock-draw`, auf Wunsch des Nutzers unten), „KI", „Mehr" (`#btn-add-widget`
  öffnet `openWidgetMenu()`). Größen-Griff und Kopf-Knöpfe der Elemente sind im Bearbeiten-Modus immer sichtbar (Touch hat kein Hover)
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
- **Vorlagen-Kategorien:** jede Vorlage hat `cat` (siehe `TPL_CATS`: start, phase, move, game, social, fach, orga);
  Start-Dialog filtert nach Kategorie und Suchbegriff (Umlaute egal). Namensrad/Gruppen ohne Namen bekommen beim
  Anwenden die gemerkte Klassenliste. Ampel kann eigene Beschriftung haben (`config.labels`, immer über `safeText`),
  Uhr hat `config.style` digital/analog/both/practice (Übungsuhr mit `sayTime`)
- **Start-Dialog:** `openStartDialog('new' | 'replace')` — Vorlagen-Galerie mit automatischen Vorschaubildern + KI-Feld;
  „+" in der oberen Leiste öffnet ihn. `applyTemplate(tpl, mode)`
- **Timer:** Ring + direkte Bedienung (−/+, Voreinstellungen); Layout `wide`/`tall`/`compact` je nach Größe.
  Laufzeit-Zustand weiter auf dem Widget-Objekt (`_timerRunning/_timerEndAt/_timerRemaining`)
- **Ampel = „Arbeitsform":** Liste mit Wort + Symbol (ab ca. 230×170), sonst drei Lichter; `config.state` bleibt red/yellow/green
- **Leere Elemente:** `emptyCta(icon, text, onClick)` statt Hinweistext „⚙ Einstellungen" — funktioniert auch in der Ansicht
- **Demo:** bewusst nur 2 Tafeln (Gratis-Limit 3), damit „+" beim ersten Besuch nicht sofort die Bezahl-Meldung zeigt

## Vollbild einzelner Elemente + Zeichnen
- `toggleWidgetFull(id)` / `exitWidgetFull()`: Element füllt den Bildschirm (Kopf-Knopf im Bearbeiten-Modus, Eck-Knopf
  `.w-full-btn` in der Ansicht). Renderer bekommen über `widgetFullProxy()` die Bildschirmgröße als `w.w`/`w.h` —
  die gespeicherte Größe wird NICHT verändert. `youtube`/`browser` werden dabei nicht neu aufgebaut
- Zeichnen (`DRAW`): Werkzeuge über `data-tool` (pen, marker, laser, eraser, select, text); Formen über das Menü
  `#dt-shapes` (`DRAW_SHAPE_LIST`: line, arrow, rect, ellipse, compass, axes; Schalter `fill`/`dash`). Formen zeichnen ihre
  Vorschau über dem Undo-Schnappschuss (`_previewShape(final)`, Länge/Radius als Beschriftung nur in der Vorschau)
- Messwerkzeuge `DRAW_INSTR` (ruler, setsquare, protractor) über `#dt-measure`: SVG an `<body>`, Kanten in `edges`
  (lokal zum Drehpunkt). `_instrSnap` projiziert Striche, die dicht an einer Kante beginnen, auf die Kante.
  1 Einheit = `DRAW_UNIT` (50 px), keine echten Zentimeter. Auf schmalen Bildschirmen `ins.scale` < 1
- Laserpointer auf eigener Ebene `#draw-laser` (kein Undo, nichts gespeichert). Auswahl: ausgeschnittener Bereich
  schwebt als `.draw-float`; gespeichert wird erst nach dem Ablegen (`_scheduleSave` wartet, `saveBoard` legt ab)

## Elemente seit „alles von Classroomscreen und besser" (Nov 2026)
- Neu: `worksymbols`, `scoreboard`, `visualtimer` (läuft über denselben Timer-Wächter wie `timer`), `countdown`,
  `calendar` (markiert Countdown-Tage der Tafel), `sticker` (Karte ohne Hintergrund via `data-type`), `webcam`
  (Stream nie automatisch: `CAM_ON` gilt nur pro Sitzung; `stopCam` beim Neuaufbau/Entfernen), `video` (Datei in IndexedDB wie PDF)
- Würfel: gezeichnete SVG-Würfel, 1–6 Stück (`config.count`, `config.values`)
- Klassenliste: `getRoster()/setRoster()` in localStorage `classpuls_roster` pro Klasse, NICHT in der Cloud.
  Neue `names`/`groups` starten damit (`newWidgetConfig`); Dialoge haben „Klassenliste einfügen/merken"
- Tafel teilen: `shareBoardLink()` packt die Tafel (ohne Bilder/Dateien, `_slimConfig`) deflate-komprimiert in
  `#tafel=…`; `checkSharedBoard()` beim Start fragt vor dem Hinzufügen nach und säubert die Adresse
- Hintergrund: Fotosuche im Hintergrund-Dialog über `image-search` mit `size:'large'` (Pixabay 1280 px, data:-URL)

## Grundschul-Paket (16.11.2026, nach Fotos aus dem echten Unterricht mit Classroomscreen)
- `dayplan` (Tagesplan): Zeilen `{text, icon, time, done, manual}`; farbige SVG-Bildsymbole `PICTOS` (31 + 4 Jahreszeiten,
  Auswahl `PICTO_LIST`, Picker `openPictoPicker`), `guessPicto(text)` wählt das Symbol nach Stichwort. Antippen hakt ab,
  erste offene Zeile = „jetzt". Haken verschwinden am nächsten Tag (`config.day` = `todayKey()`, abschaltbar `autoReset`)
- Tagesplan „automatisch aus dem Stundenplan" (`config.source = 'timetable'`): `dayplanRowsFromTimetable(w, cache, now)` baut
  die heutigen Zeilen aus `APP.icalCache` (Doppelstunden zusammengefasst, parallele Fächer „Religion / Ethik", Pausen/Mittagessen
  aus Lücken ≥ 15 min, Ganztägiges als Banner, Ausfall/Vertretung markiert). Erledigt = nach der Uhr, Antippen überschreibt
  (`config.marks` pro Tag). Kürzel → Wörter über `SUBJECT_NAMES`/`subjectName()`, eigene Namen/Symbole in `config.subjects`,
  eigene Punkte mit Uhrzeit in `config.extras`. Abo pro Tafel; `icalFor(board, adopt)` übernimmt das einer anderen Tafel der Klasse.
  Aktualisierung läuft über `startTimetableRefresh`/`rerenderTimetables` wie beim Stundenplan-Element. Passt nicht alles hin,
  wird Erledigtes oben eingeklappt („✓ 3 erledigt"). `_slimConfig` lässt `icalUrl`/`marks` beim Teilen weg (persönlicher Kalender-Schlüssel!)
- `duties` (Klassendienste): `config {names, duties:[{text, icon, count}], rotate:'week'|'day'|'manual', startPeriod, offset, absent}`.
  `dutyAssign(cfg, now)`: Platz j im Zeitraum p bekommt Name (p·S + j) mod L → alle Kinder reihum. Zeitraum über `dutyBase`
  (Wochen bzw. Schultage seit 1.1.2024; Wochenende = Freitag) minus `startPeriod` (wird beim Ändern von Namen/Wechsel/Anzahl
  neu gesetzt → Liste beginnt oben) plus `offset` (‹ › im Dialog, „Weiter" bei „von Hand"). Name antippen = fehlt in diesem
  Zeitraum (`absent`), die Nächsten ohne Dienst rücken nach, „für …" holt zurück. Eigene Bildsymbole `DUTY_PICTO_LIST`/`guessDuty`;
  `openPictoPicker(anchor, onPick, list)`. Namen kommen aus der Klassenliste (`newWidgetConfig`/`applyTemplate`); `absent` wird nicht geteilt
- `today` (Datum): Karten (Wochentag mit Wochenfarben, Tag/Monat/Jahr, Jahreszeit über `seasonOf`) oder Satz „Heute ist …";
  stellt sich selbst um (Intervall 30 s). `link`: Webseite (nur http/https, per `new URL` geprüft) oder andere Tafel (`switchBoard`)
- Hintergrund-Muster: `{type:'pattern', value:key}` aus `BG_PATTERNS` (SVG erst beim Anzeigen erzeugt, gespeichert wird nur das
  Kürzel → klein und teilbar). Immer über `boardBgCss(bg)` / `patternCss(key)` darstellen
- Zeitkreis: Minutenskala gegen den Uhrzeigersinn, Zeit durch Tippen/Ziehen am Kreis einstellen; flach-breit = Kreis links
- Bild „Ohne Rahmen" (`config.frameless` → `.widget.frameless`) für freigestellte PNGs; PNG bleibt transparent (notfalls verkleinert)
- Tafel-Übersicht `openBoardOverview()` (Vorschau `boardThumb`, öffnen/kopieren inkl. Zeichnung/umbenennen/verschieben/löschen),
  Blätter-Anzeige `#board-pager` (erst ab 1280 px oder im Vollbild), Bild-auf/ab-Tasten = Präsentations-Fernbedienung (`stepBoard`)
- `createBoard` sichert die Zeichnung der alten Tafel und lädt die (leere) der neuen; `fitLayout` behält bei Breite 0 die Vorlagenmaße

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

## App-Installation + alte Browser (17.11.2026)
- `installApp()` nutzt `beforeinstallprompt` (ein Klick), sonst `openInstallHelp()` mit Anleitung passend zum Gerät;
  Menü ⋯ „Als App installieren", einmaliger Hinweis `#install-hint` (gemerkt in `kb_install_hint`)
- `<script data-guard>` vor allen anderen Skripten (bewusst ES5!): fehlen `?.`/`??` oder Container-Queries (Chrome < 105),
  erscheint statt einer kaputten Seite eine Erklärung mit erkannter Browser-Version + „Trotzdem öffnen". Der Syntax-Check
  oben greift nur das erste `<script>` OHNE Attribute — der Wächter hat deshalb ein Attribut und muss es behalten
- Zielgeräte des Nutzers: CTOUCH Riva (1) mit Android 8 und Riva D2. Nutzer will es OHNE CTOUCH (kein CTOUCH-Store)

## Android-App (`android/`, seit 17.11.2026)
- Schlanke Java-App mit **GeckoView** (Mozilla, Maven `maven.mozilla.org`), weil die System-Browser/WebViews alter
  Smartboards zu alt sind. minSdk 26 (= GeckoView-Minimum, Android 8), targetSdk 34 (damit `onBackPressed` noch kommt),
  Paket `de.klassenboard.app` (NIE ändern – sonst keine Updates), Name „ClassPuls" nur als Beschriftung
- `BaseActivity`: Sitzung + Delegates (Downloads → „Downloads", Dateiauswahl, Mikrofon/Kamera nur für unsere Domain,
  alert/confirm/prompt, neue Fenster → `PopupActivity`). User-Agent endet auf `ClassPulsApp/<version>` → Web-App
  setzt `IN_ANDROID_APP`. `MainActivity`: Vollbild, Bildschirm bleibt an, Zurück = in den Hintergrund statt beenden
- Gebaut wird NUR in GitHub Actions (`.github/workflows/android.yml`, kein Java/SDK lokal): Job `test` baut x86_64 und
  macht im Android-8-Emulator Bildschirmfotos → Vorab-Release `app-test` (öffentlich lesbar). Job `release` signiert mit
  Secrets `KEYSTORE_BASE64` + `KEYSTORE_PASSWORD` und veröffentlicht `ClassPuls.apk` als neuestes Release
- Download-Link (fest): `https://github.com/TCAK14/KlassenBoard/releases/latest/download/ClassPuls.apk`, Seite `/app` (`app.html`)
- Signatur-Schlüssel liegt NUR lokal in `.signing/` (gitignored) + in den GitHub-Secrets. Verlust = keine Updates mehr

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
- [ ] Rest aus Etappe 1: Zeichen-Leiste und Dialog-Überschriften nutzen noch Emojis; Dialoge sind noch dunkel;
      Landing Page hat noch das alte Indigo-Branding und die Systemschrift
