package com.devi;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.PowerManager;

public class MonitorService extends Service {

    private CallObserver obs;
    private HandlerThread thread;
    private PowerManager.WakeLock wake;

    @Override
    public void onCreate() {
        super.onCreate();
        MainActivity.writeLog("Service onCreate");
        
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DEVI:Monitor");
            wake.acquire();
            MainActivity.writeLog("WakeLock acquired");
        } catch (Exception e) {
            MainActivity.writeLog("WakeLock error: " + e);
        }
        
        try {
            startForeground(1, makeNotif());
            MainActivity.writeLog("Foreground started");
        } catch (Exception e) {
            MainActivity.writeLog("Foreground error: " + e);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        MainActivity.writeLog("Service onStartCommand");
        
        if (obs == null) {
            try {
                thread = new HandlerThread("DEVI");
                thread.start();
                
                obs = new CallObserver(new Handler(thread.getLooper()), this);
                
                getContentResolver().registerContentObserver(
                    android.provider.CallLog.Calls.CONTENT_URI,
                    true,
                    obs
                );
                
                MainActivity.writeLog("Observer registered");
            } catch (Exception e) {
                MainActivity.writeLog("Observer error: " + e);
            }
        }
        
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        MainActivity.writeLog("Service onDestroy");
        
        if (obs != null) {
            try {
                getContentResolver().unregisterContentObserver(obs);
            } catch (Exception e) {}
        }
        
        if (thread != null) {
            thread.quitSafely();
        }
        
        if (wake != null && wake.isHeld()) {
            wake.release();
        }
        
        super.onDestroy();
    }

    private Notification makeNotif() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager mgr = getSystemService(NotificationManager.class);
            
            // Create channel with HIGH importance for Android 15
            NotificationChannel ch = new NotificationChannel(
                "DEVI", 
                "DEVI Monitor", 
                NotificationManager.IMPORTANCE_HIGH
            );
            ch.setDescription("Call monitoring");
            ch.setSound(null, null); // No sound
            ch.enableVibration(false); // No vibration
            mgr.createNotificationChannel(ch);

            Intent intent = new Intent(this, MainActivity.class);
            PendingIntent pi = PendingIntent.getActivity(
                this, 0, intent, 
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
            );

            return new Notification.Builder(this, "DEVI")
                .setContentTitle("✅ DEVI Active")
                .setContentText("Monitoring calls - Tap to open")
                .setSmallIcon(android.R.drawable.ic_menu_call)
                .setOngoing(true)
                .setContentIntent(pi)
                .setCategory(Notification.CATEGORY_SERVICE)
                .setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
                .build();
        }
        
        return new Notification.Builder(this)
            .setContentTitle("DEVI Active")
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .build();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
