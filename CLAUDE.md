# Scolavis (früher ClassPuls / KlassenBoard) – Projektkontext für Claude Code

## Überblick
Classroom-Board-App für Lehrkräfte. Single-File HTML App, Auto-Deploy bei jedem Push auf `main`.
- **Name:** seit 18.11.2026 „Scolavis". Sichtbare Texte heißen Scolavis; technische Kennungen bleiben beim alten Namen,
  damit vorhandene Daten/Installationen weiterlaufen (`classpuls_*` in localStorage, IndexedDB `classpuls_files`,
  Cache `classpuls-v*`, Paket `de.klassenboard.app`, `ClassPulsApp/` im User-Agent, `ClassPuls.apk`)
- **Live:** https://scolavis.de und https://scolavis.com — „/" ist die Verkaufsseite (`landing.html`), die Tafel liegt
  unter `/index.html`. Beide Adressen zeigen die Seite selbst (keine Umleitung .com → .de, Wunsch des Nutzers)
- **Alte Adresse:** https://klassenboard.netlify.app (dort ist „/" die Tafel) — zeigt nur noch den Umzugs-Hinweis
- **Umzug der gespeicherten Tafeln** (Browser speichern pro Adresse getrennt): `umzug.html` (nur auf der alten Adresse
  sinnvoll) packt localStorage `classpuls_*`/`kb_*` + IndexedDB-Dateien in `scolavis-umzug.json` (ohne Anmeldedaten);
  `UMZUG` in index.html packt sie auf scolavis.de aus (`#umzug` öffnet den Dialog, ersetzt die lokalen Daten, lädt neu).
  Auf der alten Adresse zeigt `UMZUG.banner()` eine Hinweis-Leiste. Android-App macht das beim ersten Start selbst
- **Repo:** https://github.com/TCAK14/KlassenBoard
- **Domains/E-Mail:** bei INWX; `info@scolavis.de` ist eine Weiterleitung (INWX „Mail Easy") — MX/SPF-Einträge der
  Domain nie verlieren
- **Marke:** Logo `img/logo-scolavis.jpg` (vom Nutzer geliefert), Farben `--accent:#6D4BFF`, `--brand-grad`
  (#C04BFF → #6D4BFF → #22D3F5), Hintergrund #050136. Geschmack des Nutzers: futuristisch, leuchtend, nicht schlicht

## Hosting: Cloudflare (seit 19.11.2026; vorher Netlify)
- **Warum:** Netlify rechnet seit 2025 in „Credits" (jede Veröffentlichung kostet welche); das Konto lief deshalb
  auf Pro (20 $/Monat). Cloudflare Workers ist für diese Seite kostenlos
- **Stand:** scolavis.de + scolavis.com laufen über Cloudflare (Konto scolavis@gmail.com, Gratis-Tarif; NICHT das
  Cloudflare-Konto des anderen Projekts des Nutzers). Nameserver bei INWX: burt/emily.ns.cloudflare.com. DNS liegt bei
  Cloudflare: MX/SPF/DMARC für die Mail-Weiterleitung NIE löschen. www → ohne www per Redirect Rule (www-Eintrag =
  Platzhalter 192.0.2.1, proxied). Jeder Push auf `main` veröffentlicht automatisch („Workers Builds", GitHub-App nur
  für dieses Repo). Test-Adresse: scolavis.scolavis.workers.dev. Netlify (klassenboard.netlify.app) läuft nur noch für
  die Android-App
- **Cloudflare:** Worker „scolavis" (`wrangler.jsonc`). Dateien werden direkt ausgeliefert („static assets"), das Skript
  `cloudflare/worker.js` läuft nur, wenn keine Datei passt: „/" → landing.html, `/app`, `/handy`, `/api/*`, sonst 404-Seite.
  `html_handling: "none"` ist Pflicht — sonst leitet Cloudflare `/index.html` auf „/" um und die Tafel wäre weg
- **`.assetsignore` ist eine Erlaubnisliste:** neue öffentliche Dateien/Ordner dort freigeben, sonst 404
- **`_headers`:** Cache-Regeln für Cloudflare (dieselben stehen für Netlify in `netlify.toml`)
- **Server-Funktionen gibt es doppelt**, solange Netlify noch läuft: `cloudflare/worker.js` (Cloudflare) und
  `netlify/functions/*.js` (alte Adresse). Die Seite ruft `/api/<name>` auf; Netlify schreibt das per `netlify.toml`
  auf `/.netlify/functions/<name>` um. Änderungen am Verhalten immer an beiden Stellen
- **Geheime Schlüssel** (`GEMINI_API_KEY`, `PIXABAY_API_KEY`, `STRIPE_SECRET_KEY`): nur als Secrets bei Cloudflare
  (Worker → Settings → Variables and Secrets) bzw. als Netlify-Umgebungsvariablen — nie in Dateien
- **Lokal testen:** `npx wrangler dev` (braucht Node; ohne Schlüssel antwortet die KI mit 503, Stundenplan und
  Bildersuche über Wikimedia laufen trotzdem). `npx wrangler deploy --dry-run` prüft Konfiguration und Skript

## Dateistruktur
```
index.html                          ← Haupt-App (gesamte Logik + UI)
landing.html                        ← Landing Page (Pricing, FAQ, Checkout)
impressum.html / datenschutz.html   ← Rechtsseiten (Impressum hat noch Platzhalter!)
cloudflare/worker.js                ← Cloudflare: Kurzadressen + alle Server-Funktionen (/api/ai-chat, image-search, ical, create-checkout)
wrangler.jsonc, .assetsignore, _headers ← Cloudflare-Einstellungen (siehe „Hosting")
netlify/functions/create-checkout.js ← dieselben Funktionen für die alte Netlify-Adresse: Stripe
netlify/functions/ai-chat.js        ← KI-Assistent (Gemini 2.5 Flash; Web-Suche nur bei Bedarf)
netlify/functions/image-search.js   ← Bildersuche des KI-Assistenten (Pixabay/Wikimedia, liefert data:-URL)
netlify/functions/ical.js           ← Stundenplan-Abruf (iCal/WebUntis), ersetzt fremden CORS-Proxy
handy.html                          ← Seite fürs Handy/Dienstgerät (Foto, Live-Kamera, Fernbedienung, Schüler-Abgabe)
fonts/                              ← Atkinson Hyperlegible Next (lokal gehostet, OFL) — nie von Google-Servern laden
vendor/                             ← QRCode.js + supabase-js (Version im Dateinamen) — keine fremden Server beim Start
manifest.webmanifest, sw.js, icons/ ← installierbare App (PWA). sw.js „lokal zuerst": Tafel-Seite höchstens 1,2 s aufs Netz warten,
                                      sonst gespeicherte Version; neue Version wird immer vollständig geladen und gespeichert.
                                      sw.js stempelt `<html data-kb-ver>` (Prüfsumme) → `KB_VER`; die Seite fragt per `kb-check` nach
                                      und lädt sich still neu (`maybeApplyUpdate`: frisch gestartet / 1 min unsichtbar / 20 min unberührt,
                                      nie bei laufendem Timer, Dialog, Zeichnen, Mikro/Kamera, Video, Vollbild — `canSilentReload`).
                                      /api/, /.netlify/ und fremde Adressen nie anfassen. Bei Änderungen an sw.js CACHE-Version erhöhen
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

## Anzeige-Maßstab, Rückgängig (seit 23.11.2026)
- **Tafeln sehen auf jedem Bildschirm gleich aus:** `board.size.w` = Fensterbreite, für die die Maße der Tafel gelten
  (`stampBoardSize`, gesetzt in `createBoard`, beim Anwenden einer Vorlage, sonst beim ersten Verschieben/Hinzufügen).
  `boardScale()` → `VIEW.scale`; `updateLayerSize()` skaliert `#widgets-layer` per CSS-`transform` (nur nach der Breite,
  nicht unter 600 px, Tafeln ohne `size` = 1). Gespeicherte Maße (x/y/w/h) bleiben unverändert – Renderer rechnen weiter
  in Tafel-Maßen. **Wer Zeiger-Koordinaten in Tafel-Maße umrechnet, teilt durch `VIEW.scale`** (`initDrag`, `initResize`,
  `findFreeSpot`, Doppelklick-Text). Bei Element-Vollbild ist der Maßstab per CSS aus (`body.wfull-on`), weil
  `position:fixed` in einer transformierten Ebene nicht geht. Menü ⋯ „An Bildschirm anpassen" (`fitBoardToScreen`) setzt
  `size` aus dem Inhalt – auch für alte Tafeln. Geteilte Links tragen die Breite mit (`s`). Die Zeichnung (DRAW) liegt in
  Bildschirm-Pixeln darüber und skaliert NICHT mit
- **Rückgängig:** `APP.snapshotUndo()` VOR jeder Änderung (Stapel `APP.state.undoStack`, max. 25 Stände/12 MB);
  Ziehen/Größe ändern legen den Stand erst beim Loslassen ab (`snapshotUndo(before)`). Knopf `#btn-undo` in der oberen
  Leiste (nur sichtbar, wenn es etwas gibt), Menü ⋯, Strg+Z. `toast(text, dauer, {label, fn})` zeigt einen Knopf in der
  Meldung – Löschen fragt nicht nach, bietet aber 8 s „Rückgängig". Einstellungs-Dialoge legen noch KEINEN Stand ab
- Ansicht/Bearbeiten wird pro Gerät gemerkt (`kb_edit_mode`)

## Vollbild einzelner Elemente + Zeichnen
- `toggleWidgetFull(id)` / `exitWidgetFull()`: Element füllt den Bildschirm (Kopf-Knopf im Bearbeiten-Modus, Eck-Knopf
  `.w-full-btn` in der Ansicht). Renderer bekommen über `widgetFullProxy()` die Bildschirmgröße als `w.w`/`w.h` —
  die gespeicherte Größe wird NICHT verändert. `youtube`/`browser` werden dabei nicht neu aufgebaut
- Zeichnen (`DRAW`): Werkzeuge über `data-tool` (pen, marker, laser, eraser, select, text); Formen über das Menü
  `#dt-shapes` (`DRAW_SHAPE_LIST`: line, arrow, rect, ellipse, compass, axes; Schalter `fill`/`dash`). Formen zeichnen ihre
  Vorschau über dem Undo-Schnappschuss (`_previewShape(final)`, Länge/Radius als Beschriftung nur in der Vorschau)
- Stiftarten `DRAW_PENS` (fine, fountain, pencil, chalk, brush) in `DRAW.penKind`; Menü öffnet sich beim zweiten Antippen des Stifts.
  `_strokeSpec()` beschreibt jeden Strich (Breite, `live`, `alpha`, `grain`, `vary`). Durchscheinende/körnige Striche (Textmarker,
  Bleistift, Kreide) entstehen voll deckend auf der Ebene `#draw-live` und werden beim Loslassen in EINEM Schritt mit `alpha`
  übertragen (`_liveCommit`) — nie wieder mit halbtransparenter Farbe direkt zeichnen (überlagert sich selbst → fleckig).
  Füller/Pinsel: Breite nach Tempo bzw. Stiftdruck (`_flushVary`). Körnung = festes Punktmuster per `destination-out` (`_grain`)
- Farben: `openColorPop(anchor, current, onPick)` (Raster + Farbton/Helligkeit) statt `<input type="color">` — das Farb-Fenster
  des Browsers gibt es in der Android-App nicht; dort fängt ein Klick-Wächter alle übrigen Farbfelder ab und zeigt unser Fenster
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

## Handy-Verbindung (`PHONE` in index.html + eigene Seite `handy.html`, seit 18.11.2026)
- Knopf „Handy" in der unteren Leiste (`#dock-phone`) → `PHONE.toggle()` zeigt den QR-Code `…/handy.html#p.<kanal>.<schlüssel>`.
  **Der QR-Code ist nur eine Einladung** (seit 23.11.2026): eigener Kanal `kbp-<kanal>`, bei jedem Öffnen des Fensters neu,
  nirgends gespeichert (`PHONE.pair`, `pairStart/pairStop`). Das Gerät schickt `pair` (Geräte-Kennung `kb_dev`, zweistellige
  Nummer, ECDH-Schlüssel), die Tafel zeigt die Nummer im Fenster („Neues Gerät verbinden?"), bei „Verbinden" schickt sie den
  privaten Kanal `this.link` (`v:2`) nur für dieses Gerät lesbar (`pairAnswer`, ECDH P-256 → AES-GCM). Über den
  Einladungs-Kanal wird sonst nichts angenommen. Wer den QR-Code abfotografiert, kann damit später nichts anfangen.
  Kopplung bleibt danach (Tafel: `kb_phone_link`, Handy: `kb_link`); „Alle Geräte trennen" (`PHONE.reset`) erzeugt einen
  neuen privaten Kanal. Tafel lauscht nach dem Start nur, wenn in den letzten 12 h benutzt
- Transport: Supabase Realtime **Broadcast** (`kbl-<kanal>`, Ereignis `m`), jede Nachricht AES-GCM-verschlüsselt (`kbSeal/kbUnseal`),
  nichts wird gespeichert, keine Tabellen. Nachrichten: `hello`/`state`, `ph`+`pc` (Foto in 40-KB-Stücken, Antwort `ph-ok`), `text`,
  `nav`, `act`, `full`, `laser`, `live-start`/`rtc`/`lf`/`live-stop`, `drop-*`
- Fotos landen als Bild-Element mit `config.fileId` in IndexedDB (`PDFSTORE`, `addPhotoWidget`, `localImageUrl`) — nicht in
  localStorage/Cloud (Platz + Datenschutz); `_slimConfig` lässt `fileId` weg
- Fernbedienung ist bewusst allgemein: `PHONE.controls()` liest die sichtbaren Knöpfe eines Elements aus dem DOM und „tippt" sie
  an (`act` mit `b:<index>`); nur die Ampel hat eigene Befehle. Neue Elemente sind damit automatisch fernbedienbar —
  Knöpfe brauchen dafür einen lesbaren Text oder `aria-label`/`title`
- Live-Kamera: erst WebRTC direkt (STUN `stun.cloudflare.com`, Signale über den Kanal), nach 7 s ohne Verbindung Einzelbilder
  über den Kanal (`lf`, ~1,5 Bilder/s). Fenster `#phone-live` ist nicht Teil der Tafel-Daten
- Schüler-Abgabe: eigener Kanal `kbd-<kanal>`, QR enthält den öffentlichen ECDH-Schlüssel der Tafel → nur die Tafel kann Fotos
  lesen (auch Mitschüler im selben Kanal nicht). Eingang zeigt zuerst nur Namen (die Klasse schaut mit); Freigabe an der Tafel
  oder am Lehrer-Handy. Grenzen: 5 Fotos pro Gerät, 40 im Eingang. Namen/Texte von außen nur über `textContent`
- Lokal testbar ohne Supabase: `AUTH.client` (Tafel) bzw. `sb` (handy.html) durch einen `BroadcastChannel`-Nachbau ersetzen
- Supabase-Grenzen im Blick behalten: Gratis-Tarif 200 gleichzeitige Verbindungen, Projekt pausiert nach 7 Tagen ohne Nutzung

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
- **Server-Schutz:** beide Funktionen verlangen einen `Origin` aus `ALLOWED_ORIGINS` (scolavis.de/.com, www, alte
  Netlify-Adresse; bei Cloudflare zusätzlich die Adresse, unter der die Anfrage ankam; fehlender Origin → 403)
  und haben eine einfache Bremse pro IP (nur pro Instanz!). Lokal mit python http.server laufen die Funktionen nicht —
  dafür `npx wrangler dev`. Fehler gehen als Kürzel (`busy`, `rate`, `timeout`) an den Browser, Details nur ins
  Server-Protokoll (Cloudflare: Worker → Logs)

## Startphase: alles kostenlos
- `LAUNCH_PHASE = true` (index.html, bei `FREE_LIMITS`): keine Grenzen für Tafeln/Klassen, kein „Upgrade auf Pro" –
  es gibt keinen Kaufweg. KI: 100 Fragen pro Kalendermonat (`kb_text_ai_count` = „JJJJ-MM:Zahl", nur im Browser gezählt).
  Erst auf `false` stellen, wenn Bezahlen wirklich funktioniert
- Rechtsseiten: `impressum.html`/`datenschutz.html` im Markenlook; bei jedem neuen Dienst/Hoster die Datenschutzerklärung
  (Abschnitt + Tabelle „Übersicht der Dienste") mitziehen. Verlinkt aus Menü ⋯, Anmelde-Dialog und `handy.html`

## Stripe / Payments
- **Publishable Key** (im Code erlaubt): `pk_test_51TibNc9fJyerANl5...`
- **Secret Key:** NUR als Secret `STRIPE_SECRET_KEY` beim Hoster (Cloudflare/Netlify) — NIEMALS in Dateien schreiben
- Checkout-Funktion: `/api/create-checkout` (`cloudflare/worker.js`, ruft Stripe direkt per `fetch` auf — ohne npm-Paket;
  alt: `netlify/functions/create-checkout.js`). Derzeit ruft keine Seite sie auf: die Verkaufsseite sagt
  „In der Startphase kostenlos", die Kaufknöpfe sind entfernt
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

**Ohne Node.js auf dem Rechner** (Stand Nov 2026 nicht fest installiert; eine tragbare Kopie von nodejs.org im
Arbeitsordner genügt, auch für `wrangler`): gleichwertiger Check im Browser-Preview
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
- Start: `https://scolavis.de/index.html` (seit 19.11.2026). Beim ersten Start nach dem Update öffnet `MainActivity` einmal
  `klassenboard.netlify.app/umzug.html?app=1`, fängt den Download ab (`onExternalResponse`), öffnet `…/index.html#umzug`
  und reicht die Datei beim Antippen von „Übernehmen" über `onFilePrompt` durch (nur bei accept mit „json").
  SharedPreferences `scolavis`: `umzug_done`, `umzug_tries` (nach 3 Versuchen gibt sie auf)
- Schlanke Java-App mit **GeckoView** (Mozilla, Maven `maven.mozilla.org`), weil die System-Browser/WebViews alter
  Smartboards zu alt sind. minSdk 26 (= GeckoView-Minimum, Android 8), targetSdk 34 (damit `onBackPressed` noch kommt),
  Paket `de.klassenboard.app` (NIE ändern – sonst keine Updates), Name „ClassPuls" nur als Beschriftung
- `BaseActivity`: Sitzung + Delegates (Downloads → „Downloads", Dateiauswahl, Mikrofon/Kamera nur für unsere Domain,
  alert/confirm/prompt, neue Fenster → `PopupActivity`). GeckoView zeigt für `<select>` und Datums-/Zeitfelder nichts von
  selbst: `onChoicePrompt`/`onDateTimePrompt` öffnen dafür Android-Fenster (seit 23.11.2026, am Gerät noch nicht geprüft). User-Agent endet auf `ClassPulsApp/<version>` → Web-App
  setzt `IN_ANDROID_APP`. `MainActivity`: Vollbild, Bildschirm bleibt an, Zurück = in den Hintergrund statt beenden
- Gebaut wird NUR in GitHub Actions (`.github/workflows/android.yml`, kein Java/SDK lokal): Job `test` baut x86_64 und
  macht im Android-8-Emulator Bildschirmfotos → Vorab-Release `app-test` (öffentlich lesbar). Job `release` signiert mit
  Secrets `KEYSTORE_BASE64` + `KEYSTORE_PASSWORD` und veröffentlicht `ClassPuls.apk` als neuestes Release
- Download-Link (fest): `https://github.com/TCAK14/KlassenBoard/releases/latest/download/ClassPuls.apk`, Seite `/app` (`app.html`)
- Signatur-Schlüssel liegt NUR lokal in `.signing/` (gitignored) + in den GitHub-Secrets. Verlust = keine Updates mehr

## Sicherheit (nach dem Gutachten vom 23.11.2026)
- **Einstellungen eines Elements sind fremde Daten** (geteilter Link `#tafel=`, Import-/Umzugsdatei, Cloud): in
  Dialogen und Renderern nie ungeprüft ins HTML – immer `safeText(...)` oder `Number(...)`, auch bei „Zahlen".
  `_typedConfig()` erzwingt beim geteilten Link Zahlen; Adressen aus Einstellungen nur als `data:`/`blob:` (Datei-Element)
  bzw. geprüft per `new URL` (Link-Element) verwenden
- **Kopfzeilen** stehen in `_headers` (`/*`): HSTS, nosniff, Referrer-Policy, Permissions-Policy (Kamera/Mikro nur selbst),
  CSP `frame-ancestors 'self'` u. a. Eine volle CSP gegen Inline-Skripte fehlt noch (die App ist ein Inline-Skript)
- **Server-Funktionen** (`cloudflare/worker.js`): alle verlangen einen erlaubten `Origin`, Körper höchstens 64 KB, Bremse pro IP;
  Stundenplan-Abruf verfolgt Weiterleitungen selbst und prüft jedes Ziel; Bildersuche nutzt Wikimedia nur, wenn die
  Jugendschutz-Prüfung wirklich stattgefunden hat. Die Netlify-Kopien haben diese Härtung NICHT (alte Adresse)
- **PDF.js** wird mit `isEvalSupported:false` aufgerufen (3.11.174 ist sonst angreifbar) – beim Wechsel der Version beibehalten
- Offen aus dem Gutachten: Handy-Kopplung ohne Geräte-Bestätigung (QR gilt dauerhaft), Supabase-Regeln aller Tabellen
  prüfen und ins Repo legen, Kostenlimit bei Google/Groq, Überwachung, PDF.js nach `vendor/`, AVV-Muster für Schulen

## Betrieb und Überwachung (seit 23.11.2026)
- `.github/workflows/wache.yml`: alle 30 Minuten Startseite, Tafel, Handy-Seite, `/api` und Supabase prüfen. Die
  Datenbank-Abfrage hält zugleich das Supabase-Gratis-Projekt wach (pausiert sonst nach 7 Tagen). Bei Ausfall endet der
  Lauf rot → GitHub mailt dem Besitzer
- **Ob Cloudflare eine Version veröffentlicht hat**, sieht man ohne Dashboard über GitHub:
  `https://api.github.com/repos/TCAK14/KlassenBoard/commits/<sha>/check-runs` → „Workers Builds: scolavis"
- Bremse der Server-Funktionen: zusätzlich zum Zähler im Speicher zählt Cloudflare (`ratelimits` in `wrangler.jsonc`:
  `RL_IP` 60/min je IP, `RL_ALL` 600/min gesamt; `overLimit()` in worker.js). Ungefähr, nicht exakt
- `supabase/regeln.sql`: Zugriffsregeln (RLS) für `boards`, `polls`, `poll_votes` zum Ausführen im SQL-Editor
  (Stand 23.11.: vom Nutzer noch nicht ausgeführt). Die Tabelle `class_boards` gibt es NICHT – der Code in `CLASSES`
  versucht sie zu nutzen und fällt auf den lokalen Stand zurück (Klassen stecken ohnehin im Gesamtstand `boards.data`)

## Testen ohne sichtbaren Browser
- Der eingebaute Browser und Chrome hängen gelegentlich. Verlässlich: eine Testseite unter `.wrangler/` (gitignored, wird vom
  python-Server `localhost:8935` ausgeliefert) lädt `index.html`/`handy.html` in iframes, prüft per `contentWindow.eval(...)`
  und schreibt `ERGEBNIS {json}` nach `#out`, Titel `fertig`. Ausführen mit Node + Edge über die Fernsteuer-Schnittstelle
  (`node tools/cdp_run.mjs <adresse> [sekunden] [bild.png]`: startet `msedge --headless=new --remote-debugging-port`, wartet auf
  den Titel, kann ein Bildschirmfoto machen). Echtes Netz und echte Zeit – damit lässt sich auch die Handy-Kopplung
  zwischen zwei iframes über das echte Supabase prüfen. Synthetische Zeiger-Ereignisse brauchen
  `Element.prototype.setPointerCapture = () => {}` im iframe

## Häufige Fallstricke
- **Bilder/Symbole ändern = neuer Dateiname:** `/icons/`, `/fonts/`, `/vendor/` kommen per Service Worker und
  Cache-Header (1 Woche bzw. 1 Jahr) aus dem Speicher. Neuer Inhalt unter altem Namen bleibt bei Nutzern alt
  (passiert beim Logo-Wechsel: altes Herz blieb sichtbar). Logo liegt deshalb unter `icons/scolavis-*.png`
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
- [ ] Nach dem Cloudflare-Umzug: Netlify auf Gratis + Auto-Deploy aus (macht der Nutzer). Android-App startet noch auf klassenboard.netlify.app → auf
      `https://scolavis.de/index.html` umstellen (gespeicherte Tafeln liegen pro Adresse getrennt → Umzugsweg nötig);
      erst danach `netlify/`, `netlify.toml`, `package.json` entfernen
- [ ] Stripe auf Live-Mode umschalten + Webhook, der nach Zahlung `app_metadata.plan` setzt
- [ ] Preistabelle vs. tatsächliche Sperren abgleichen (Cloud-Sync, Datei-Widget, KI sind laut Landing Page Pro, technisch aber frei)
- [ ] Text-Tool: weitere Verbesserungen (Schriftauswahl, Größe)
- [ ] Redesign Etappe 2 (Rest): direkte Bedienung für weitere Elemente (Zufallszahl-Bereich, Namen/Checkliste direkt
      im Element bearbeiten, QR-Link eintippen); KI-Tafel-Generator nutzt noch ein einfaches Fließ-Layout
- [ ] Rest aus Etappe 1: Zeichen-Leiste und Dialog-Überschriften nutzen noch Emojis; Dialoge sind noch dunkel;
      (Landing Page ist seit 19.11.2026 im Markenlook neu gebaut)
