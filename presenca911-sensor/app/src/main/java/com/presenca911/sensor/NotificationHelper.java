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
    private static final String CHANNEL_ID = "presence_alerts";

    private NotificationHelper() {}

    static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Alertas de presença",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Avisa quando o indicador online aparece no chat consentido.");
        channel.enableVibration(true);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.createNotificationChannel(channel);
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
                new android.app.Notification.Builder(context, CHANNEL_ID)
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
