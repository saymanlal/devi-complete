package com.devi;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileWriter;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity {

    private static File logFile;
    // NEW: in-memory buffer so logs show instantly with no file read delay
    private static final ArrayList<String> logBuffer = new ArrayList<>();
    private TextView status;
    private Button toggle;
    private Button viewLogs;
    private SharedPreferences prefs;
    // NEW: for real-time refresh
    private Handler logHandler;
    private Runnable logRefresher;
    private TextView liveLogView;
    private ScrollView liveScroll;
    private boolean logDialogOpen = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.main);

        try {
            logFile = new File(getExternalFilesDir(null), "devi.log");
            writeLog("=== APP STARTED ===");
        } catch (Exception e) {
            Log.e("DEVI", "Log file error", e);
        }

        prefs = getSharedPreferences("DEVI", MODE_PRIVATE);
        status = findViewById(R.id.status);
        toggle = findViewById(R.id.toggle);
        viewLogs = findViewById(R.id.viewLogs);
        logHandler = new Handler(getMainLooper());

        viewLogs.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                showLogsDialog();
            }
        });

        if (!hasPerms()) {
            reqPerms();
        } else {
            reqBatt();
            init();
        }
    }

    public static void writeLog(String msg) {
        try {
            String time = new SimpleDateFormat("HH:mm:ss", Locale.US).format(new Date());
            String line = time + " " + msg;
            Log.d("DEVI", msg);
            // Write to in-memory buffer instantly (no file read delay)
            synchronized (logBuffer) {
                logBuffer.add(line);
                if (logBuffer.size() > 300) logBuffer.remove(0);
            }
            // Also persist to file
            if (logFile != null) {
                FileWriter w = new FileWriter(logFile, true);
                w.write(line + "\n");
                w.close();
            }
        } catch (Exception e) {}
    }

    private void showLogsDialog() {
        liveScroll = new ScrollView(this);
        liveLogView = new TextView(this);
        liveLogView.setTextSize(10);
        liveLogView.setTextColor(0xFF00FF00);
        liveLogView.setBackgroundColor(0xFF000000);
        liveLogView.setPadding(20, 20, 20, 20);
        liveLogView.setTypeface(android.graphics.Typeface.MONOSPACE);
        liveScroll.addView(liveLogView);

        logDialogOpen = true;
        refreshLogView();

        // Refresh every 1 second while dialog is open
        logRefresher = new Runnable() {
            public void run() {
                if (logDialogOpen) {
                    refreshLogView();
                    logHandler.postDelayed(this, 1000);
                }
            }
        };
        logHandler.postDelayed(logRefresher, 1000);

        new AlertDialog.Builder(this)
            .setTitle("Activity Log (Live)")
            .setView(liveScroll)
            .setPositiveButton("Close", (d, w) -> {
                logDialogOpen = false;
                logHandler.removeCallbacks(logRefresher);
            })
            .setNeutralButton("Clear", (d, w) -> {
                synchronized (logBuffer) { logBuffer.clear(); }
                try {
                    if (logFile != null) new FileWriter(logFile, false).close();
                } catch (Exception e) {}
                writeLog("Log cleared");
                refreshLogView();
            })
            .setOnDismissListener(d -> {
                logDialogOpen = false;
                logHandler.removeCallbacks(logRefresher);
            })
            .show();
    }

    private void refreshLogView() {
        if (liveLogView == null) return;
        StringBuilder sb = new StringBuilder();
        synchronized (logBuffer) {
            for (String line : logBuffer) sb.append(line).append("\n");
        }
        liveLogView.setText(sb.toString());
        if (liveScroll != null) {
            liveScroll.post(new Runnable() {
                public void run() { liveScroll.fullScroll(ScrollView.FOCUS_DOWN); }
            });
        }
    }

    private boolean hasPerms() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        boolean call = checkSelfPermission(Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED;
        boolean phone = checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED;
        boolean notif = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        writeLog("Perms: call=" + call + " phone=" + phone + " notif=" + notif);
        return call && phone && notif;
    }

    private void reqPerms() {
        writeLog("Requesting permissions");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissions(new String[]{
                Manifest.permission.READ_CALL_LOG,
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.POST_NOTIFICATIONS
            }, 100);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            requestPermissions(new String[]{
                Manifest.permission.READ_CALL_LOG,
                Manifest.permission.READ_PHONE_STATE
            }, 100);
        }
    }

    @Override
    public void onRequestPermissionsResult(int r, String[] p, int[] res) {
        super.onRequestPermissionsResult(r, p, res);
        if (hasPerms()) {
            writeLog("Permissions granted");
            reqBatt();
            init();
        } else {
            writeLog("Permissions DENIED");
            Toast.makeText(this, "Need all permissions!", Toast.LENGTH_LONG).show();
        }
    }

    private void reqBatt() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                    writeLog("Requesting battery exemption");
                    Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    i.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(i);
                } else {
                    writeLog("Battery: Unrestricted OK");
                }
            } catch (Exception e) {
                writeLog("Battery error");
            }
        }
    }

    private void init() {
        boolean run = prefs.getBoolean("run", false);
        updateUI(run);
        toggle.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                boolean r = prefs.getBoolean("run", false);
                if (r) stop(); else start();
            }
        });
        if (!prefs.contains("first")) {
            prefs.edit().putBoolean("first", true).apply();
            start();
        }
    }

    private void start() {
        try {
            writeLog("Starting service...");
            prefs.edit().putBoolean("run", true).apply();
            Intent i = new Intent(this, MonitorService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(i);
            } else {
                startService(i);
            }
            updateUI(true);
            Toast.makeText(this, "STARTED", Toast.LENGTH_SHORT).show();
            writeLog("Service started successfully");
        } catch (Exception e) {
            writeLog("Start ERROR: " + e.toString());
            Toast.makeText(this, "Start failed!", Toast.LENGTH_SHORT).show();
        }
    }

    private void stop() {
        try {
            writeLog("Stopping service...");
            prefs.edit().putBoolean("run", false).apply();
            stopService(new Intent(this, MonitorService.class));
            updateUI(false);
            Toast.makeText(this, "STOPPED", Toast.LENGTH_SHORT).show();
            writeLog("Service stopped");
        } catch (Exception e) {
            writeLog("Stop ERROR: " + e.toString());
        }
    }

    private void updateUI(boolean run) {
        status.setText(run ? "✅ RUNNING" : "⭕ STOPPED");
        status.setTextColor(run ? 0xFF4CAF50 : 0xFFFF5252);
        toggle.setText(run ? "STOP" : "START");
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateUI(prefs.getBoolean("run", false));
    }

    @Override
    protected void onDestroy() {
        logDialogOpen = false;
        if (logHandler != null && logRefresher != null) logHandler.removeCallbacks(logRefresher);
        super.onDestroy();
    }
}