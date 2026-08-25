package com.presenca911.sensor;

import android.accessibilityservice.AccessibilityService;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Rect;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PresenceAccessibilityService extends AccessibilityService {
    private static final long EVALUATION_DELAY_MS = 650;
    private static final long HEARTBEAT_INTERVAL_MS = 15_000;
    private static final String LAST_STATE_KEY = "last_state";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private boolean receiverRegistered = false;

    private final Runnable evaluateRunnable = this::evaluateVisibleHeader;
    private final Runnable heartbeatRunnable = new Runnable() {
        @Override
        public void run() {
            if (ApiClient.hasConfiguration(PresenceAccessibilityService.this)) {
                networkExecutor.execute(() ->
                        ApiClient.postState(PresenceAccessibilityService.this, "heartbeat")
                );
            }
            handler.postDelayed(this, HEARTBEAT_INTERVAL_MS);
        }
    };

    private final BroadcastReceiver screenReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) {
                sendState("screen_off");
            } else if (Intent.ACTION_SCREEN_ON.equals(intent.getAction())) {
                sendState("screen_on");
                handler.postDelayed(evaluateRunnable, 1_000);
            }
        }
    };

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        NotificationHelper.createChannel(this);
        registerScreenReceiver();
        handler.removeCallbacks(heartbeatRunnable);
        handler.post(heartbeatRunnable);
        handler.postDelayed(evaluateRunnable, 900);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) return;
        String packageName = event.getPackageName().toString();
        if (!"com.whatsapp".equals(packageName) && !"com.whatsapp.w4b".equals(packageName)) {
            return;
        }

        handler.removeCallbacks(evaluateRunnable);
        handler.postDelayed(evaluateRunnable, EVALUATION_DELAY_MS);
    }

    @Override
    public void onInterrupt() {
        sendState("waiting");
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (receiverRegistered) {
            try {
                unregisterReceiver(screenReceiver);
            } catch (IllegalArgumentException ignored) {
                // O Android já removeu o receptor.
            }
        }
        networkExecutor.shutdownNow();
        super.onDestroy();
    }

    private void evaluateVisibleHeader() {
        if (!ApiClient.hasConfiguration(this)) return;

        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager != null && !powerManager.isInteractive()) {
            sendState("screen_off");
            return;
        }

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null || root.getPackageName() == null) {
            sendState("waiting");
            return;
        }

        String packageName = root.getPackageName().toString();
        if (!"com.whatsapp".equals(packageName) && !"com.whatsapp.w4b".equals(packageName)) {
            sendState("waiting");
            root.recycle();
            return;
        }

        SharedPreferences preferences = getSharedPreferences(ApiClient.PREFS, MODE_PRIVATE);
        String targetName = preferences.getString(ApiClient.KEY_CONTACT_NAME, "").trim();
        if (targetName.isEmpty()) {
            root.recycle();
            return;
        }

        int headerLimit = dp(280);
        boolean targetHeaderVisible = findExactTextInHeader(root, targetName, headerLimit);
        boolean onlineVisible = targetHeaderVisible
                && findExactTextInHeader(root, "online", headerLimit);
        root.recycle();

        if (!targetHeaderVisible) {
            sendState("waiting");
        } else {
            sendState(onlineVisible ? "online" : "offline");
        }
    }

    private boolean findExactTextInHeader(
            AccessibilityNodeInfo root,
            String expected,
            int headerLimit
    ) {
        String normalizedExpected = normalize(expected);
        Deque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(root);
        int visited = 0;

        while (!queue.isEmpty() && visited < 180) {
            AccessibilityNodeInfo node = queue.removeFirst();
            visited += 1;

            Rect bounds = new Rect();
            node.getBoundsInScreen(bounds);
            if (bounds.top >= 0 && bounds.top < headerLimit) {
                CharSequence text = node.getText();
                CharSequence description = node.getContentDescription();
                if ((text != null && normalize(text.toString()).equals(normalizedExpected))
                        || (description != null
                        && normalize(description.toString()).equals(normalizedExpected))) {
                    if (node != root) node.recycle();
                    recycleQueue(queue);
                    return true;
                }
            }

            for (int index = 0; index < node.getChildCount(); index++) {
                AccessibilityNodeInfo child = node.getChild(index);
                if (child != null) queue.addLast(child);
            }
            if (node != root) node.recycle();
        }

        recycleQueue(queue);
        return false;
    }

    private void recycleQueue(Deque<AccessibilityNodeInfo> queue) {
        while (!queue.isEmpty()) {
            AccessibilityNodeInfo node = queue.removeFirst();
            node.recycle();
        }
    }

    private String normalize(String value) {
        return value
                .trim()
                .replaceAll("\\s+", " ")
                .toLowerCase(Locale.ROOT);
    }

    private void sendState(String state) {
        if (!ApiClient.hasConfiguration(this)) return;
        SharedPreferences preferences = getSharedPreferences(ApiClient.PREFS, MODE_PRIVATE);
        String previousState = preferences.getString(LAST_STATE_KEY, "waiting");
        if (state.equals(previousState)) return;

        preferences.edit().putString(LAST_STATE_KEY, state).apply();
        if ("online".equals(state) && !"online".equals(previousState)) {
            String contactName = preferences.getString(ApiClient.KEY_CONTACT_NAME, "Contato");
            NotificationHelper.showOnlineAlert(this, contactName);
        }
        networkExecutor.execute(() -> ApiClient.postState(this, state));
    }

    private void registerScreenReceiver() {
        if (receiverRegistered) return;
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_SCREEN_ON);
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(screenReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(screenReceiver, filter);
        }
        receiverRegistered = true;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
