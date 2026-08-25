package com.presenca911.sensor;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int REQUEST_CAPTURE = 912;
    private static final int COLOR_CREAM = Color.rgb(246, 239, 227);
    private static final int COLOR_INK = Color.rgb(33, 26, 36);
    private static final int COLOR_MUTED = Color.rgb(102, 91, 105);
    private static final int COLOR_VIOLET = Color.rgb(124, 58, 237);
    private static final int COLOR_VIOLET_DEEP = Color.rgb(39, 22, 56);
    private static final int COLOR_GOLD = Color.rgb(200, 167, 106);

    private EditText serverInput;
    private EditText tokenInput;
    private EditText contactInput;
    private CheckBox consentCheck;
    private TextView serviceStatus;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        NotificationHelper.createChannel(this);
        requestNotificationPermission();
        setContentView(buildContent());
        loadPreferences();
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateServiceStatus();
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }

    private View buildContent() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setBackgroundColor(COLOR_CREAM);

        LinearLayout root = vertical();
        root.setPadding(dp(22), dp(28), dp(22), dp(38));
        scrollView.addView(root, matchWrap());

        TextView eyebrow = text("MONITOR CONSENTIDO", 12, COLOR_VIOLET);
        eyebrow.setTypeface(Typeface.create("sans-serif-condensed", Typeface.BOLD));
        eyebrow.setLetterSpacing(0.18f);
        root.addView(eyebrow);

        TextView title = text("Sensor\nPresença 911", 43, COLOR_INK);
        title.setTypeface(Typeface.create("serif", Typeface.BOLD));
        title.setLineSpacing(0, 0.88f);
        title.setPadding(0, dp(10), 0, 0);
        root.addView(title);

        TextView intro = text(
                "Com sua autorização visível, este celular recorta a imagem compartilhada e procura somente o nome do contato e o indicador “online” no topo do WhatsApp.",
                15,
                COLOR_MUTED
        );
        intro.setLineSpacing(dp(3), 1f);
        LinearLayout.LayoutParams introParams = matchWrap();
        introParams.setMargins(0, dp(14), 0, dp(24));
        root.addView(intro, introParams);

        LinearLayout card = vertical();
        card.setPadding(dp(18), dp(20), dp(18), dp(20));
        card.setBackground(roundRect(Color.argb(232, 255, 253, 249), COLOR_GOLD, 26));
        root.addView(card, matchWrap());

        TextView cardTitle = text("PAREAMENTO DO SENSOR", 12, COLOR_VIOLET);
        cardTitle.setTypeface(Typeface.create("sans-serif-condensed", Typeface.BOLD));
        cardTitle.setLetterSpacing(0.12f);
        card.addView(cardTitle);

        serverInput = field("Endereço do painel", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        tokenInput = field("Código deste sensor", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        contactInput = field("Nome exato do contato no WhatsApp", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        addLabeledField(card, "ENDEREÇO DO PAINEL", serverInput);
        addLabeledField(card, "CÓDIGO DO CELULAR", tokenInput);
        addLabeledField(card, "CONTATO OBSERVADO", contactInput);

        consentCheck = new CheckBox(this);
        consentCheck.setText("Confirmo que os envolvidos autorizaram esta leitura.");
        consentCheck.setTextColor(COLOR_MUTED);
        consentCheck.setTextSize(13);
        consentCheck.setButtonTintList(android.content.res.ColorStateList.valueOf(COLOR_VIOLET));
        LinearLayout.LayoutParams consentParams = matchWrap();
        consentParams.setMargins(0, dp(14), 0, dp(14));
        card.addView(consentCheck, consentParams);

        Button saveButton = primaryButton("SALVAR E TESTAR CONEXÃO");
        saveButton.setOnClickListener(view -> saveAndTest());
        card.addView(saveButton, matchWrap());

        serviceStatus = text("", 13, COLOR_MUTED);
        serviceStatus.setGravity(Gravity.CENTER);
        serviceStatus.setPadding(dp(12), dp(13), dp(12), dp(13));
        LinearLayout.LayoutParams statusParams = matchWrap();
        statusParams.setMargins(0, dp(16), 0, dp(10));
        card.addView(serviceStatus, statusParams);

        Button captureButton = secondaryButton("INICIAR LEITURA DA TELA");
        captureButton.setOnClickListener(view -> requestScreenCapture());
        card.addView(captureButton, matchWrap());

        Button stopButton = secondaryButton("PARAR LEITURA");
        stopButton.setOnClickListener(view -> {
            Intent stopIntent = new Intent(this, ScreenCaptureService.class)
                    .setAction(ScreenCaptureService.ACTION_STOP);
            startService(stopIntent);
            showStatus("Leitura interrompida.", false);
        });
        LinearLayout.LayoutParams stopParams = matchWrap();
        stopParams.setMargins(0, dp(10), 0, 0);
        card.addView(stopButton, stopParams);

        LinearLayout notice = horizontal();
        notice.setGravity(Gravity.TOP);
        notice.setPadding(dp(14), dp(14), dp(14), dp(14));
        notice.setBackground(roundRect(Color.argb(120, 255, 255, 255), Color.argb(65, 124, 58, 237), 20));
        LinearLayout.LayoutParams noticeParams = matchWrap();
        noticeParams.setMargins(0, dp(18), 0, 0);
        root.addView(notice, noticeParams);

        TextView star = text("✦", 20, COLOR_GOLD);
        notice.addView(star, new LinearLayout.LayoutParams(dp(30), ViewGroup.LayoutParams.WRAP_CONTENT));
        TextView noticeText = text(
                "Quando o Android perguntar, compartilhe somente o WhatsApp (ou a tela inteira em aparelhos antigos). Depois mantenha o chat correto aberto e a tela ligada. Uma notificação fixa mostra enquanto a leitura estiver ativa.",
                13,
                COLOR_MUTED
        );
        noticeText.setLineSpacing(dp(2), 1f);
        notice.addView(noticeText, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        return scrollView;
    }

    private void addLabeledField(LinearLayout parent, String label, EditText field) {
        TextView labelView = text(label, 11, COLOR_MUTED);
        labelView.setTypeface(Typeface.create("sans-serif-condensed", Typeface.BOLD));
        labelView.setLetterSpacing(0.1f);
        LinearLayout.LayoutParams labelParams = matchWrap();
        labelParams.setMargins(0, dp(16), 0, dp(7));
        parent.addView(labelView, labelParams);
        parent.addView(field, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(52)
        ));
    }

    private EditText field(String hint, int inputType) {
        EditText input = new EditText(this);
        input.setHint(hint);
        input.setHintTextColor(Color.rgb(145, 132, 147));
        input.setTextColor(COLOR_INK);
        input.setTextSize(14);
        input.setSingleLine(true);
        input.setInputType(inputType);
        input.setPadding(dp(14), 0, dp(14), 0);
        input.setBackground(roundRect(Color.argb(205, 255, 255, 255), Color.argb(42, 70, 54, 72), 15));
        return input;
    }

    private Button primaryButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(Color.WHITE);
        button.setTextSize(13);
        button.setTypeface(Typeface.create("sans-serif-condensed", Typeface.BOLD));
        button.setLetterSpacing(0.08f);
        button.setAllCaps(false);
        button.setMinHeight(dp(54));
        button.setBackground(roundRect(COLOR_VIOLET_DEEP, Color.argb(45, 255, 255, 255), 28));
        return button;
    }

    private Button secondaryButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(COLOR_VIOLET_DEEP);
        button.setTextSize(13);
        button.setTypeface(Typeface.create("sans-serif-condensed", Typeface.BOLD));
        button.setLetterSpacing(0.08f);
        button.setAllCaps(false);
        button.setMinHeight(dp(52));
        button.setBackground(roundRect(Color.argb(150, 255, 255, 255), Color.argb(55, 80, 58, 83), 28));
        return button;
    }

    private void loadPreferences() {
        SharedPreferences preferences = getSharedPreferences(ApiClient.PREFS, MODE_PRIVATE);
        serverInput.setText(preferences.getString(ApiClient.KEY_SERVER_URL, ""));
        tokenInput.setText(preferences.getString(ApiClient.KEY_SENSOR_TOKEN, ""));
        contactInput.setText(preferences.getString(ApiClient.KEY_CONTACT_NAME, ""));
        consentCheck.setChecked(preferences.getBoolean(ApiClient.KEY_CONSENT, false));
    }

    private void saveAndTest() {
        String server = serverInput.getText().toString().trim().replaceAll("/+$", "");
        String token = tokenInput.getText().toString().trim();
        String contact = contactInput.getText().toString().trim();

        if (!server.startsWith("https://")) {
            showStatus("Use o endereço HTTPS completo do painel.", true);
            return;
        }
        if (!token.startsWith("sensor")) {
            showStatus("Cole o código sensor1_… ou sensor2_…", true);
            return;
        }
        if (contact.isEmpty()) {
            showStatus("Digite o nome exatamente como aparece no chat.", true);
            return;
        }
        if (!consentCheck.isChecked()) {
            showStatus("Confirme a autorização antes de ativar.", true);
            return;
        }

        getSharedPreferences(ApiClient.PREFS, MODE_PRIVATE)
                .edit()
                .putString(ApiClient.KEY_SERVER_URL, server)
                .putString(ApiClient.KEY_SENSOR_TOKEN, token)
                .putString(ApiClient.KEY_CONTACT_NAME, contact)
                .putBoolean(ApiClient.KEY_CONSENT, true)
                .apply();

        showStatus("Testando conexão…", false);
        executor.execute(() -> {
            boolean connected = ApiClient.postState(this, "heartbeat");
            runOnUiThread(() -> showStatus(
                    connected
                            ? "Conectado. Agora ative o sensor abaixo."
                            : "Não conectou. Confira endereço e código.",
                    !connected
            ));
        });
    }

    private void updateServiceStatus() {
        if (serviceStatus == null) return;
        boolean captureActive = getSharedPreferences(ApiClient.PREFS, MODE_PRIVATE)
                .getBoolean(ApiClient.KEY_CAPTURE_ACTIVE, false);
        if (captureActive) {
            showStatus("Leitura consentida ativa. Agora abra o chat correto.", false);
        } else if (ApiClient.hasConfiguration(this)) {
            showStatus("Configuração pronta. Toque em iniciar leitura.", false);
        } else {
            showStatus("Preencha, confirme a autorização e salve.", false);
        }
    }

    private void requestScreenCapture() {
        if (!ApiClient.hasConfiguration(this)) {
            showStatus("Primeiro salve e teste a configuração.", true);
            return;
        }

        MediaProjectionManager manager =
                (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_CAPTURE);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_CAPTURE) return;

        if (resultCode != RESULT_OK || data == null) {
            showStatus("Compartilhamento cancelado. Nada foi lido.", true);
            return;
        }

        Intent serviceIntent = new Intent(this, ScreenCaptureService.class)
                .setAction(ScreenCaptureService.ACTION_START)
                .putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, resultCode)
                .putExtra(ScreenCaptureService.EXTRA_RESULT_DATA, data);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
        showStatus("Leitura iniciada. Agora abra o chat correto.", false);
    }

    private void showStatus(String message, boolean error) {
        serviceStatus.setText(message);
        serviceStatus.setTextColor(error ? Color.rgb(145, 67, 58) : COLOR_MUTED);
        serviceStatus.setBackground(roundRect(
                error ? Color.rgb(255, 238, 233) : Color.argb(135, 244, 237, 249),
                error ? Color.argb(75, 178, 96, 84) : Color.argb(42, 124, 58, 237),
                18
        ));
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 911);
        }
    }

    private TextView text(String value, int sizeSp, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sizeSp);
        view.setTextColor(color);
        return view;
    }

    private LinearLayout vertical() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        return layout;
    }

    private LinearLayout horizontal() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        return layout;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
    }

    private GradientDrawable roundRect(int fill, int stroke, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(dp(radiusDp));
        drawable.setStroke(dp(1), stroke);
        return drawable;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
