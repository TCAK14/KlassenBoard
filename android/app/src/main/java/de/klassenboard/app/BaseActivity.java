package de.klassenboard.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.View;
import android.widget.EditText;
import android.widget.Toast;

import org.mozilla.geckoview.AllowOrDeny;
import org.mozilla.geckoview.GeckoResult;
import org.mozilla.geckoview.GeckoRuntime;
import org.mozilla.geckoview.GeckoRuntimeSettings;
import org.mozilla.geckoview.GeckoSession;
import org.mozilla.geckoview.GeckoSessionSettings;
import org.mozilla.geckoview.GeckoView;
import org.mozilla.geckoview.WebResponse;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Gemeinsame Grundlage für das Hauptfenster und Popup-Fenster:
 * eine GeckoView-Browser-Sitzung mit Dateiauswahl, Downloads, Mikrofon/Kamera und Dialogen.
 */
public abstract class BaseActivity extends Activity implements
        GeckoSession.ContentDelegate, GeckoSession.NavigationDelegate,
        GeckoSession.PermissionDelegate, GeckoSession.PromptDelegate {

    static final String HOST = "klassenboard.netlify.app";
    static final String HOME = "https://" + HOST + "/";

    private static final int REQ_PERMS = 11, REQ_FILE = 12, REQ_STORAGE = 13;
    private static GeckoRuntime sRuntime;

    protected GeckoView geckoView;
    protected GeckoSession session;
    protected boolean canGoBack;

    private GeckoSession.PermissionDelegate.Callback pendingPerms;
    private GeckoResult<GeckoSession.PromptDelegate.PromptResponse> pendingFile;
    private GeckoSession.PromptDelegate.FilePrompt pendingFilePrompt;
    private WebResponse pendingDownload;

    static GeckoRuntime runtime(Context c) {
        if (sRuntime == null) {
            GeckoRuntimeSettings settings = new GeckoRuntimeSettings.Builder()
                    .consoleOutput(false)
                    .remoteDebuggingEnabled(false)
                    .build();
            sRuntime = GeckoRuntime.create(c.getApplicationContext(), settings);
        }
        return sRuntime;
    }

    protected String versionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "1";
        }
    }

    protected GeckoSession createSession() {
        // Die Web-App erkennt die App an „ClassPulsApp/…“ (z. B. um „Als App installieren“ auszublenden)
        String ua = GeckoSession.getDefaultUserAgent() + " ClassPulsApp/" + versionName();
        GeckoSessionSettings st = new GeckoSessionSettings.Builder()
                .userAgentOverride(ua)
                .usePrivateMode(false)
                .build();
        GeckoSession s = new GeckoSession(st);
        s.setContentDelegate(this);
        s.setNavigationDelegate(this);
        s.setPermissionDelegate(this);
        s.setPromptDelegate(this);
        s.open(runtime(this));
        return s;
    }

    protected void setImmersive(boolean on) {
        View d = getWindow().getDecorView();
        if (on) {
            d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        } else {
            d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        }
    }

    protected boolean wantsImmersive() { return true; }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && wantsImmersive()) setImmersive(true);
    }

    protected void openPopup(String uri) {
        Intent i = new Intent(this, PopupActivity.class);
        i.putExtra("url", uri);
        startActivity(i);
    }

    protected void restartSession(String uri) {
        runOnUiThread(() -> {
            try { if (session != null) session.close(); } catch (Exception ignored) { }
            session = createSession();
            geckoView.setSession(session);
            session.loadUri(uri);
        });
    }

    protected abstract String reloadUri();

    // ── Inhalt ──────────────────────────────────────────────────────────────
    @Override
    public void onFullScreen(GeckoSession s, boolean fullScreen) {
        setImmersive(fullScreen || wantsImmersive());
    }

    @Override
    public void onCrash(GeckoSession s) { restartSession(reloadUri()); }

    @Override
    public void onKill(GeckoSession s) { restartSession(reloadUri()); }

    @Override
    public void onCloseRequest(GeckoSession s) {
        if (this instanceof PopupActivity) finish();
    }

    @Override
    public void onExternalResponse(GeckoSession s, WebResponse response) {
        if (Build.VERSION.SDK_INT < 29
                && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            pendingDownload = response;
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE);
            return;
        }
        saveDownload(response);
    }

    private static String header(Map<String, String> h, String name) {
        if (h == null) return null;
        for (Map.Entry<String, String> e : h.entrySet()) {
            if (e.getKey() != null && e.getKey().equalsIgnoreCase(name)) return e.getValue();
        }
        return null;
    }

    private static String fileName(WebResponse r) {
        String cd = header(r.headers, "Content-Disposition");
        String name = null;
        if (cd != null) {
            int i = cd.toLowerCase().indexOf("filename*=");
            if (i >= 0) {
                String v = cd.substring(i + 10).split(";")[0].trim();
                int q = v.indexOf("''");
                if (q >= 0) v = v.substring(q + 2);
                try { name = URLDecoder.decode(v, "UTF-8"); } catch (Exception ignored) { }
            }
            if (name == null) {
                i = cd.toLowerCase().indexOf("filename=");
                if (i >= 0) name = cd.substring(i + 9).split(";")[0].trim().replace("\"", "");
            }
        }
        if (name == null || name.isEmpty()) {
            String seg = Uri.parse(r.uri).getLastPathSegment();
            name = (seg != null && seg.contains(".") && !r.uri.startsWith("blob:")) ? seg : "ClassPuls-Download";
        }
        return name.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private void saveDownload(WebResponse r) {
        final String name = fileName(r);
        String type = header(r.headers, "Content-Type");
        final String mime = type != null ? type.split(";")[0].trim() : "application/octet-stream";
        new Thread(() -> {
            try (InputStream in = r.body) {
                if (in == null) throw new IllegalStateException("leer");
                OutputStream out;
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                    v.put(MediaStore.Downloads.MIME_TYPE, mime);
                    Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    out = getContentResolver().openOutputStream(u);
                } else {
                    File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    dir.mkdirs();
                    File f = new File(dir, name);
                    int n = 1;
                    while (f.exists()) {
                        int dot = name.lastIndexOf('.');
                        f = new File(dir, dot > 0 ? name.substring(0, dot) + " (" + n + ")" + name.substring(dot) : name + " (" + n + ")");
                        n++;
                    }
                    out = new FileOutputStream(f);
                }
                byte[] buf = new byte[65536];
                int len;
                while ((len = in.read(buf)) > 0) out.write(buf, 0, len);
                out.close();
                runOnUiThread(() -> Toast.makeText(this, "Gespeichert in „Downloads“: " + name, Toast.LENGTH_LONG).show());
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(this, "Speichern hat nicht geklappt", Toast.LENGTH_LONG).show());
            }
        }).start();
    }

    // ── Navigation ──────────────────────────────────────────────────────────
    @Override
    public void onCanGoBack(GeckoSession s, boolean b) { canGoBack = b; }

    @Override
    public GeckoResult<AllowOrDeny> onLoadRequest(GeckoSession s, GeckoSession.NavigationDelegate.LoadRequest req) {
        Uri u = Uri.parse(req.uri);
        String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase();
        if (scheme.equals("http") || scheme.equals("https") || scheme.equals("about")
                || scheme.equals("data") || scheme.equals("blob") || scheme.equals("javascript")) {
            if (req.target == GeckoSession.NavigationDelegate.TARGET_WINDOW_NEW && !scheme.equals("about") && !scheme.equals("javascript")) {
                openPopup(req.uri);
                return GeckoResult.fromValue(AllowOrDeny.DENY);
            }
            return GeckoResult.fromValue(AllowOrDeny.ALLOW);
        }
        // mailto:, tel:, intent: … an das System weiterreichen
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
        return GeckoResult.fromValue(AllowOrDeny.DENY);
    }

    @Override
    public GeckoResult<GeckoSession> onNewSession(GeckoSession s, String uri) {
        openPopup(uri);
        return null;
    }

    // ── Berechtigungen ──────────────────────────────────────────────────────
    @Override
    public void onAndroidPermissionsRequest(GeckoSession s, String[] permissions, GeckoSession.PermissionDelegate.Callback callback) {
        if (permissions == null || permissions.length == 0) { callback.grant(); return; }
        boolean all = true;
        for (String p : permissions) {
            if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) all = false;
        }
        if (all) { callback.grant(); return; }
        pendingPerms = callback;
        requestPermissions(permissions, REQ_PERMS);
    }

    private static boolean ours(String uri) {
        if (uri == null) return false;
        String h = Uri.parse(uri).getHost();
        return h != null && (h.equals(HOST) || h.endsWith("." + HOST));
    }

    @Override
    public GeckoResult<Integer> onContentPermissionRequest(GeckoSession s, GeckoSession.PermissionDelegate.ContentPermission perm) {
        int p = perm.permission;
        boolean allow;
        if (p == PERMISSION_AUTOPLAY_AUDIBLE || p == PERMISSION_AUTOPLAY_INAUDIBLE || p == PERMISSION_MEDIA_KEY_SYSTEM_ACCESS) {
            allow = true;                                  // Videos/Ton auf der Tafel sollen einfach laufen
        } else {
            allow = ours(perm.uri) && p == PERMISSION_PERSISTENT_STORAGE;
        }
        return GeckoResult.fromValue(allow ? GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW
                : GeckoSession.PermissionDelegate.ContentPermission.VALUE_DENY);
    }

    @Override
    public void onMediaPermissionRequest(GeckoSession s, String uri,
                                         GeckoSession.PermissionDelegate.MediaSource[] video,
                                         GeckoSession.PermissionDelegate.MediaSource[] audio,
                                         GeckoSession.PermissionDelegate.MediaCallback callback) {
        if (!ours(uri)) { callback.reject(); return; }
        GeckoSession.PermissionDelegate.MediaSource v = (video != null && video.length > 0) ? video[0] : null;
        GeckoSession.PermissionDelegate.MediaSource a = (audio != null && audio.length > 0) ? audio[0] : null;
        if (v == null && a == null) { callback.reject(); return; }
        callback.grant(v, a);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        boolean all = results.length > 0;
        for (int r : results) if (r != PackageManager.PERMISSION_GRANTED) all = false;
        if (requestCode == REQ_PERMS && pendingPerms != null) {
            if (all) pendingPerms.grant(); else pendingPerms.reject();
            pendingPerms = null;
        } else if (requestCode == REQ_STORAGE && pendingDownload != null) {
            if (all) saveDownload(pendingDownload);
            else Toast.makeText(this, "Ohne Speicher-Erlaubnis kann die Datei nicht gespeichert werden", Toast.LENGTH_LONG).show();
            pendingDownload = null;
        }
    }

    // ── Dialoge der Webseite ────────────────────────────────────────────────
    @Override
    public GeckoResult<GeckoSession.PromptDelegate.PromptResponse> onAlertPrompt(GeckoSession s, GeckoSession.PromptDelegate.AlertPrompt p) {
        GeckoResult<GeckoSession.PromptDelegate.PromptResponse> res = new GeckoResult<>();
        new AlertDialog.Builder(this)
                .setMessage(p.message)
                .setPositiveButton("OK", (d, w) -> res.complete(p.dismiss()))
                .setOnCancelListener(d -> res.complete(p.dismiss()))
                .show();
        return res;
    }

    @Override
    public GeckoResult<GeckoSession.PromptDelegate.PromptResponse> onButtonPrompt(GeckoSession s, GeckoSession.PromptDelegate.ButtonPrompt p) {
        GeckoResult<GeckoSession.PromptDelegate.PromptResponse> res = new GeckoResult<>();
        new AlertDialog.Builder(this)
                .setMessage(p.message)
                .setPositiveButton("OK", (d, w) -> res.complete(p.confirm(GeckoSession.PromptDelegate.ButtonPrompt.Type.POSITIVE)))
                .setNegativeButton("Abbrechen", (d, w) -> res.complete(p.confirm(GeckoSession.PromptDelegate.ButtonPrompt.Type.NEGATIVE)))
                .setOnCancelListener(d -> res.complete(p.dismiss()))
                .show();
        return res;
    }

    @Override
    public GeckoResult<GeckoSession.PromptDelegate.PromptResponse> onTextPrompt(GeckoSession s, GeckoSession.PromptDelegate.TextPrompt p) {
        GeckoResult<GeckoSession.PromptDelegate.PromptResponse> res = new GeckoResult<>();
        EditText input = new EditText(this);
        input.setText(p.defaultValue);
        input.setSelectAllOnFocus(true);
        new AlertDialog.Builder(this)
                .setMessage(p.message)
                .setView(input)
                .setPositiveButton("OK", (d, w) -> res.complete(p.confirm(input.getText().toString())))
                .setNegativeButton("Abbrechen", (d, w) -> res.complete(p.dismiss()))
                .setOnCancelListener(d -> res.complete(p.dismiss()))
                .show();
        return res;
    }

    @Override
    public GeckoResult<GeckoSession.PromptDelegate.PromptResponse> onFilePrompt(GeckoSession s, GeckoSession.PromptDelegate.FilePrompt p) {
        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        List<String> mimes = new ArrayList<>();
        if (p.mimeTypes != null) for (String m : p.mimeTypes) if (m != null && m.contains("/")) mimes.add(m);
        if (!mimes.isEmpty()) i.putExtra(Intent.EXTRA_MIME_TYPES, mimes.toArray(new String[0]));
        if (p.type == GeckoSession.PromptDelegate.FilePrompt.Type.MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        pendingFile = new GeckoResult<>();
        pendingFilePrompt = p;
        try {
            startActivityForResult(Intent.createChooser(i, "Datei wählen"), REQ_FILE);
        } catch (Exception e) {
            pendingFile.complete(p.dismiss());
        }
        return pendingFile;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_FILE || pendingFile == null) return;
        GeckoResult<GeckoSession.PromptDelegate.PromptResponse> res = pendingFile;
        GeckoSession.PromptDelegate.FilePrompt prompt = pendingFilePrompt;
        pendingFile = null;
        pendingFilePrompt = null;
        if (resultCode != RESULT_OK || data == null) { res.complete(prompt.dismiss()); return; }
        List<Uri> uris = new ArrayList<>();
        ClipData clip = data.getClipData();
        if (clip != null) {
            for (int k = 0; k < clip.getItemCount(); k++) uris.add(clip.getItemAt(k).getUri());
        } else if (data.getData() != null) {
            uris.add(data.getData());
        }
        if (uris.isEmpty()) { res.complete(prompt.dismiss()); return; }
        res.complete(prompt.confirm(this, uris.toArray(new Uri[0])));
    }
}
