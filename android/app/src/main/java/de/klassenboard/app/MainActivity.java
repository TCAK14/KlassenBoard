package de.klassenboard.app;

import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;

import org.mozilla.geckoview.AllowOrDeny;
import org.mozilla.geckoview.GeckoResult;
import org.mozilla.geckoview.GeckoSession;
import org.mozilla.geckoview.GeckoView;
import org.mozilla.geckoview.WebResponse;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Das Hauptfenster: Scolavis im Vollbild, Bildschirm bleibt an.
 *
 * Umzug (einmalig nach dem Update): Die App lief bis Nov. 2026 unter klassenboard.netlify.app. Browser speichern pro
 * Adresse getrennt – deshalb öffnet die App beim ersten Start einmal OLD_EXPORT. Die Seite packt dort alles in eine
 * Datei und „lädt sie herunter“; die App fängt das ab (onExternalResponse), legt die Datei in den App-Speicher und
 * öffnet scolavis.de/index.html#umzug. Tippt man dort auf „Übernehmen“, reicht onFilePrompt die Datei direkt durch.
 * Gibt es nichts zu übernehmen, leitet die Seite auf …?umzug=leer weiter.
 */
public class MainActivity extends BaseActivity {

    private static final String OLD_EXPORT = "https://" + OLD_HOST + "/umzug.html?app=1";
    private static final String PREFS = "scolavis";
    private static final String P_DONE = "umzug_done", P_TRIES = "umzug_tries";

    private boolean migrating;
    private File importFile;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private SharedPreferences prefs() { return getSharedPreferences(PREFS, MODE_PRIVATE); }
    private File umzugFile() { return new File(getFilesDir(), "scolavis-umzug.json"); }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);   // Tafel soll nicht einschlafen
        geckoView = new GeckoView(this);
        geckoView.coverUntilFirstPaint(0xFF050136);
        setContentView(geckoView);
        session = createSession();
        geckoView.setSession(session);

        SharedPreferences p = prefs();
        if (p.getBoolean(P_DONE, false)) {
            // Übernommene Datei wird nach einem Tag nicht mehr gebraucht
            File f = umzugFile();
            if (f.exists() && System.currentTimeMillis() - f.lastModified() > 24L * 3600 * 1000) f.delete();
            session.loadUri(HOME);
        } else {
            int tries = p.getInt(P_TRIES, 0) + 1;
            // nach drei vergeblichen Versuchen (z. B. alte Adresse nicht mehr da) nicht mehr aufhalten
            p.edit().putInt(P_TRIES, tries).putBoolean(P_DONE, tries >= 3).apply();
            migrating = true;
            session.loadUri(OLD_EXPORT);
            // Hängt die alte Adresse (kein Netz …), startet die Tafel trotzdem – beim nächsten Start neuer Versuch
            handler.postDelayed(() -> { if (migrating) finishMigration(null); }, 20000);
        }
        applyFullscreen(true);
    }

    private void finishMigration(String target) {
        migrating = false;
        handler.removeCallbacksAndMessages(null);
        if (target != null) session.loadUri(target);
        else session.loadUri(HOME);
    }

    @Override
    protected String reloadUri() { return HOME; }

    // Die Umzugsdatei von der alten Adresse abfangen, statt sie in „Downloads“ zu legen
    @Override
    public void onExternalResponse(GeckoSession s, WebResponse response) {
        if (!migrating) { super.onExternalResponse(s, response); return; }
        handler.removeCallbacksAndMessages(null);
        final File f = umzugFile();
        new Thread(() -> {
            boolean ok = false;
            try (InputStream in = response.body; OutputStream out = new FileOutputStream(f)) {
                if (in != null) {
                    byte[] buf = new byte[65536];
                    int len;
                    while ((len = in.read(buf)) > 0) out.write(buf, 0, len);
                    ok = true;
                }
            } catch (Exception ignored) { }
            final boolean saved = ok && f.length() > 0;
            runOnUiThread(() -> {
                if (saved) {
                    importFile = f;
                    prefs().edit().putBoolean(P_DONE, true).apply();
                    finishMigration(HOME + "#umzug");
                } else {
                    finishMigration(null);
                }
            });
        }).start();
    }

    @Override
    public GeckoResult<AllowOrDeny> onLoadRequest(GeckoSession s, GeckoSession.NavigationDelegate.LoadRequest req) {
        // Nichts zu übernehmen → Umzug erledigt
        if (migrating && req.uri != null && req.uri.contains("umzug=leer")) {
            prefs().edit().putBoolean(P_DONE, true).apply();
            migrating = false;
            handler.removeCallbacksAndMessages(null);
        }
        return super.onLoadRequest(s, req);
    }

    // „Übernehmen“ auf scolavis.de: die abgeholte Datei direkt durchreichen (nur für Auswahlfelder, die JSON annehmen)
    @Override
    public GeckoResult<GeckoSession.PromptDelegate.PromptResponse> onFilePrompt(GeckoSession s, GeckoSession.PromptDelegate.FilePrompt p) {
        File f = importFile;
        boolean wantsJson = false;
        if (p.mimeTypes != null) for (String m : p.mimeTypes) if (m != null && m.toLowerCase().contains("json")) wantsJson = true;
        if (f != null && f.exists() && wantsJson) {
            importFile = null;
            return GeckoResult.fromValue(p.confirm(this, Uri.fromFile(f)));
        }
        return super.onFilePrompt(s, p);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (canGoBack && session != null) {
            session.goBack();
        } else {
            moveTaskToBack(true);   // nicht beenden – die Tafel bleibt beim Zurückkehren genau so
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (isFinishing() && session != null) session.close();
        super.onDestroy();
    }
}
