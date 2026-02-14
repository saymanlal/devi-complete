package com.devi;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;

public class MonitorService extends Service {

    private static final String CHANNEL = "DEVI";
    private CallObserver observer;
    private HandlerThread thread;

    @Override
    public void onCreate() {
        super.onCreate();
        
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL, "DEVI Service", NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager mgr = getSystemService(NotificationManager.class);
            mgr.createNotificationChannel(channel);

            Notification.Builder builder = new Notification.Builder(this, CHANNEL)
                .setContentTitle("DEVI Active")
                .setContentText("Monitoring")
                .setSmallIcon(android.R.drawable.ic_menu_call);
            
            startForeground(1, builder.build());
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (thread == null) {
            thread = new HandlerThread("Observer");
            thread.start();
            observer = new CallObserver(new Handler(thread.getLooper()), this);
            getContentResolver().registerContentObserver(
                android.provider.CallLog.Calls.CONTENT_URI,
                true,
                observer
            );
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (observer != null) {
            getContentResolver().unregisterContentObserver(observer);
        }
        if (thread != null) {
            thread.quitSafely();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}