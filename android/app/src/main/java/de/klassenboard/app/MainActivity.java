package de.klassenboard.app;

import android.os.Bundle;
import android.view.WindowManager;

import org.mozilla.geckoview.GeckoView;

/** Das Hauptfenster: ClassPuls im Vollbild, Bildschirm bleibt an. */
public class MainActivity extends BaseActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);   // Tafel soll nicht einschlafen
        geckoView = new GeckoView(this);
        geckoView.coverUntilFirstPaint(0xFF050136);
        setContentView(geckoView);
        session = createSession();
        geckoView.setSession(session);
        session.loadUri(HOME);
        applyFullscreen(true);
    }

    @Override
    protected String reloadUri() { return HOME; }

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
        if (isFinishing() && session != null) session.close();
        super.onDestroy();
    }
}
