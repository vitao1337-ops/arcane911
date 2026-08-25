package com.presenca911.sensor;

import android.content.Context;
import android.content.SharedPreferences;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class ApiClient {
    static final String PREFS = "presence911";
    static final String KEY_SERVER_URL = "server_url";
    static final String KEY_SENSOR_TOKEN = "sensor_token";
    static final String KEY_CONTACT_NAME = "contact_name";
    static final String KEY_CONSENT = "consent";

    private ApiClient() {}

    static boolean hasConfiguration(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return preferences.getBoolean(KEY_CONSENT, false)
                && !preferences.getString(KEY_SERVER_URL, "").isEmpty()
                && !preferences.getString(KEY_SENSOR_TOKEN, "").isEmpty()
                && !preferences.getString(KEY_CONTACT_NAME, "").isEmpty();
    }

    static boolean postState(Context context, String state) {
        SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!preferences.getBoolean(KEY_CONSENT, false)) return false;

        String baseUrl = preferences.getString(KEY_SERVER_URL, "").trim();
        String sensorToken = preferences.getString(KEY_SENSOR_TOKEN, "").trim();
        if (baseUrl.isEmpty() || sensorToken.isEmpty()) return false;

        HttpURLConnection connection = null;
        try {
            String endpoint = baseUrl.replaceAll("/+$", "") + "/api/presence/ingest";
            connection = (HttpURLConnection) new URL(endpoint).openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(8_000);
            connection.setReadTimeout(8_000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Authorization", "Bearer " + sensorToken);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setRequestProperty("Accept", "application/json");

            byte[] payload = ("{\"state\":\"" + state + "\"}").getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(payload.length);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(payload);
            }

            int responseCode = connection.getResponseCode();
            return responseCode >= 200 && responseCode < 300;
        } catch (Exception ignored) {
            return false;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}
