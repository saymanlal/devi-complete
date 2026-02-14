package com.deviassistant;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "DEVIBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Log.d(TAG, "Boot completed");
            
            try {
                SharedPreferences prefs = context.getSharedPreferences("DEVIPrefs", Context.MODE_PRIVATE);
                boolean serviceEnabled = prefs.getBoolean("service_enabled", false);
                
                if (serviceEnabled) {
                    Log.d(TAG, "Restarting DEVI service");
                    Intent serviceIntent = new Intent(context, CallMonitorService.class);
                    
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent);
                    } else {
                        context.startService(serviceIntent);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error starting service after boot", e);
            }
        }
    }
}