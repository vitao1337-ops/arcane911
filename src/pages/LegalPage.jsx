import { ArrowLeft, ExternalLink, Mail, ShieldCheck } from "../components/MysticIcons";
import { Link } from "react-router-dom";
import { legalConfig } from "../config/legal";

const pageCopy = Object.freeze({
  terms: {
    kicker: "Documento público",
    title: "Termos de Uso",
    lead: "Regras claras para uma experiência simbólica, digital e de compra única.",
  },
  privacy: {
    kicker: "Documento público",
    title: "Política de Privacidade",
    lead: "O mínimo de dados possível, com separação entre a experiência íntima e a confirmação técnica da compra.",
  },
  refunds: {
    kicker: "Documento público",
    title: "Cancelamentos e Reembolsos",
    lead: "Como pedir análise de uma cobrança ou relatar uma entrega digital que não foi concluída.",
  },
});

function SupportChannel() {
  return legalConfig.supportEmail ? (
    <a href={`mailto:${legalConfig.supportEmail}`}>
      <Mail size={16} /> {legalConfig.supportEmail}
    </a>
  ) : (
    <span className="legal-pending-contact">Canal de suporte pendente de configuração antes da publicação comercial.</span>
  );
}

function TermsContent() {
  return (
    <>
      <section>
        <h2>1. Natureza do serviço</h2>
        <p>O Arcane911 oferece leituras de tarot e interpretações astrológicas como instrumentos de reflexão simbólica e entretenimento. O conteúdo não prevê fatos com certeza e não substitui atendimento médico, psicológico, jurídico, financeiro, de segurança ou qualquer serviço profissional.</p>
      </section>
      <section>
        <h2>2. Elegibilidade e uso responsável</h2>
        <p>O serviço comercial é destinado a maiores de 18 anos. Não use a experiência para decidir situações de emergência, risco de violência, autoagressão, saúde, crime, gravidez, investimento ou disputa jurídica. Em risco imediato, procure uma pessoa de confiança e o serviço de emergência adequado.</p>
      </section>
      <section>
        <h2>3. Produtos e entrega digital</h2>
        <p>Cada preço exibido corresponde à entrega descrita na própria oferta. A Tiragem Completa inclui até cinco perguntas específicas vinculadas àquela leitura. O Documento Astral 911 libera o mapa e a leitura automática após a confirmação do pagamento e inclui uma síntese individual em PDF, com prazo informado de 1 a 2 dias úteis, além de cinco perguntas específicas sobre o mapa após a entrega. A confirmação é processada pelo Mercado Pago e vinculada a um código de pedido.</p>
      </section>
      <section>
        <h2>4. Inteligência artificial e limites</h2>
        <p>Algumas sínteses usam provedores de inteligência artificial. A saída é revisada por regras automáticas, mas ainda pode conter imprecisões. O usuário deve confrontar hipóteses simbólicas com fatos observáveis e preservar a própria autonomia.</p>
      </section>
      <section>
        <h2>5. Disponibilidade e conduta</h2>
        <p>Podemos interromper temporariamente recursos para manutenção, segurança, controle de custo ou falha de terceiros. É proibido tentar contornar pagamentos, explorar rotas técnicas, automatizar abuso ou prejudicar a disponibilidade do serviço.</p>
      </section>
      <section>
        <h2>6. Contato e versão</h2>
        <p>Operador informado: {legalConfig.operatorName}. Para suporte, cobrança ou privacidade: <SupportChannel /></p>
      </section>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <section>
        <h2>1. Dados mantidos no seu navegador</h2>
        <p>Diário, rascunhos e cópias de leitura podem ficar no navegador. A memória opcional do 911 depende de consentimento na interface. Dados de compras e respostas contratadas também são guardados em uma base privada para entrega e recuperação; limpar o navegador não apaga essa cópia. Você pode solicitar exclusão ao suporte, observadas as obrigações de retenção aplicáveis.</p>
      </section>
      <section>
        <h2>2. Compra e autorização</h2>
        <p>O Mercado Pago processa os dados de pagamento conforme sua própria política. O livro-caixa privado registra identificadores técnicos e consumo dos acessos. Uma área privada de entrega guarda os dados da compra, as cartas, a pergunta necessária à leitura e as respostas pagas concluídas para permitir recuperação. Quando o Documento Astral é comprado, o Arcane911 também guarda, em área privada, nome, e-mail, data, horário, cidade, fuso e coordenadas necessários para preparar e entregar a síntese humana contratada. O código do pedido funciona como chave privada para recuperar o conteúdo. Não o compartilhe nem publique capturas de tela com ele.</p>
      </section>
      <section>
        <h2>3. Conteúdo enviado à inteligência artificial</h2>
        <p>Para o tarot, são enviados a pergunta, as cartas, posições e o contexto necessário à síntese. Para o documento astral, a interpretação recebe o mapa já calculado; a interface foi projetada para não enviar cidade, data e hora brutas ao modelo. Provedores podem manter registros técnicos conforme contratos e políticas próprias.</p>
      </section>
      <section>
        <h2>4. Serviços técnicos</h2>
        <p>Vercel hospeda o aplicativo e pode registrar IP, horário, rota e diagnóstico. Supabase guarda o livro-caixa, as respostas contratadas e a fila de entrega em área privada. A busca de cidades usa dados GeoNames incluídos no próprio site, sob licença CC BY 4.0; não envia dados de nascimento a um serviço externo de geocodificação. Não há publicidade comportamental incorporada nesta versão.</p>
      </section>
      <section>
        <h2>5. Controle, exclusão e segurança</h2>
        <p>Você pode apagar leituras locais limpando os dados do site no navegador e remover a memória opcional pelo controle da própria experiência. Dados de uma encomenda astral podem precisar ser mantidos durante a preparação, entrega, suporte e prazos legais aplicáveis. Para acesso, correção ou exclusão quando cabível, use o canal abaixo. O acesso às tabelas privadas é restrito ao servidor.</p>
      </section>
      <section>
        <h2>6. Contato</h2>
        <p><SupportChannel /></p>
      </section>
    </>
  );
}

function RefundContent() {
  return (
    <>
      <section>
        <h2>1. Entrega que falhou</h2>
        <p>Se a cobrança foi confirmada e o acesso não apareceu, use primeiro <Link to="/recuperar-compra">Recuperar compra</Link>. Se o código não resolver, envie o código do pedido, data e valor ao suporte. Nunca envie número completo do cartão ou código de segurança.</p>
      </section>
      <section>
        <h2>2. Pedido de cancelamento</h2>
        <p>Solicitações recebidas em até 7 dias corridos da compra serão analisadas conforme a legislação aplicável, o estado da entrega digital e os registros técnicos da autorização. Direitos obrigatórios do consumidor não são limitados por este texto.</p>
      </section>
      <section>
        <h2>3. Conteúdo já consumido</h2>
        <p>Informe se a leitura, pergunta ao 911 ou documento já foi gerado. Isso não impede o envio da solicitação; permite apenas analisar corretamente a entrega e eventual uso do crédito único.</p>
      </section>
      <section>
        <h2>4. Como solicitar</h2>
        <p>Use o canal abaixo com o assunto “Arcane911 — pedido de reembolso”. A resposta deve informar o andamento e, quando aprovado, o estorno seguirá o meio de pagamento.</p>
        <p><SupportChannel /></p>
      </section>
    </>
  );
}

export default function LegalPage({ type }) {
  const copy = pageCopy[type] ?? pageCopy.terms;
  return (
    <main className="legal-page" id="legal-content">
      <article className="legal-shell">
        <Link className="specific-back-link" to="/"><ArrowLeft size={15} /> Voltar ao Arcane911</Link>
        <header>
          <span className="section-kicker">{copy.kicker}</span>
          <h1>{copy.title}</h1>
          <p>{copy.lead}</p>
          <div className="legal-meta"><ShieldCheck size={16} /> Revisado em {legalConfig.revisedAt}</div>
        </header>
        {!legalConfig.ready ? (
          <aside className="legal-setup-warning" role="note">
            Publicação comercial pendente: configure a identificação do operador e o e-mail de suporte.
          </aside>
        ) : null}
        <div className="legal-sections">
          {type === "privacy" ? <PrivacyContent /> : type === "refunds" ? <RefundContent /> : <TermsContent />}
        </div>
        <nav className="legal-related" aria-label="Documentos relacionados">
          <Link to="/termos">Termos de Uso</Link>
          <Link to="/privacidade">Privacidade</Link>
          <Link to="/reembolsos">Reembolsos</Link>
          <a href="https://www.mercadopago.com.br/privacidade" target="_blank" rel="noreferrer">Privacidade do Mercado Pago <ExternalLink size={13} /></a>
        </nav>
      </article>
    </main>
  );
}
