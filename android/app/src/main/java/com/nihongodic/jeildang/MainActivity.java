package com.nihongodic.jeildang;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;

import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.webkit.WebViewAssetLoader;

import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.MobileAds;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 제1당 앱 화면 하나.
 * - 게임 파일은 앱 안 assets/site/ 에 있고, https://appassets.androidplatform.net/ 주소로 WebView 에 띄운다
 *   (사이트와 같은 경로: /jeildang/, /shared/nav.js …). 그 밖의 주소는 휴대폰 브라우저로 연다.
 * - 페이지에는 window.JDAndroid 를 연다: showBanner(보일지), hasGoogle(), googleSignIn(), version()
 *   게임(index.html·nav.js·account.js)은 이걸 보고 앱 모드(메뉴 없음, 체험판 제한 없음)로 돈다.
 * - 광고: AdMob 하단 배너. 게임 화면에서만 보인다. 유럽 등은 Google UMP 동의 창을 먼저 띄운다.
 */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String HOME = "https://" + HOST + "/jeildang/";
    static final String SITE = "https://nihongodic.com";

    private WebView web;
    private FrameLayout adBox;
    private AdView adView;
    private ConsentInformation consent;
    private final AtomicBoolean adsReady = new AtomicBoolean(false);
    private boolean wantBanner = false;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#121A33"));
        web = new WebView(this);
        root.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        adBox = new FrameLayout(this);
        adBox.setBackgroundColor(Color.parseColor("#121A33"));
        adBox.setVisibility(View.GONE);
        root.addView(adBox, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        // 안드로이드 15부터 화면이 상태바 밑까지 그려지므로 그만큼 띄운다
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int t, b, l, r;
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                t = i.top; b = i.bottom; l = i.left; r = i.right;
            } else {
                t = insets.getSystemWindowInsetTop(); b = insets.getSystemWindowInsetBottom();
                l = insets.getSystemWindowInsetLeft(); r = insets.getSystemWindowInsetRight();
            }
            v.setPadding(l, t, r, b);
            return insets;
        });
        setContentView(root);

        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/", path -> {
                    String p = resolve(path);
                    if (p == null) return null;
                    try {
                        InputStream in = getAssets().open("site/" + p);
                        return new WebResourceResponse(mime(p), "utf-8", in);
                    } catch (IOException e) {
                        return null;
                    }
                })
                .build();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setTextZoom(100);
        web.setBackgroundColor(Color.parseColor("#121A33"));
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost()) && resolve(u.getPath() == null ? "/" : u.getPath().substring(1)) != null) return false;
                // 앱 안에 없는 사이트 주소(마이페이지 등)와 바깥 주소는 브라우저로
                Uri out = HOST.equals(u.getHost()) ? Uri.parse(SITE + u.getPath() + (u.getQuery() == null ? "" : "?" + u.getQuery())) : u;
                try { startActivity(new Intent(Intent.ACTION_VIEW, out)); } catch (Exception ignored) {}
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "JDAndroid");
        if (saved != null) web.restoreState(saved);
        else web.loadUrl(HOME);

        startAds();
    }

    /** 경로("jeildang/", "privacy") → assets/site 안 파일 이름. 없으면 null */
    private String resolve(String path) {
        String p = path == null ? "" : path;
        if (p.startsWith("/")) p = p.substring(1);
        String[] tries = p.isEmpty() || p.endsWith("/") ? new String[]{p + "index.html"} : new String[]{p, p + ".html", p + "/index.html"};
        for (String t : tries) {
            try { getAssets().open("site/" + t).close(); return t; } catch (IOException ignored) {}
        }
        return null;
    }

    private static String mime(String p) {
        String e = p.substring(p.lastIndexOf('.') + 1).toLowerCase();
        switch (e) {
            case "html": return "text/html";
            case "js": case "mjs": return "text/javascript";
            case "css": return "text/css";
            case "json": return "application/json";
            case "png": return "image/png";
            case "jpg": case "jpeg": return "image/jpeg";
            case "webp": return "image/webp";
            case "svg": return "image/svg+xml";
            case "mp3": return "audio/mpeg";
            case "txt": return "text/plain";
            default: return "application/octet-stream";
        }
    }

    // ── 광고 ──────────────────────────────────────────────
    private void startAds() {
        consent = UserMessagingPlatform.getConsentInformation(this);
        consent.requestConsentInfoUpdate(this, new ConsentRequestParameters.Builder().build(),
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(this, err -> initAds()),
                err -> initAds());
        if (consent.canRequestAds()) initAds();
    }

    private void initAds() {
        if (!consent.canRequestAds() || adsReady.getAndSet(true)) return;
        Executors.newSingleThreadExecutor().execute(() -> {
            MobileAds.initialize(this, st -> {});
            runOnUiThread(this::paintBanner);
        });
    }

    private void paintBanner() {
        boolean show = wantBanner && adsReady.get();
        if (show && adView == null) {
            adView = new AdView(this);
            adView.setAdUnitId(BuildConfig.ADMOB_BANNER_ID);
            DisplayMetrics m = getResources().getDisplayMetrics();
            int wDp = (int) (m.widthPixels / m.density);
            adView.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(this, wDp));
            adBox.addView(adView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER_HORIZONTAL));
            adView.loadAd(new AdRequest.Builder().build());
        }
        adBox.setVisibility(show ? View.VISIBLE : View.GONE);
        if (adView != null) { if (show) adView.resume(); else adView.pause(); }
    }

    // ── Google 로그인 ─────────────────────────────────────
    private void googleSignIn() {
        GetSignInWithGoogleOption opt = new GetSignInWithGoogleOption.Builder(BuildConfig.GOOGLE_WEB_CLIENT_ID).build();
        GetCredentialRequest req = new GetCredentialRequest.Builder().addCredentialOption(opt).build();
        CredentialManager.create(this).getCredentialAsync(this, req, new CancellationSignal(), r -> runOnUiThread(r),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse r) {
                        try {
                            if (r.getCredential() instanceof CustomCredential
                                    && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(r.getCredential().getType())) {
                                String token = GoogleIdTokenCredential.createFrom(r.getCredential().getData()).getIdToken();
                                answerGoogle(token, null);
                                return;
                            }
                        } catch (Exception e) { answerGoogle(null, e.toString()); return; }
                        answerGoogle(null, "unsupported");
                    }

                    @Override
                    public void onError(GetCredentialException e) { answerGoogle(null, e.getType()); }
                });
    }

    private void answerGoogle(String token, String err) {
        String js = "window.__jdGoogle&&window.__jdGoogle(" + JSONObject.quote(token == null ? "" : token) + "," + JSONObject.quote(err == null ? "" : err) + ")";
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    /** 페이지에서 부르는 앱 기능 (window.JDAndroid) */
    class Bridge {
        @JavascriptInterface public void showBanner(boolean on) { runOnUiThread(() -> { wantBanner = on; paintBanner(); }); }
        @JavascriptInterface public boolean hasGoogle() { return !BuildConfig.GOOGLE_WEB_CLIENT_ID.isEmpty(); }
        @JavascriptInterface public void googleSignIn() { if (hasGoogle()) runOnUiThread(MainActivity.this::googleSignIn); else answerGoogle(null, "no-client-id"); }
        @JavascriptInterface public String version() { return BuildConfig.VERSION_NAME; }
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override protected void onPause() { if (adView != null) adView.pause(); web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); if (adView != null && adBox.getVisibility() == View.VISIBLE) adView.resume(); }
    @Override protected void onDestroy() { if (adView != null) adView.destroy(); web.destroy(); super.onDestroy(); }
}
