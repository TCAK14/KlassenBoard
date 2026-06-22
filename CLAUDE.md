# KlassenBoard – Projektkontext für Claude Code

## Überblick
Classroom-Board-App für Lehrkräfte. Single-File HTML App deployed auf Netlify via GitHub Auto-Deploy.
- **Live:** https://klassenboard.netlify.app
- **Repo:** https://github.com/TCAK14/KlassenBoard

## Dateistruktur
```
index.html                          ← Haupt-App (gesamte Logik + UI)
landing.html                        ← Landing Page (Pricing, FAQ, Checkout)
netlify/functions/create-checkout.js ← Stripe Backend (Serverless Function)
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

## Häufige Fallstricke
- **File-Truncation:** Bei großen Ersetzungen mit Python arbeiten (nicht Edit-Tool direkt), danach Syntax-Check
- **Backticks in Python-Strings:** Template-Literals `` `...` `` in Python-heredocs können falsch escaped werden → führt zu `SyntaxError`
- **Toolbar nicht klickbar:** Meistens ein JS-Fehler der den Startup-Code verhindert → Syntax prüfen
- **`el()` Funktion:** Existiert im App-Code — kann in Widget-Renderern verwendet werden
- **Widget-Config** persistent über `w.config` + `APP.save()`

## Offene Aufgaben
- [ ] Impressum + Datenschutz Seiten (rechtlich nötig vor Live-Payments)
- [ ] Stripe auf Live-Mode umschalten
- [ ] Freemium-Limits enforzen (1 Klasse / 3 Boards für Free-User via Supabase)
- [ ] Text-Tool: weitere Verbesserungen (Schriftauswahl, Größe)
