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

    public CallObserver(Handler h, Context c) {
        super(h);
        this.ctx = c;
        createChannels();
        MainActivity.writeLog("CallObserver initialized");
        showNotif("DEVI Started", "Monitoring all calls", false);
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager mgr = ctx.getSystemService(NotificationManager.class);

            NotificationChannel alert = new NotificationChannel(
                "DEVI_ALERT",
                "Call Alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            alert.setDescription("Missed call alerts");
            alert.enableVibration(true);
            alert.setShowBadge(true);

            NotificationChannel info = new NotificationChannel(
                "DEVI_INFO",
                "Call Info",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            info.setDescription("Call activity");

            mgr.createNotificationChannel(alert);
            mgr.createNotificationChannel(info);

            MainActivity.writeLog("Notification channels created");
        }
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
            // FIX: Use Uri with limit parameter instead of LIMIT in sortOrder string
            // This works correctly on all Android versions including Android 15
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
                String num = c.getString(0);
                long date = c.getLong(1);
                int type = c.getInt(2);

                String typeStr = type == 1 ? "INCOMING" : type == 2 ? "OUTGOING" : type == 3 ? "MISSED" : "UNKNOWN";
                long age = (System.currentTimeMillis() - date) / 1000;

                MainActivity.writeLog(typeStr + " call: " + num + " (" + age + "s ago)");
                showNotif("📞 " + typeStr, num + " - " + age + "s ago", false);

                if (type == 3) {

                    if (num.equals(lastNum) && date == lastDate) {
                        MainActivity.writeLog("Duplicate - ignoring");
                        return;
                    }

                    if (age > 30) {
                        MainActivity.writeLog("Too old - ignoring");
                        return;
                    }

                    lastNum = num;
                    lastDate = date;

                    String fmt = num.replaceAll("[\\s\\-()]", "");
                    if (!fmt.startsWith("+") && fmt.length() == 10 && fmt.matches("^[6-9].*")) {
                        fmt = "+91" + fmt;
                    }

                    final String finalNum = fmt;

                    MainActivity.writeLog("🚨 PROCESSING MISSED: " + finalNum);
                    showNotif("🚨 MISSED CALL!", "From: " + finalNum, true);

                    new Handler(ctx.getMainLooper()).postDelayed(new Runnable() {
                        public void run() {
                            showNotif("📞 Calling back NOW!", finalNum, true);
                        }
                    }, 1000);

                    send(finalNum, date);
                }
            } else {
                MainActivity.writeLog("No calls found");
            }
        } catch (Exception e) {
            MainActivity.writeLog("Check ERROR: " + e.toString());
        } finally {
            if (c != null) c.close();
        }
    }

    private void send(final String num, final long time) {
        MainActivity.writeLog("Sending to backend: " + num);
        showNotif("📡 Connecting", "Sending to server", true);

        new Thread(new Runnable() {
            public void run() {
                try {
                    URL url = new URL("https://devi-missed-call-ai.onrender.com/webhook/missed-call");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setDoOutput(true);
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(15000);

                    String json = "{\"caller\":\"" + num + "\",\"timestamp\":" + time + "}";
                    MainActivity.writeLog("Payload: " + json);

                    OutputStream os = conn.getOutputStream();
                    os.write(json.getBytes());
                    os.close();

                    int code = conn.getResponseCode();
                    MainActivity.writeLog("Backend response: " + code);

                    if (code == 200) {
                        MainActivity.writeLog("✅ SUCCESS!");
                        showNotif("✅ SUCCESS!", "DEVI is calling " + num + " now!", true);
                    } else {
                        MainActivity.writeLog("❌ Backend error: " + code);
                        showNotif("❌ Backend Error", "HTTP " + code, true);
                    }

                    conn.disconnect();

                } catch (Exception e) {
                    MainActivity.writeLog("❌ Connection failed: " + e.toString());
                    showNotif("❌ Connection Failed", e.getMessage(), true);
                }
            }
        }).start();
    }

    private void showNotif(String title, String text, boolean isAlert) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                String channel = isAlert ? "DEVI_ALERT" : "DEVI_INFO";

                Notification.Builder builder = new Notification.Builder(ctx, channel)
                    .setContentTitle(title)
                    .setContentText(text)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setAutoCancel(true)
                    .setShowWhen(true)
                    .setCategory(Notification.CATEGORY_CALL);

                if (isAlert) {
                    builder.setPriority(Notification.PRIORITY_HIGH);
                }

                Notification n = builder.build();

                NotificationManager mgr = ctx.getSystemService(NotificationManager.class);
                mgr.notify(notifId++, n);

                MainActivity.writeLog("Notification: " + title);
            }
        } catch (Exception e) {
            MainActivity.writeLog("Notif ERROR: " + e.toString());
        }
    }
}