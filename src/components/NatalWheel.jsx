import { memo } from "react";

const zodiacSigns = [
  { key: "aries", glyph: "♈" },
  { key: "taurus", glyph: "♉" },
  { key: "gemini", glyph: "♊" },
  { key: "cancer", glyph: "♋" },
  { key: "leo", glyph: "♌" },
  { key: "virgo", glyph: "♍" },
  { key: "libra", glyph: "♎" },
  { key: "scorpio", glyph: "♏" },
  { key: "sagittarius", glyph: "♐" },
  { key: "capricorn", glyph: "♑" },
  { key: "aquarius", glyph: "♒" },
  { key: "pisces", glyph: "♓" },
];

const previewPlanets = [
  { key: "sun", glyph: "☉", longitude: 282 },
  { key: "moon", glyph: "☽", longitude: 341 },
  { key: "mercury", glyph: "☿", longitude: 295 },
  { key: "venus", glyph: "♀", longitude: 319 },
  { key: "mars", glyph: "♂", longitude: 248 },
  { key: "jupiter", glyph: "♃", longitude: 96 },
  { key: "saturn", glyph: "♄", longitude: 284 },
  { key: "uranus", glyph: "♅", longitude: 278 },
  { key: "neptune", glyph: "♆", longitude: 283 },
  { key: "pluto", glyph: "♇", longitude: 228 },
];

const previewAspects = [
  { point1Key: "sun", point2Key: "moon", aspectKey: "sextile" },
  { point1Key: "sun", point2Key: "jupiter", aspectKey: "opposition" },
  { point1Key: "moon", point2Key: "pluto", aspectKey: "trine" },
  { point1Key: "venus", point2Key: "mars", aspectKey: "square" },
  { point1Key: "mercury", point2Key: "saturn", aspectKey: "conjunction" },
];

const aspectClass = {
  conjunction: "is-conjunction",
  opposition: "is-tension",
  square: "is-tension",
  trine: "is-flow",
  sextile: "is-flow",
};

function polarPoint(longitude, radius, ascendant, center = 300) {
  const angle = ((longitude - ascendant + 180) * Math.PI) / 180;
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

function normalize(value) {
  return ((value % 360) + 360) % 360;
}

function NatalWheel({ chart, preview = false }) {
  const ascendant = chart?.ascendant?.longitude ?? 210;
  const planets = chart?.planets ?? previewPlanets;
  const aspects = chart?.aspects ?? previewAspects;
  const houses = chart?.houses ?? Array.from({ length: 12 }, (_, index) => ({
    number: index + 1,
    cusp: normalize(ascendant + index * 30),
  }));
  const points = Object.fromEntries([
    ...planets.map((planet) => [planet.key, planet.longitude]),
    ["ascendant", ascendant],
    ["midheaven", chart?.midheaven?.longitude ?? normalize(ascendant + 270)],
  ]);

  return (
    <figure className={`natal-wheel ${preview ? "is-preview" : ""}`}>
      <svg
        className="natal-wheel-svg"
        viewBox="0 0 600 600"
        role="img"
        aria-label={chart ? `Mapa astral de ${chart.person}` : "Prévia artística de um mapa astral"}
      >
        <defs>
          <radialGradient id="wheel-night" cx="50%" cy="45%">
            <stop offset="0" stopColor="#241336" stopOpacity="0.96" />
            <stop offset="0.68" stopColor="#120b20" stopOpacity="0.98" />
            <stop offset="1" stopColor="#080611" />
          </radialGradient>
          <filter id="wheel-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <circle className="wheel-night" cx="300" cy="300" r="286" fill="url(#wheel-night)" />
        <circle className="wheel-ring wheel-ring-outer" cx="300" cy="300" r="278" />
        <circle className="wheel-ring" cx="300" cy="300" r="238" />
        <circle className="wheel-ring wheel-ring-inner" cx="300" cy="300" r="170" />
        <circle className="wheel-ring wheel-ring-core" cx="300" cy="300" r="104" />

        <g className="wheel-zodiac">
          {zodiacSigns.map((sign, index) => {
            const divider = polarPoint(index * 30, 278, ascendant);
            const dividerInner = polarPoint(index * 30, 238, ascendant);
            const glyph = polarPoint(index * 30 + 15, 258, ascendant);
            return (
              <g key={sign.key}>
                <line x1={dividerInner.x} y1={dividerInner.y} x2={divider.x} y2={divider.y} />
                <text x={glyph.x} y={glyph.y}>{sign.glyph}</text>
              </g>
            );
          })}
        </g>

        <g className="wheel-houses">
          {houses.map((house) => {
            const edge = polarPoint(house.cusp, 238, ascendant);
            const label = polarPoint(normalize(house.cusp + 15), 205, ascendant);
            return (
              <g key={house.number}>
                <line x1="300" y1="300" x2={edge.x} y2={edge.y} />
                <text x={label.x} y={label.y}>{house.number}</text>
              </g>
            );
          })}
        </g>

        <g className="wheel-aspects">
          {aspects.slice(0, 18).map((aspect, index) => {
            const firstLongitude = points[aspect.point1Key];
            const secondLongitude = points[aspect.point2Key];
            if (!Number.isFinite(firstLongitude) || !Number.isFinite(secondLongitude)) return null;
            const first = polarPoint(firstLongitude, 102, ascendant);
            const second = polarPoint(secondLongitude, 102, ascendant);
            return (
              <line
                className={aspectClass[aspect.aspectKey] ?? "is-neutral"}
                x1={first.x}
                y1={first.y}
                x2={second.x}
                y2={second.y}
                key={`${aspect.point1Key}-${aspect.point2Key}-${index}`}
              />
            );
          })}
        </g>

        <g className="wheel-planets" filter="url(#wheel-glow)">
          {planets.map((planet, index) => {
            const radius = 139 - (index % 3) * 12;
            const point = polarPoint(planet.longitude, radius, ascendant);
            return (
              <g key={planet.key} transform={`translate(${point.x} ${point.y})`}>
                <circle r="13" />
                <text x="0" y="1">{planet.glyph}</text>
              </g>
            );
          })}
        </g>

        <g className="wheel-axis">
          <line x1="22" y1="300" x2="578" y2="300" />
          <text x="37" y="291">ASC</text>
          <text x="537" y="291">DSC</text>
        </g>

        <g className="wheel-center-mark" transform="translate(300 300)">
          <path d="M0-37L9-9L37 0L9 9L0 37L-9 9L-37 0L-9-9Z" />
          <circle r="8" />
          <text x="0" y="68">A911</text>
        </g>
      </svg>
      {chart ? (
        <figcaption>{chart.method} · cidade e horário locais</figcaption>
      ) : null}
    </figure>
  );
}

export default memo(NatalWheel);
