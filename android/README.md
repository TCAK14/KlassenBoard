# ClassPuls – Android-App (Smartboards, Tablets)

Schlanke Hülle um https://klassenboard.netlify.app mit **GeckoView** (Browser-Technik von Mozilla).
Damit läuft ClassPuls auch auf Displays, deren eingebauter Browser zu alt ist (z. B. CTOUCH Riva mit Android 8).

- **Bauen:** nur über GitHub Actions (`.github/workflows/android.yml`) – lokal ist kein Android-SDK nötig.
  Jeder Push in `android/` startet: Test im Android-8-Emulator (Bildschirmfotos im Vorab-Release `app-test`)
  und – mit den Secrets `KEYSTORE_BASE64` / `KEYSTORE_PASSWORD` – ein signiertes Release `ClassPuls.apk`.
- **Download für Lehrkräfte:** https://klassenboard.netlify.app/app
  (fester Link zur neuesten Datei: `https://github.com/TCAK14/KlassenBoard/releases/latest/download/ClassPuls.apk`)
- **Paketname `de.klassenboard.app` niemals ändern** – sonst lassen sich installierte Apps nicht mehr aktualisieren.
- **Signatur-Schlüssel** liegt nur lokal in `.signing/` (nicht im Repository) und in den GitHub-Secrets.
- **GeckoView aktualisieren:** Version in `app/build.gradle` erhöhen (Sicherheits-Updates des Browsers),
  neueste Version: https://maven.mozilla.org/maven2/org/mozilla/geckoview/geckoview/maven-metadata.xml
