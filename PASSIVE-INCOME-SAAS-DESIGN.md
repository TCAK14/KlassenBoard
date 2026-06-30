# Passive-Income-SaaS-Design — Nische: Lehrkräfte / Klassenzimmer-Management

Dieses Dokument wendet das Konzept "Software, die ohne tägliche Anwesenheit Einnahmen generiert" konkret auf **ClassPuls (KlassenBoard)** an, da Produkt, Preismodell und Zahlungs-Backend bereits existieren (`landing.html`, `netlify/functions/create-checkout.js`). Statt eine neue Nische zu erfinden, wird hier gezeigt, wie das bestehende Produkt zu einer wirklich passiven Einnahmequelle ausgebaut wird.

---

## 1. Das zahlungsrelevante Problem

**Nische:** Grundschul- und Sekundarstufen-Lehrkräfte (DACH-Raum), die täglich vor einer physischen oder digitalen Tafel unterrichten.

**Konkretes, monatlich wiederkehrendes Problem:**
Lehrkräfte verwalten Sitzpläne, Gruppeneinteilungen, Zufallsaufrufe, Token-/Belohnungssysteme und Stundenstruktur manuell oder über verstreute Insellösungen (Excel, Papier, Whiteboard-Marker, einzelne Gratis-Apps ohne Sync). Das kostet:

- **Vorbereitungszeit** jede Woche neu (Sitzplan ändern, Gruppen mischen, Differenzierung).
- **Bruch zwischen Geräten**: am Whiteboard im Klassenzimmer vs. am Handy/Laptop zu Hause.
- **Neuaufbau jedes Schuljahr**: neue Klassen, neue Schülerlisten, neue Gruppendynamiken.

Das rechtfertigt ein **Abo statt Einmalkauf**, weil der Bedarf nicht einmalig, sondern an den Schuljahres-Rhythmus gekoppelt ist (jährlich neue Klassen, kontinuierliche Cloud-Synchronisation über mehrere Geräte, laufende Feature-Pflege). Genau das bildet das bestehende Preismodell ab:

| Plan | Preis | Mechanik |
|---|---|---|
| Pro monatlich | 2,50 €/Monat | 14 Tage Trial, danach automatische Abbuchung |
| Pro jährlich | 22 €/Jahr | ca. 1,83 €/Monat, Bindung über Schuljahr |
| Schullizenz | 88 €/Jahr für 5 Lehrkräfte, +15 €/Jahr je weitere Lehrkraft | Jahresabo, Stripe-Abrechnung pro Kollegium |

Das eigentliche zahlungsauslösende Versprechen ist nicht "eine App", sondern **"nie wieder bei null anfangen"**: Sitzpläne, Gruppen und Einstellungen bleiben über Schuljahre und Geräte hinweg erhalten, solange das Abo aktiv ist — das ist der Hebel, der aus einer netten Gratis-App eine zahlungsbereite Notwendigkeit macht.

---

## 2. No-Code-Schicht für den passiven Betrieb

Der Produktkern (`index.html`) ist bereits als Single-File-App ohne Build-Step umgesetzt — das ist faktisch schon "no-code-kompatibel" für Wartung. Um den Betrieb **ohne tägliche Eingriffe** zu skalieren, kommt eine No-Code-Schicht **um** das bestehende Produkt herum, nicht als Ersatz dafür:

| Funktion | Tool | Zweck |
|---|---|---|
| Zahlungen & Abos | **Stripe** (bereits integriert) | Billing, Smart Retries, Trial-Management |
| Backend/Auth/Sync | **Supabase** (bereits integriert) | Nutzerkonten, Cloud-Sync der Boards |
| Automatisierungs-Glue | **Make.com** (oder Zapier) | Verbindet Stripe-Webhooks ↔ E-Mail-Tool ↔ Slack/Telegram |
| Lifecycle-E-Mails | **Loops.so** oder **Brevo** | Trial-Reminder, Onboarding, Win-back, Renewal |
| Support-Deflection | **Crisp** (Chat-Widget + Helpcenter) | Self-Service-FAQ, automatische Antworten außerhalb der Erreichbarkeit |
| Wissensdatenbank | **Notion** (öffentlich freigegeben) | Hilfeartikel, die Crisp/Google indexieren |
| Monitoring | **Netlify Alerts + UptimeRobot → Telegram** | Nur bei echten Ausfällen Benachrichtigung, kein manuelles Prüfen |
| Content/SEO-Funnel | **Make.com + KI-Texttool → automatische Veröffentlichung** | Hält den Akquise-Trichter ohne tägliches Schreiben am Laufen |

Wichtig: Keines dieser Tools erfordert, dass du täglich etwas bedienst — sie laufen ereignisgesteuert (Webhook-getriggert) im Hintergrund.

---

## 3. Automatisierungen für Betrieb ohne tägliche Intervention

1. **Abrechnung & Dunning**: Stripe übernimmt automatische Verlängerung, fehlgeschlagene Zahlungen via *Smart Retries* und automatische Mahn-E-Mails — keine manuelle Rechnungsstellung.
2. **Trial → Paid**: Der bereits konfigurierte 14-Tage-Trial (`trial_period_days: 14` in `create-checkout.js`) konvertiert automatisch zu einem zahlenden Abo, sofern nicht aktiv gekündigt wird.
3. **Onboarding-Sequenz**: Stripe-Webhook (`checkout.session.completed`) → Make.com → Loops.so löst eine automatische Willkommens-/Erklär-E-Mail-Serie aus (Tag 0, Tag 3, Tag 10 vor Trial-Ende).
4. **Win-back bei Kündigung**: `customer.subscription.deleted`-Webhook → automatische Rückgewinnungs-E-Mail nach 30/90 Tagen mit Rabattcode.
5. **Schullizenz-Verlängerung**: Jahresabo verlängert sich automatisch über Stripe; 30 Tage vorher automatische Erinnerungs-E-Mail an die Schule, falls Lehrkräfte-Anzahl angepasst werden soll.
6. **Support-Deflection**: Crisp-Chatbot beantwortet die Top-Fragen automatisch aus der Notion-Wissensdatenbank; nur echte Edge-Cases landen als Ticket, oft im Wochen- statt Tagesrhythmus bearbeitbar.
7. **Monitoring statt manueller Kontrolle**: Uptime- und Funktions-Alerts gehen direkt an Telegram — du musst nicht täglich nachsehen, ob Checkout/App laufen.
8. **Akquise-Funnel**: SEO-Artikel (z. B. "Sitzplan-Generator für Klasse 5b") werden über eine Content-Pipeline vorbereitet und automatisch veröffentlicht, statt aktiv beworben zu werden.

Mit diesen Automatisierungen reduziert sich der manuelle Aufwand auf **wöchentliche statt tägliche** Eingriffe (Edge-Case-Support, gelegentliche Content-Freigabe) — vollständig "zero touch" ist bei einem Solo-SaaS realistisch nicht erreichbar, aber Tagesaufwand nahe null ist es.

---

## 4. Realistische MRR-Schätzung (Monat 3 vs. Monat 6, konstante Nutzerbasis)

**Wichtiger methodischer Punkt:** Bei *konstanter* Nutzerbasis (keine Neuakquise zwischen Monat 3 und 6, nur Bestandskunden) bleibt der **MRR fast unverändert** — das ist kein Rechenfehler, sondern folgt direkt aus der Definition von MRR als normalisierter Monatsumsatz. Kleine Abweichungen entstehen nur durch Mix-Verschiebungen (z. B. Wechsel von Monats- zu Jahresabo bei Verlängerung).

**Annahmen (konservativ, für ein frühphasiges Solo-Produkt ohne bezahlte Werbung):**
- Akquise primär organisch (Lehrer-Communities, SEO, Mundpropaganda)
- Trial-zu-Paid-Konversion: ~4 % (typisch für Prosumer-EdTech ohne Sales-Touch)
- Monatliche Churn-Rate bei Einzellizenzen: ~7–8 % (üblich für Low-Ticket-Consumer-SaaS)
- Verteilung der zahlenden Nutzer: ~70 % Monatsabo, ~30 % Jahresabo
- Schullizenzen: langsamer Vertriebsweg (Schulleitung/Kollegium), wenige, aber stabile Abschlüsse

| | Monat 3 | Monat 6 (Bestand konstant gehalten) |
|---|---|---|
| Zahlende Einzellizenzen (Monatsabo) | 28 × 2,50 € = 70,00 € | 28 × 2,50 € = 70,00 € |
| Zahlende Einzellizenzen (Jahresabo, normalisiert) | 12 × 1,83 € ≈ 22,00 € | 12 × 1,83 € ≈ 22,00 € |
| Schullizenzen (à 5 Lehrkräfte, normalisiert) | 2 × 7,33 € ≈ 14,67 € | 2–3 × 7,33 € ≈ 14,67–22,00 € |
| **MRR gesamt** | **≈ 107 €** | **≈ 107–115 €** |

**Einordnung:** Das ist absichtlich ein nüchterner, kein "Guru"-Wert — bei ~40 zahlenden Nutzern aus einer Nische mit niedrigem Preispunkt (2,50 €/Monat) ist ein MRR im niedrigen dreistelligen Bereich realistisch, nicht vierstellig. Der einzige Weg zu spürbar höherem MRR ohne täglichen Aufwand ist:
1. **Preis pro Nutzer erhöhen** (Schullizenzen statt Einzellizenzen priorisieren — höherer Wert pro Abschluss, langsamerer aber stabilerer Vertrieb), oder
2. **Akquise-Volumen automatisiert hochskalieren** (SEO-Content-Pipeline, Affiliate-/Empfehlungsprogramm über Make.com), was die Konstanz-Annahme aufhebt und das eigentliche Wachstumshebel ist — aber dann ist "konstante Nutzerbasis" per Definition nicht mehr gegeben.

---

## Nächste konkrete Schritte
- [ ] Stripe-Webhook-Handler für `checkout.session.completed` / `subscription.deleted` einrichten (aktuell nur Checkout-Erstellung vorhanden, kein Webhook-Listener im Repo gefunden)
- [ ] Make.com-Szenario: Webhook → Loops.so-Sequenz
- [ ] Notion-Wissensdatenbank + Crisp-Einbindung in `landing.html`
- [ ] Freemium-Limits serverseitig via Supabase erzwingen (bereits in CLAUDE.md als offene Aufgabe vermerkt)
