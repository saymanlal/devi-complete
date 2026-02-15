package com.devi;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.database.ContentObserver;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.provider.CallLog;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class CallObserver extends ContentObserver {

    private final Context ctx;
    private String lastNum = "";
    private long lastDate = 0;
    private int notifId = 2000;
    private long wakeStartTime = 0;
    private static final String BACKEND = "https://devi-missed-call-ai.onrender.com";

    public CallObserver(Handler h, Context c) {
        super(h);
        this.ctx = c;
        createChannels();
        MainActivity.writeLog("CallObserver initialized");
        // Wake Render on app start so it's warm immediately
        wakeBackend("app start");
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager mgr = ctx.getSystemService(NotificationManager.class);
            NotificationChannel alert = new NotificationChannel(
                "DEVI_ALERT", "Call Alerts", NotificationManager.IMPORTANCE_HIGH);
            alert.enableVibration(true);
            alert.setShowBadge(true);
            NotificationChannel info = new NotificationChannel(
                "DEVI_INFO", "Call Info", NotificationManager.IMPORTANCE_DEFAULT);
            mgr.createNotificationChannel(alert);
            mgr.createNotificationChannel(info);
            MainActivity.writeLog("Notification channels created");
        }
    }

    // Silent fire-and-forget ping — wakes Render, logs result only
    private void wakeBackend(final String reason) {
        wakeStartTime = System.currentTimeMillis();
        new Thread(new Runnable() {
            public void run() {
                try {
                    URL url = new URL(BACKEND + "/health");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("GET");
                    conn.setConnectTimeout(90000);
                    conn.setReadTimeout(90000);
                    int code = conn.getResponseCode();
                    long ms = System.currentTimeMillis() - wakeStartTime;
                    MainActivity.writeLog("Backend ready (" + reason + ") in " + ms + "ms");
                    conn.disconnect();
                } catch (Exception e) {
                    MainActivity.writeLog("Backend wake failed: " + e.getMessage());
                }
            }
        }).start();
    }

    @Override
    public void onChange(boolean self) {
        super.onChange(self);
        MainActivity.writeLog("Call log changed");
        check();
    }

    private void check() {
        Cursor c = null;
        try {
            Uri uri = CallLog.Calls.CONTENT_URI.buildUpon()
                .appendQueryParameter("limit", "1")
                .build();

            c = ctx.getContentResolver().query(
                uri,
                new String[]{CallLog.Calls.NUMBER, CallLog.Calls.DATE, CallLog.Calls.TYPE, CallLog.Calls.DURATION},
                null,
                null,
                CallLog.Calls.DATE + " DESC"
            );

            if (c != null && c.moveToFirst()) {
                String num  = c.getString(0);
                long   date = c.getLong(1);
                int    type = c.getInt(2);
                long   age  = (System.currentTimeMillis() - date) / 1000;

                String typeStr = type == 1 ? "INCOMING" : type == 2 ? "OUTGOING" : type == 3 ? "MISSED" : "UNKNOWN";
                MainActivity.writeLog(typeStr + ": " + num + " (" + age + "s ago)");

                // Wake Render the moment an INCOMING call appears (phone is still ringing)
                // By the time you don't answer and it becomes MISSED, backend is already warm
                if (type == 1) {
                    MainActivity.writeLog("Incoming detected — waking backend now");
                    wakeBackend("incoming call");
                }

                if (type == 3) {
                    if (num.equals(lastNum) && date == lastDate) {
                        MainActivity.writeLog("Duplicate — ignoring");
                        return;
                    }
                    if (age > 30) {
                        MainActivity.writeLog("Too old (" + age + "s) — ignoring");
                        return;
                    }

                    lastNum  = num;
                    lastDate = date;

                    String fmt = num.replaceAll("[\\s\\-()]", "");
                    if (!fmt.startsWith("+") && fmt.length() == 10 && fmt.matches("^[6-9].*")) {
                        fmt = "+91" + fmt;
                    }
                    final String finalNum = fmt;

                    MainActivity.writeLog("Missed call: " + finalNum + " — sending to DEVI");
                    showNotif("Missed: " + finalNum, "DEVI connecting...", true);
                    send(finalNum, date);
                }
            }
        } catch (Exception e) {
            MainActivity.writeLog("Check ERROR: " + e.toString());
        } finally {
            if (c != null) c.close();
        }
    }

    private void send(final String num, final long time) {
        final long sendStart = System.currentTimeMillis();
        MainActivity.writeLog("Connecting to backend...");

        new Thread(new Runnable() {
            public void run() {
                int maxAttempts = 3;
                for (int attempt = 1; attempt <= maxAttempts; attempt++) {
                    try {
                        URL url = new URL(BACKEND + "/webhook/missed-call");
                        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                        conn.setRequestMethod("POST");
                        conn.setRequestProperty("Content-Type", "application/json");
                        conn.setDoOutput(true);
                        conn.setConnectTimeout(90000); // 90s — enough for Render cold start
                        conn.setReadTimeout(90000);

                        String json = "{\"caller\":\"" + num + "\",\"timestamp\":" + time + "}";
                        OutputStream os = conn.getOutputStream();
                        os.write(json.getBytes("UTF-8"));
                        os.close();

                        int code = conn.getResponseCode();
                        conn.disconnect();
                        long elapsed = (System.currentTimeMillis() - sendStart) / 1000;

                        if (code == 200) {
                            MainActivity.writeLog("DEVI calling " + num + " — took " + elapsed + "s");
                            showNotif("DEVI calling " + num, "Connected in " + elapsed + "s", true);
                            return; // success — stop
                        } else {
                            MainActivity.writeLog("Attempt " + attempt + ": HTTP " + code + " — retrying");
                        }

                    } catch (Exception e) {
                        long elapsed = (System.currentTimeMillis() - sendStart) / 1000;
                        MainActivity.writeLog("Attempt " + attempt + " (" + elapsed + "s): " + e.getMessage());
                        if (attempt < maxAttempts) {
                            try { Thread.sleep(2000); } catch (Exception ignored) {}
                            MainActivity.writeLog("Retrying " + (attempt + 1) + "/" + maxAttempts + "...");
                        }
                    }
                }
                // All 3 failed — log quietly, no scary notification
                long elapsed = (System.currentTimeMillis() - sendStart) / 1000;
                MainActivity.writeLog("Backend unreachable after " + elapsed + "s — check Render dashboard");
            }
        }).start();
    }

    private void showNotif(String title, String text, boolean isAlert) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                String channel = isAlert ? "DEVI_ALERT" : "DEVI_INFO";
                Notification n = new Notification.Builder(ctx, channel)
                    .setContentTitle(title)
                    .setContentText(text)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setAutoCancel(true)
                    .setShowWhen(true)
                    .build();
                ctx.getSystemService(NotificationManager.class).notify(notifId++, n);
            }
        } catch (Exception e) {
            MainActivity.writeLog("Notif ERROR: " + e.toString());
        }
    }
}