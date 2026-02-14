package com.devi;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

public class MainActivity extends Activity {

    private TextView statusText;
    private Button toggleButton;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.main);

        prefs = getSharedPreferences("DEVI", MODE_PRIVATE);
        statusText = (TextView) findViewById(R.id.status);
        toggleButton = (Button) findViewById(R.id.toggle);

        updateUI();

        toggleButton.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                boolean enabled = prefs.getBoolean("enabled", false);
                if (enabled) {
                    stop();
                } else {
                    start();
                }
            }
        });

        if (!prefs.contains("first")) {
            prefs.edit().putBoolean("first", true).apply();
            start();
        }
    }

    private void start() {
        prefs.edit().putBoolean("enabled", true).apply();
        Intent intent = new Intent(this, MonitorService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
        updateUI();
    }

    private void stop() {
        prefs.edit().putBoolean("enabled", false).apply();
        stopService(new Intent(this, MonitorService.class));
        updateUI();
    }

    private void updateUI() {
        boolean enabled = prefs.getBoolean("enabled", false);
        statusText.setText(enabled ? "RUNNING" : "STOPPED");
        toggleButton.setText(enabled ? "STOP" : "START");
    }
}
