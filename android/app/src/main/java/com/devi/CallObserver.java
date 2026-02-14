package com.devi;

import android.content.Context;
import android.database.ContentObserver;
import android.database.Cursor;
import android.os.Handler;
import android.provider.CallLog;
import android.util.Log;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class CallObserver extends ContentObserver {

    private static final String TAG = "DEVI";
    private static final String BACKEND = "https://devi-missed-call-ai.onrender.com/webhook/missed-call";
    
    private final Context context;
    private String lastNumber = "";
    private long lastTime = 0;

    public CallObserver(Handler handler, Context context) {
        super(handler);
        this.context = context;
    }

    @Override
    public void onChange(boolean selfChange) {
        super.onChange(selfChange);
        checkMissedCall();
    }

    private void checkMissedCall() {
        Cursor cursor = null;
        try {
            cursor = context.getContentResolver().query(
                CallLog.Calls.CONTENT_URI,
                new String[]{CallLog.Calls.NUMBER, CallLog.Calls.DATE},
                CallLog.Calls.TYPE + " = ?",
                new String[]{String.valueOf(CallLog.Calls.MISSED_TYPE)},
                CallLog.Calls.DATE + " DESC LIMIT 1"
            );

            if (cursor != null && cursor.moveToFirst()) {
                String number = cursor.getString(0);
                long date = cursor.getLong(1);

                if (number.equals(lastNumber) && date == lastTime) {
                    return;
                }

                long diff = System.currentTimeMillis() - date;
                if (diff > 20000) {
                    return;
                }

                lastNumber = number;
                lastTime = date;

                sendToBackend(number, date);
            }

        } catch (Exception e) {
            Log.e(TAG, "Check error", e);
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
    }

    private void sendToBackend(final String number, final long timestamp) {
        new Thread(new Runnable() {
            public void run() {
                try {
                    URL url = new URL(BACKEND);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setDoOutput(true);

                    String json = "{\"caller\":\"" + number + "\",\"timestamp\":" + timestamp + "}";

                    OutputStream os = conn.getOutputStream();
                    os.write(json.getBytes());
                    os.close();

                    int code = conn.getResponseCode();
                    Log.i(TAG, "Backend response: " + code);

                    conn.disconnect();

                } catch (Exception e) {
                    Log.e(TAG, "Backend error", e);
                }
            }
        }).start();
    }
}