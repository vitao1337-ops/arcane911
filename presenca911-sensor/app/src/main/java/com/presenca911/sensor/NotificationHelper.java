package com.presenca911.sensor;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

final class NotificationHelper {
    private static final String ALERT_CHANNEL_ID = "presence_alerts";
    private static final String CAPTURE_CHANNEL_ID = "capture_status";
    static final int CAPTURE_NOTIFICATION_ID = 912;

    private NotificationHelper() {}

    static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel alertChannel = new NotificationChannel(
                ALERT_CHANNEL_ID,
                "Alertas de presença",
                NotificationManager.IMPORTANCE_HIGH
        );
        alertChannel.setDescription("Avisa quando o indicador online aparece no chat consentido.");
        alertChannel.enableVibration(true);

        NotificationChannel captureChannel = new NotificationChannel(
                CAPTURE_CHANNEL_ID,
                "Leitura consentida ativa",
                NotificationManager.IMPORTANCE_LOW
        );
        captureChannel.setDescription("Mostra quando o cabeçalho do WhatsApp está sendo analisado no aparelho.");
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.createNotificationChannel(alertChannel);
        manager.createNotificationChannel(captureChannel);
    }

    static android.app.Notification createCaptureNotification(Context context) {
        createChannel(context);

        Intent openApp = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openIntent = PendingIntent.getActivity(
                context,
                912,
                openApp,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent stopService = new Intent(context, ScreenCaptureService.class)
                .setAction(ScreenCaptureService.ACTION_STOP);
        PendingIntent stopIntent = PendingIntent.getService(
                context,
                913,
                stopService,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new android.app.Notification.Builder(context, CAPTURE_CHANNEL_ID)
                .setSmallIcon(com.presenca911.sensor.R.drawable.ic_presence)
                .setContentTitle("Presença 911 ativo")
                .setContentText("Analisando somente o cabeçalho compartilhado.")
                .setContentIntent(openIntent)
                .addAction(0, "PARAR", stopIntent)
                .setCategory(android.app.Notification.CATEGORY_SERVICE)
                .setOngoing(true)
                .build();
    }

    static void showOnlineAlert(Context context, String contactName) {
        if (Build.VERSION.SDK_INT >= 33
                && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        createChannel(context);
        Intent openApp = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                911,
                openApp,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        android.app.Notification notification =
                new android.app.Notification.Builder(context, ALERT_CHANNEL_ID)
                        .setSmallIcon(com.presenca911.sensor.R.drawable.ic_presence)
                        .setContentTitle(contactName + " está online")
                        .setContentText("O indicador apareceu no chat monitorado.")
                        .setAutoCancel(true)
                        .setContentIntent(pendingIntent)
                        .setCategory(android.app.Notification.CATEGORY_STATUS)
                        .build();

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.notify(contactName.hashCode(), notification);
    }
}
