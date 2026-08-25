# Presença 911 — Sensor Android

Aplicativo Android auxiliar do painel **Presença 911**.

## O que ele faz

- Observa exclusivamente o cabeçalho do WhatsApp ou WhatsApp Business.
- Confirma que o chat aberto é o contato configurado.
- Compara se o texto exato **online** está visível.
- Envia ao painel somente os estados online, offline, waiting, screen_on, screen_off ou heartbeat.
- Avisa localmente quando o contato passa a aparecer online.

Ele não lê, envia ou armazena mensagens, fotos, áudios, listas de contatos ou senhas.

## Instalação pelo Android Studio

1. Abra esta pasta no Android Studio.
2. Aguarde a instalação do Android SDK 35 e a sincronização do Gradle.
3. Use **Build > Build APK(s)**.
4. O APK ficará em app/build/outputs/apk/debug/app-debug.apk.
5. Instale o mesmo APK nos dois celulares.

Também existe um fluxo em .github/workflows/build-apk.yml: ao enviar este projeto para um repositório GitHub, ele gera um APK de teste como artefato.

## Configuração de cada celular

1. Abra o **Presença 911**.
2. Use o endereço https://presenca-911.vitao1337.chatgpt.site.
3. Cole o código correspondente ao Celular 1 ou Celular 2, disponível em CODIGOS-PRIVADOS.txt.
4. Digite o nome do contato exatamente como aparece no cabeçalho do WhatsApp.
5. Confirme o consentimento e toque em **Salvar e testar conexão**.
6. Toque em **Ativar sensor no Android** e habilite **Sensor Presença 911**.
7. Volte ao WhatsApp e deixe o chat configurado aberto.

## Limites honestos

- Se a pessoa ocultar o indicador online, o sensor não consegue contornar isso.
- offline significa “o texto online não aparece no chat”; não confirma tecnicamente que o aparelho remoto está desconectado.
- Com a tela apagada, o painel mostra **Tela desligada** enquanto o Android mantém o sensor respondendo.
- Se o celular for desligado, ficar sem internet ou o Android suspender o sensor, após aproximadamente 45 segundos o painel mostra **Sensor desconectado**.
- Mudanças na interface do WhatsApp podem exigir atualização do sensor.

## Privacidade

Os códigos dos sensores dão permissão para publicar estados no painel. Não os compartilhe. Para revogar o acesso, substitua os códigos no banco e gere uma nova versão do sensor.
