import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  MapPin,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import Astral911Document from "../components/Astral911Document";
import NatalWheel from "../components/NatalWheel";
import {
  buildAstroShareText,
  calculateNatalChart,
  fallbackLocations,
  searchBirthplaces,
} from "../lib/astrology";

const ASTRO_STORAGE_KEY = "arcane911.astral.v1";

function formatLocation(location) {
  return [location.name, location.admin1, location.country].filter(Boolean).join(" · ");
}

function formatDateValue(value) {
  const [year, month, day] = String(value).split("-");
  return year && month && day ? [day, month, year].join("/") : "Escolha no calendário";
}

function formatTimeValue(value) {
  return String(value).length >= 5 ? String(value).slice(0, 5) : "Escolha o horário";
}

function TemporalPickerField({
  id,
  type,
  label,
  value,
  onChange,
  max,
  helper,
  action,
  icon: Icon,
}) {
  const helperId = id + "-helper";
  const displayValue = type === "date" ? formatDateValue(value) : formatTimeValue(value);

  function openNativePicker(event) {
    try {
      event.currentTarget.showPicker?.();
    } catch {
      // O clique nativo continua funcionando quando o navegador não permite showPicker().
    }
  }

  return (
    <label className="astro-field astro-temporal-field" htmlFor={id}>
      <span><Icon size={16} /> {label}</span>
      <span className={"astro-picker-surface " + (value ? "has-value" : "")}>
        <span className="astro-picker-value" aria-hidden="true">
          <strong>{displayValue}</strong>
          <small>{type === "date" ? "dia · mês · ano" : "horário do local de nascimento"}</small>
        </span>
        <span className="astro-picker-action" aria-hidden="true">
          {action}
          <Icon size={17} />
        </span>
        <input
          className="astro-native-picker"
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onClick={openNativePicker}
          max={max}
          aria-describedby={helperId}
          required
        />
      </span>
      <small className="astro-picker-helper" id={helperId}>{helper}</small>
    </label>
  );
}

function readStoredChart() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(ASTRO_STORAGE_KEY) ?? "null");
    return stored?.planets?.length === 10 && stored?.houses?.length === 12 ? stored : null;
  } catch {
    return null;
  }
}

export default function AstralMapPage() {
  const [form, setForm] = useState({ name: "", date: "", time: "", city: "" });
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locations, setLocations] = useState([]);
  const [searching, setSearching] = useState(false);
  const [chart, setChart] = useState(readStoredChart);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const controllerRef = useRef(null);
  const resultRef = useRef(null);
  const updateStatus = useMemo(() => (message) => setStatus(message), []);

  const maxDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const featuredCities = fallbackLocations.slice(0, 5);

  useEffect(() => () => controllerRef.current?.abort(), []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    if (field === "city") setSelectedLocation(null);
  }

  function chooseLocation(location) {
    setSelectedLocation(location);
    setForm((current) => ({ ...current, city: formatLocation(location) }));
    setLocations([]);
    setError("");
    setStatus(`Cidade confirmada: ${formatLocation(location)}.`);
  }

  async function findLocations() {
    if (form.city.trim().length < 2) {
      setError("Digite pelo menos duas letras para buscar a cidade.");
      return;
    }

    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    setSearching(true);
    setError("");
    setStatus("Buscando cidades e fusos horários…");

    try {
      const matches = await searchBirthplaces(form.city, controllerRef.current.signal);
      setLocations(matches);
      setStatus(matches.length ? "Escolha a cidade correta na lista." : "Nenhuma cidade encontrada.");
      if (!matches.length) setError("Não encontramos essa cidade. Confira a escrita ou escolha uma sugestão.");
    } catch (searchError) {
      if (searchError?.name !== "AbortError") setError(searchError.message);
    } finally {
      setSearching(false);
    }
  }

  function createChart(event) {
    event.preventDefault();
    setError("");

    try {
      const nextChart = calculateNatalChart({ ...form, location: selectedLocation });
      setChart(nextChart);
      window.localStorage.setItem(ASTRO_STORAGE_KEY, JSON.stringify(nextChart));
      setStatus("Mapa calculado e guardado somente neste dispositivo.");
      window.requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (chartError) {
      setError(chartError.message);
    }
  }

  async function shareChart() {
    if (!chart) return;
    const text = buildAstroShareText(chart);

    try {
      if (navigator.share) {
        await navigator.share({ title: `Mapa Astral · ${chart.person}`, text });
        setStatus("Mapa compartilhado.");
      } else {
        await navigator.clipboard.writeText(text);
        setStatus("Resumo do mapa copiado.");
      }
    } catch (shareError) {
      if (shareError?.name !== "AbortError") setStatus("Não foi possível compartilhar agora.");
    }
  }

  function startAgain() {
    setChart(null);
    setForm({ name: "", date: "", time: "", city: "" });
    setSelectedLocation(null);
    setLocations([]);
    setError("");
    setStatus("Pronto para um novo mapa.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="astro-page" id="astro-top">
      <section className="astro-hero">
        <div className="astro-hero-copy">
          <div className="eyebrow"><span /> Mapa natal · cálculo real</div>
          <h1>O céu do instante em que <em>você chegou.</em></h1>
          <p>
            Data, horário e cidade transformados em um mapa completo: Sol, Lua, Ascendente,
            planetas, casas e aspectos — e um documento pessoal escrito a partir do seu céu real.
          </p>
          <div className="astro-test-access">
            <FileText size={17} />
            <span>
              <strong>Documento premium em validação.</strong>
              Acesso aberto e sem cobrança durante esta fase de testes.
            </span>
          </div>
          <div className="astro-hero-notes">
            <span><CheckCircle2 size={16} /> 10 planetas</span>
            <span><CheckCircle2 size={16} /> 12 casas</span>
            <span><CheckCircle2 size={16} /> Aspectos maiores</span>
          </div>
          <a className="button button-primary button-large" href="#criar-mapa">
            Criar meu mapa
            <ArrowRight size={18} />
          </a>
        </div>
        <div className="astro-hero-wheel">
          <span className="astro-orbit-note"><Sparkles size={14} /> sua arquitetura celeste</span>
          <NatalWheel chart={chart} preview={!chart} />
        </div>
      </section>

      <section className="astro-form-section" id="criar-mapa">
        <div className="astro-form-intro">
          <span className="section-kicker">01 · Coordenadas de nascimento</span>
          <h2>Precisão começa no dado certo.</h2>
          <p>
            Use o horário registrado. Alguns minutos podem alterar graus e, perto de uma cúspide,
            mudar o Ascendente ou a distribuição das casas.
          </p>
          <div className="astro-privacy-card">
            <ShieldCheck size={20} />
            <div>
              <strong>Privacidade por minimização.</strong>
              <span>
                O cálculo fica no navegador. Para escrever o documento, o Gemini recebe somente
                seu primeiro nome e as posições calculadas — nunca data, horário ou cidade.
              </span>
            </div>
          </div>
        </div>

        <form className="astro-form" onSubmit={createChart} noValidate>
          <label className="astro-field astro-field-wide">
            <span><UserRound size={16} /> Nome completo</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value.slice(0, 60))}
              placeholder="Digite seu nome completo"
              autoComplete="name"
              required
            />
          </label>

          <TemporalPickerField
            id="birth-date"
            type="date"
            label="Data de nascimento"
            value={form.date}
            onChange={(event) => updateField("date", event.target.value)}
            max={maxDate}
            helper="Clique em qualquer ponto do campo para abrir o calendário."
            action="Calendário"
            icon={CalendarDays}
          />

          <TemporalPickerField
            id="birth-time"
            type="time"
            label="Horário de nascimento"
            value={form.time}
            onChange={(event) => updateField("time", event.target.value)}
            helper="Use o horário registrado na certidão, quando souber."
            action="Relógio"
            icon={Clock3}
          />

          <div className="astro-field astro-field-wide astro-location-field">
            <label htmlFor="birth-city"><MapPin size={16} /> Cidade de nascimento</label>
            <div className="astro-location-search">
              <input
                id="birth-city"
                type="search"
                value={form.city}
                onChange={(event) => updateField("city", event.target.value.slice(0, 100))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    findLocations();
                  }
                }}
                placeholder="Ex.: Campinas, São Paulo"
                autoComplete="off"
              />
              <button className="button button-glass" type="button" onClick={findLocations} disabled={searching}>
                <Search size={17} /> {searching ? "Buscando…" : "Buscar"}
              </button>
            </div>

            {locations.length ? (
              <div className="location-results" role="listbox" aria-label="Cidades encontradas">
                {locations.map((location) => (
                  <button type="button" role="option" key={location.id} onClick={() => chooseLocation(location)}>
                    <MapPin size={16} />
                    <span><strong>{location.name}</strong><small>{[location.admin1, location.country].filter(Boolean).join(" · ")}</small></span>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="city-shortcuts" aria-label="Cidades mais usadas">
              <small>Atalhos</small>
              {featuredCities.map((location) => (
                <button type="button" key={location.id} onClick={() => chooseLocation(location)}>{location.name}</button>
              ))}
            </div>
          </div>

          {selectedLocation ? (
            <div className="selected-location astro-field-wide">
              <CheckCircle2 size={17} />
              <span><strong>Local confirmado</strong>{formatLocation(selectedLocation)} · {selectedLocation.timezone}</span>
            </div>
          ) : null}

          {error ? <p className="astro-error astro-field-wide" role="alert">{error}</p> : null}

          <button className="button button-primary button-large astro-submit astro-field-wide" type="submit">
            Calcular meu céu
            <Sparkles size={18} />
          </button>
          <p className="astro-form-source astro-field-wide">
            Coordenadas por Open-Meteo · efemérides verificadas em dois motores independentes ·
            texto conectado pelo Gemini.
          </p>
        </form>
      </section>

      {chart ? (
        <section className="astro-result" ref={resultRef} aria-labelledby="astro-result-title">
          <div className="astro-result-header">
            <div>
              <span className="section-kicker">02 · Seu mapa está aberto</span>
              <h2 id="astro-result-title">O céu de {chart.person}.</h2>
              <p>
                {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(`${chart.birth.date}T12:00:00`))}
                {` às ${chart.birth.time} · ${chart.location.name}, ${chart.location.country}`}
              </p>
            </div>
            <div className={`precision-badge is-${chart.precision.status}`}>
              <CheckCircle2 size={18} />
              <span><strong>{chart.precision.label}</strong><small>desvio máximo {chart.precision.maximumDelta.toFixed(3)}°</small></span>
            </div>
          </div>

          <div className="astro-chart-stage">
            <NatalWheel chart={chart} />
            <article className="astro-synthesis">
              <span className="section-kicker">Síntese inicial</span>
              <h3>Três camadas, uma mesma pessoa.</h3>
              <p>{chart.synthesis}</p>
              <div className="element-score">
                {Object.entries(chart.elementScores).map(([element, score]) => (
                  <span className={element === chart.dominantElement ? "is-dominant" : ""} key={element}>
                    <small>{element}</small><strong>{score}</strong>
                  </span>
                ))}
              </div>
              <small>Elemento dominante: <strong>{chart.dominantElement}</strong>. Predominância indica disponibilidade, não superioridade.</small>
            </article>
          </div>

          <Astral911Document chart={chart} onStatus={updateStatus} />

          <section className="big-three-section" aria-labelledby="big-three-title">
            <div className="astro-section-heading">
              <span className="section-kicker">O trio essencial</span>
              <h3 id="big-three-title">Identidade, emoção e presença.</h3>
            </div>
            <div className="big-three-grid">
              {chart.bigThree.map((point) => (
                <article key={point.key}>
                  <span className="big-three-glyph">{point.glyph}</span>
                  <small>{point.eyebrow}</small>
                  <h4>{point.title}</h4>
                  <b>{point.degreeLabel}</b>
                  <p>{point.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="astro-detail-section" aria-labelledby="planets-title">
            <div className="astro-section-heading split-heading">
              <div><span className="section-kicker">Planetas</span><h3 id="planets-title">Dez funções em movimento.</h3></div>
              <p>O signo mostra como a função se expressa. A casa mostra onde ela encontra experiência concreta.</p>
            </div>
            <div className="planet-grid">
              {chart.planets.map((planet) => (
                <article key={planet.key}>
                  <div className="planet-heading">
                    <span>{planet.glyph}</span>
                    <div><h4>{planet.name}</h4><small>{planet.role}</small></div>
                  </div>
                  <div className="planet-position">
                    <strong>{planet.sign.glyph} {planet.sign.name} {planet.degreeLabel}</strong>
                    <span>Casa {planet.house}{planet.retrograde ? " · retrógrado" : ""}</span>
                  </div>
                  <p>{planet.interpretation}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="astro-detail-section" aria-labelledby="aspects-title">
            <div className="astro-section-heading split-heading">
              <div><span className="section-kicker">Aspectos maiores</span><h3 id="aspects-title">Onde as forças conversam.</h3></div>
              <p>Linhas de cooperação, tensão e integração calculadas pela distância angular entre os pontos.</p>
            </div>
            <div className="aspect-list">
              {chart.aspects.map((aspect, index) => (
                <article key={`${aspect.point1Key}-${aspect.point2Key}-${index}`}>
                  <span className={`aspect-symbol is-${aspect.tone}`}>{aspect.symbol}</span>
                  <div>
                    <small>{aspect.name} · orbe {Number(aspect.orb).toFixed(2)}°</small>
                    <h4>{aspect.point1Name} × {aspect.point2Name}</h4>
                    <p>{aspect.interpretation}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="astro-detail-section" aria-labelledby="houses-title">
            <div className="astro-section-heading split-heading">
              <div><span className="section-kicker">As doze casas</span><h3 id="houses-title">Os territórios da experiência.</h3></div>
              <p>O Ascendente abre a Casa 1. A partir dele, o mapa distribui temas e planetas em doze campos.</p>
            </div>
            <div className="house-grid">
              {chart.houses.map((house) => (
                <article key={house.number}>
                  <span>{String(house.number).padStart(2, "0")}</span>
                  <div>
                    <small>{house.sign.glyph} {house.sign.name} · {house.degreeLabel}</small>
                    <h4>{house.theme}</h4>
                    <p>{house.planets.length ? house.planets.map((key) => chart.planets.find((planet) => planet.key === key)?.name).join(" · ") : "Sem planetas — o tema continua ativo pelo signo da cúspide."}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="astro-result-actions">
            <button className="button button-primary" type="button" onClick={shareChart}><Share2 size={17} /> Compartilhar resumo</button>
            <button className="button button-glass" type="button" onClick={startAgain}><RotateCcw size={16} /> Criar outro mapa</button>
            <Link className="text-button" to="/tiragem-gratis">Levar uma pergunta ao tarot <ArrowRight size={15} /></Link>
          </div>
          <p className="astro-disclaimer">
            Astrologia é uma linguagem simbólica de autoconhecimento. O mapa não determina acontecimentos nem substitui orientação médica, jurídica, psicológica ou financeira.
          </p>
        </section>
      ) : null}

      <p className="live-status astro-live-status" aria-live="polite">{status}</p>
    </main>
  );
}
