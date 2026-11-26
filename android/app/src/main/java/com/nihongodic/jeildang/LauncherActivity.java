/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.nihongodic.jeildang;

import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;



public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {

    private java.io.File crashFile() {
        return new java.io.File(getFilesDir(), Application.CRASH_FILE);
    }

    // 지난번에 앱이 꺼졌으면(오류 내용이 저장돼 있으면) 바로 넘어가지 않고 오류 창을 먼저 보여 준다
    @Override
    protected boolean shouldLaunchImmediately() {
        return !crashFile().exists();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 화면 방향은 지정하지 않는다(기본값 '자동'). 투명 배경 화면에서 방향을 지정하면
        // 안드로이드 8.0(Oreo)에서 앱이 바로 꺼진다(갤럭시 S9 등). Bubblewrap 템플릿이 두 경우 모두
        // 방향을 지정하도록 만들어져 있어 지웠다. https://github.com/GoogleChromeLabs/bubblewrap/issues/496
        if (!isFinishing() && crashFile().exists()) showCrash();
    }

    private void showCrash() {
        String text;
        try {
            java.io.File f = crashFile();
            byte[] b = new byte[(int) f.length()];
            java.io.FileInputStream in = new java.io.FileInputStream(f);
            int n = in.read(b);
            in.close();
            text = new String(b, 0, Math.max(n, 0), "UTF-8");
        } catch (Throwable e) {
            text = "오류 내용을 읽지 못했습니다: " + e;
        }
        final String report = text;
        android.widget.TextView view = new android.widget.TextView(this);
        view.setText(report);
        view.setTextIsSelectable(true);
        view.setTextSize(11);
        int pad = (int) (16 * getResources().getDisplayMetrics().density);
        view.setPadding(pad, pad, pad, pad);
        android.widget.ScrollView scroll = new android.widget.ScrollView(this);
        scroll.addView(view);
        new android.app.AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Light_Dialog_Alert)
                .setTitle("지난번에 앱이 꺼진 이유")
                .setView(scroll)
                .setCancelable(false)
                .setPositiveButton("복사하고 계속", (d, w) -> {
                    android.content.ClipboardManager cm = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                    if (cm != null) cm.setPrimaryClip(android.content.ClipData.newPlainText("제1당 오류", report));
                    android.widget.Toast.makeText(this, "복사했습니다. 카톡 등에 붙여 보내 주세요.", android.widget.Toast.LENGTH_LONG).show();
                    crashFile().delete();
                    launchTwa();
                })
                .setNegativeButton("계속", (d, w) -> {
                    crashFile().delete();
                    launchTwa();
                })
                .show();
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Get the original launch Url.
        Uri uri = super.getLaunchingUrl();
        return uri;
    }
}
