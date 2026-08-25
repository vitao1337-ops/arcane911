package com.presenca911.sensor;

import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.DisplayMetrics;
import android.view.WindowManager;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.nio.ByteBuffer;
import java.text.Normalizer;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ScreenCaptureService extends Service {
    static final String ACTION_START = "com.presenca911.sensor.START_CAPTURE";
    static final String ACTION_STOP = "com.presenca911.sensor.STOP_CAPTURE";
    static final String EXTRA_RESULT_CODE = "result_code";
    static final String EXTRA_RESULT_DATA = "result_data";

    private static final String LAST_STATE_KEY = "last_state";
    private static final long SCAN_INTERVAL_MS = 1_250;
    private static final long HEARTBEAT_INTERVAL_MS = 15_000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();

    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private TextRecognizer recognizer;
    private boolean processing;
    private boolean stopping;
    private boolean receiverRegistered;

    private final MediaProjection.Callback projectionCallback = new MediaProjection.Callback() {
        @Override
        public void onStop() {
            if (stopping) return;
            PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
            boolean screenOn = powerManager == null || powerManager.isInteractive();
            sendState(screenOn ? "waiting" : "screen_off");
            setCaptureActive(false);
            releaseCapture(false);
            stopForeground(true);
            stopSelf();
        }
    };

    private final Runnable scanRunnable = new Runnable() {
        @Override
        public void run() {
            scanHeader();
        }
    };

    private final Runnable heartbeatRunnable = new Runnable() {
        @Override
        public void run() {
            if (ApiClient.hasConfiguration(ScreenCaptureService.this)) {
                networkExecutor.execute(() ->
                        ApiClient.postState(ScreenCaptureService.this, "heartbeat")
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
                sendState("waiting");
                handler.removeCallbacks(scanRunnable);
                handler.postDelayed(scanRunnable, 800);
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationHelper.createChannel(this);
        recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        registerScreenReceiver();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        if (ACTION_STOP.equals(intent.getAction())) {
            stopCaptureAndSelf();
            return START_NOT_STICKY;
        }

        if (!ACTION_START.equals(intent.getAction()) || mediaProjection != null) {
            return START_NOT_STICKY;
        }

        startForeground(
                NotificationHelper.CAPTURE_NOTIFICATION_ID,
                NotificationHelper.createCaptureNotification(this)
        );

        int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0);
        Intent resultData;
        if (Build.VERSION.SDK_INT >= 33) {
            resultData = intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent.class);
        } else {
            resultData = intent.getParcelableExtra(EXTRA_RESULT_DATA);
        }

        if (resultCode == 0 || resultData == null || !ApiClient.hasConfiguration(this)) {
            stopCaptureAndSelf();
            return START_NOT_STICKY;
        }

        try {
            MediaProjectionManager manager =
                    (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
            mediaProjection = manager.getMediaProjection(resultCode, resultData);
            if (mediaProjection == null) {
                stopCaptureAndSelf();
                return START_NOT_STICKY;
            }

            mediaProjection.registerCallback(projectionCallback, handler);
            createVirtualDisplay();
            setCaptureActive(true);
            sendState("waiting");
            handler.postDelayed(scanRunnable, 900);
            handler.post(heartbeatRunnable);
        } catch (RuntimeException exception) {
            stopCaptureAndSelf();
        }

        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        setCaptureActive(false);

        if (!stopping) {
            stopping = true;
            releaseCapture(true);
        }

        if (receiverRegistered) {
            try {
                unregisterReceiver(screenReceiver);
            } catch (IllegalArgumentException ignored) {
                // O Android já removeu o receptor.
            }
        }

        if (recognizer != null) recognizer.close();
        networkExecutor.shutdown();
        super.onDestroy();
    }

    private void createVirtualDisplay() {
        WindowManager windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        int width;
        int height;

        if (Build.VERSION.SDK_INT >= 30) {
            Rect bounds = windowManager.getMaximumWindowMetrics().getBounds();
            width = bounds.width();
            height = bounds.height();
        } else {
            DisplayMetrics metrics = new DisplayMetrics();
            windowManager.getDefaultDisplay().getRealMetrics(metrics);
            width = metrics.widthPixels;
            height = metrics.heightPixels;
        }

        int densityDpi = getResources().getDisplayMetrics().densityDpi;
        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2);
        virtualDisplay = mediaProjection.createVirtualDisplay(
                "Presenca911Header",
                width,
                height,
                densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader.getSurface(),
                null,
                handler
        );
    }

    private void scanHeader() {
        if (stopping || imageReader == null) return;

        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager != null && !powerManager.isInteractive()) {
            sendState("screen_off");
            scheduleNextScan();
            return;
        }

        if (processing) {
            scheduleNextScan();
            return;
        }

        Image image = imageReader.acquireLatestImage();
        if (image == null) {
            handler.postDelayed(scanRunnable, 350);
            return;
        }

        Bitmap headerBitmap;
        try {
            headerBitmap = imageToHeaderBitmap(image);
        } catch (RuntimeException exception) {
            headerBitmap = null;
        } finally {
            image.close();
        }

        if (headerBitmap == null) {
            sendState("waiting");
            scheduleNextScan();
            return;
        }

        processing = true;
        Bitmap bitmapForOcr = headerBitmap;
        recognizer.process(InputImage.fromBitmap(bitmapForOcr, 0))
                .addOnSuccessListener(this::handleRecognizedText)
                .addOnFailureListener(exception -> sendState("waiting"))
                .addOnCompleteListener(task -> {
                    bitmapForOcr.recycle();
                    processing = false;
                    scheduleNextScan();
                });
    }

    private Bitmap imageToHeaderBitmap(Image image) {
        Image.Plane plane = image.getPlanes()[0];
        ByteBuffer buffer = plane.getBuffer();
        int pixelStride = plane.getPixelStride();
        int rowStride = plane.getRowStride();
        int rowPadding = rowStride - pixelStride * image.getWidth();
        int paddedWidth = image.getWidth() + Math.max(0, rowPadding / pixelStride);

        Bitmap padded = Bitmap.createBitmap(
                paddedWidth,
                image.getHeight(),
                Bitmap.Config.ARGB_8888
        );
        buffer.rewind();
        padded.copyPixelsFromBuffer(buffer);

        int cropHeight = Math.min(image.getHeight(), dp(160));
        Bitmap header = Bitmap.createBitmap(padded, 0, 0, image.getWidth(), cropHeight);
        padded.recycle();
        return header;
    }

    private void handleRecognizedText(Text result) {
        SharedPreferences preferences = getSharedPreferences(ApiClient.PREFS, MODE_PRIVATE);
        String targetName = normalize(preferences.getString(ApiClient.KEY_CONTACT_NAME, ""));
        if (targetName.isEmpty()) {
            sendState("waiting");
            return;
        }

        boolean targetVisible = false;
        boolean onlineVisible = false;
        for (Text.TextBlock block : result.getTextBlocks()) {
            for (Text.Line line : block.getLines()) {
                String value = normalize(line.getText());
                if (value.equals(targetName)) targetVisible = true;
                if (value.equals("online")) onlineVisible = true;
            }
        }

        if (!targetVisible) {
            sendState("waiting");
        } else {
            sendState(onlineVisible ? "online" : "offline");
        }
    }

    private void scheduleNextScan() {
        if (stopping) return;
        handler.removeCallbacks(scanRunnable);
        handler.postDelayed(scanRunnable, SCAN_INTERVAL_MS);
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

    private void stopCaptureAndSelf() {
        if (stopping) return;
        stopping = true;
        sendState("waiting");
        setCaptureActive(false);
        releaseCapture(true);
        stopForeground(true);
        stopSelf();
    }

    private void releaseCapture(boolean stopProjection) {
        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }
        if (imageReader != null) {
            imageReader.close();
            imageReader = null;
        }
        if (stopProjection && mediaProjection != null) {
            mediaProjection.stop();
        }
        mediaProjection = null;
    }

    private void setCaptureActive(boolean active) {
        getSharedPreferences(ApiClient.PREFS, MODE_PRIVATE)
                .edit()
                .putBoolean(ApiClient.KEY_CAPTURE_ACTIVE, active)
                .apply();
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

    private String normalize(String value) {
        String withoutMarks = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return withoutMarks
                .trim()
                .replaceAll("\\s+", " ")
                .toLowerCase(Locale.ROOT);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
