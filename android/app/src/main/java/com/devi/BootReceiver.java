package com.devi;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            try {
                SharedPreferences prefs = context.getSharedPreferences("DEVI", Context.MODE_PRIVATE);
                boolean enabled = prefs.getBoolean("enabled", false);
                
                if (enabled) {
                    Intent serviceIntent = new Intent(context, MonitorService.class);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent);
                    } else {
                        context.startService(serviceIntent);
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
