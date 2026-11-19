package de.klassenboard.app;

import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.mozilla.geckoview.GeckoView;

/** Links, die ein neues Fenster öffnen (Webseiten, Videos …): eigenes Fenster mit „Schließen“. */
public class PopupActivity extends BaseActivity {

    private String startUrl;

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startUrl = getIntent().getStringExtra("url");
        if (startUrl == null) { finish(); return; }

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setBackgroundColor(Color.parseColor("#050136"));
        bar.setPadding(dp(8), dp(4), dp(12), dp(4));

        Button close = new Button(this);
        close.setText("✕  Zurück zu Scolavis");
        close.setAllCaps(false);
        close.setTextColor(Color.WHITE);
        close.setBackgroundColor(Color.parseColor("#0B7A74"));
        close.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        close.setPadding(dp(16), dp(8), dp(16), dp(8));
        close.setOnClickListener(v -> finish());

        TextView host = new TextView(this);
        String h = Uri.parse(startUrl).getHost();
        host.setText(h == null ? "" : h);
        host.setTextColor(Color.parseColor("#CCFFFFFF"));
        host.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        host.setSingleLine(true);
        host.setPadding(dp(14), 0, 0, 0);

        bar.addView(close, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(48)));
        bar.addView(host, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        geckoView = new GeckoView(this);
        root.addView(bar, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        root.addView(geckoView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        session = createSession();
        geckoView.setSession(session);
        session.loadUri(startUrl);
    }

    @Override
    protected boolean wantsImmersive() { return false; }

    @Override
    protected String reloadUri() { return startUrl; }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (canGoBack && session != null) session.goBack(); else finish();
    }

    @Override
    protected void onDestroy() {
        if (session != null) session.close();
        super.onDestroy();
    }
}
