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



public class Application extends android.app.Application {
    /** 앱이 꺼질 때 오류 내용을 저장할 파일. 다음 실행 때 LauncherActivity 가 화면에 보여 준다. */
    static final String CRASH_FILE = "crash.txt";

    @Override
    public void onCreate() {
        super.onCreate();
        final Thread.UncaughtExceptionHandler prev = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try {
                java.io.StringWriter sw = new java.io.StringWriter();
                java.io.PrintWriter pw = new java.io.PrintWriter(sw);
                pw.println("앱 " + versionOf(getPackageName()) + " / Chrome " + versionOf("com.android.chrome")
                        + " / Android " + android.os.Build.VERSION.RELEASE + " (API " + android.os.Build.VERSION.SDK_INT + ")"
                        + " / " + android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL);
                pw.println("스레드: " + thread.getName());
                error.printStackTrace(pw);
                pw.flush();
                java.io.FileOutputStream out = new java.io.FileOutputStream(new java.io.File(getFilesDir(), CRASH_FILE));
                out.write(sw.toString().getBytes("UTF-8"));
                out.close();
            } catch (Throwable ignored) {
            }
            if (prev != null) prev.uncaughtException(thread, error);
        });
    }

    private String versionOf(String pkg) {
        try {
            return getPackageManager().getPackageInfo(pkg, 0).versionName;
        } catch (Throwable e) {
            return "?";
        }
    }
}
