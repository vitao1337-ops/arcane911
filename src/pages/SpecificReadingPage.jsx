import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { specificReadingsBySlug } from "../data/products";

export default function SpecificReadingPage({ slug }) {
  const reading = specificReadingsBySlug[slug];

  if (!reading) return <Navigate to="/" replace />;

  return (
    <main className="specific-reading-page" id="specific-reading-top" data-product={reading.slug} data-future-price={reading.futurePrice}>
      <section className="specific-reading-hero">
        <div className="specific-reading-copy">
          <Link className="specific-back-link" to="/tiragem-gratis"><ArrowLeft size={15} /> Voltar ao ritual gratuito</Link>
          <span className="section-kicker">{reading.eyebrow}</span>
          <h1>{reading.title}</h1>
          <p>{reading.description}</p>

          <div className="specific-question">
            <small>Pergunta-guia</small>
            <q>{reading.question}</q>
          </div>

          <div className="specific-reading-actions">
            <Link className="button button-primary button-large" to={`/tiragem-gratis?intencao=${reading.intentId}`}>
              Começar pelas 3 cartas gratuitas
              <ArrowRight size={18} />
            </Link>
            <span><ShieldCheck size={15} /> Nenhuma cobrança ativa nesta versão</span>
          </div>
        </div>

        <div className="specific-spread-preview" aria-label={`Prévia de ${reading.cardCount} posições`}>
          <div className="specific-preview-orbit" aria-hidden="true" />
          {reading.positions.map((position, index) => (
            <article key={position} style={{ "--specific-index": index, "--specific-depth": Math.abs(2 - index) }}>
              <div className="specific-card-back" aria-hidden="true">
                <span>✦</span>
                <i />
                <b>A911</b>
              </div>
              <span><strong>0{index + 1}</strong>{position}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="specific-structure">
        <div className="astro-section-heading split-heading">
          <div><span className="section-kicker">Estrutura preparada</span><h2>Cinco posições. Uma pergunta sem atalhos.</h2></div>
          <p>{reading.promise}</p>
        </div>

        <div className="specific-position-grid">
          {reading.positions.map((position, index) => (
            <article key={position}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <Sparkles size={17} />
              <h3>{position}</h3>
              <p>A camada que organiza este ponto será interpretada em relação às demais cartas, não como uma resposta isolada.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="specific-coming-next">
        <div className="specific-lock"><LockKeyhole size={24} /></div>
        <span className="section-kicker">Próxima fase</span>
        <h2>O espaço está pronto para a taróloga.</h2>
        <p>
          A rota, o produto e a estrutura de cinco cartas já existem. A leitura específica só será ativada quando a camada de interpretação e o checkout estiverem conectados e validados.
        </p>
        <Link className="button button-glass button-large" to="/tiragem-gratis">Experimentar o Arcane911 agora <ArrowRight size={18} /></Link>
      </section>
    </main>
  );
}
