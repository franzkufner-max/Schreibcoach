'use strict';

const { SCORE_WEIGHTS, HOT_DEAL_SCORE_THRESHOLD, RETURN_THRESHOLDS } = require('./config');

/**
 * Lineare Skalierung eines Kennzahlwerts auf eine 0-100-Punktzahl.
 * failAt -> 0 Punkte, passAt -> 50 Punkte, greatAt -> 100 Punkte, geclamped.
 */
function scaleScore(value, failAt, passAt, greatAt) {
  if (value === null || value === undefined || Number.isNaN(value)) return 50; // unbekannt = neutral
  if (passAt === failAt) return value >= passAt ? 100 : 0;
  let score;
  if (value <= failAt) {
    score = 0;
  } else if (value <= passAt) {
    score = ((value - failAt) / (passAt - failAt)) * 50;
  } else if (value >= greatAt) {
    score = 100;
  } else {
    score = 50 + ((value - passAt) / (greatAt - passAt)) * 50;
  }
  return clamp(score, 0, 100);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Grober Markt-Tiering (kein Live-Datenfeed) — dient als Ausgangsheuristik
// und sollte bei Bedarf um echte Mietspiegel-/Leerstandsdaten ergänzt werden.
const CITY_MARKET_BASE_SCORE = {
  Berlin: 80,
  Leipzig: 68,
  Regensburg: 72,
  _default: 55,
};
const HIGH_DEMAND_DISTRICTS = ['Prenzlauer Berg', 'Mitte', 'Friedrichshain', 'Charlottenburg', 'Schöneberg'];

function computeFinancialScore({ bruttorendite, cashflowNachSteuerJahr1, marktBenchmarkBruttorenditePct, nutzungsart }) {
  const t =
    nutzungsart === 'selbstnutzung_ab_2036' ? RETURN_THRESHOLDS.selbstnutzungAb2036 : RETURN_THRESHOLDS.kapitalanlage;

  const renditeScore = scaleScore(bruttorendite, t.bruttorenditeMin * 0.75, t.bruttorenditeMin, t.bruttorenditeMin * 1.35);

  const cfPassAt = nutzungsart === 'selbstnutzung_ab_2036' ? t.cashflowJahr1MinEURProMonat : t.cashflowJahr1MinEUR;
  const cashflowScore = scaleScore(cashflowNachSteuerJahr1, cfPassAt - 200, cfPassAt, cfPassAt + 200);

  let spreadScore = 50;
  if (typeof marktBenchmarkBruttorenditePct === 'number' && bruttorendite !== null) {
    const spread = bruttorendite - marktBenchmarkBruttorenditePct;
    spreadScore = scaleScore(spread, -0.01, 0, 0.01);
  }

  const value = renditeScore * 0.4 + cashflowScore * 0.4 + spreadScore * 0.2;
  return { value: round1(value), components: { renditeScore, cashflowScore, spreadScore } };
}

function computeSteuerAfaScore({ effectiveAfaRateJahr1, verlustZielkorridor, korridorNochVerfuegbar }) {
  const afaScore = scaleScore(effectiveAfaRateJahr1, 0.02, 0.03, 0.06);

  let verlustScore;
  switch (verlustZielkorridor) {
    case 'ziel':
      verlustScore = 100;
      break;
    case 'ueber_ziel_korridorabhaengig':
      verlustScore = korridorNochVerfuegbar ? 65 : 15;
      break;
    case 'unter_ziel':
      verlustScore = 25;
      break;
    case 'ausschluss':
    default:
      verlustScore = 0;
  }

  const value = afaScore * 0.6 + verlustScore * 0.4;
  return { value: round1(value), components: { afaScore, verlustScore } };
}

function computeMarktScore({ city, district, marktmieteAusgereizt }) {
  let base = CITY_MARKET_BASE_SCORE[city] ?? CITY_MARKET_BASE_SCORE._default;
  if (district && HIGH_DEMAND_DISTRICTS.includes(district)) base = Math.min(100, base + 10);
  const potenzialScore = marktmieteAusgereizt === true ? 40 : 75; // Steigerungspotenzial vorhanden = besser
  const value = base * 0.65 + potenzialScore * 0.35;
  return { value: round1(clamp(value, 0, 100)), components: { base, potenzialScore } };
}

function computeRisikoScore({ zustandRisikoScore, instandhaltungsruecklageProM2, heizungsalterJahre }) {
  const zustandScore =
    typeof zustandRisikoScore === 'number' ? clamp(100 - zustandRisikoScore * 10, 0, 100) : 50;
  const ruecklageScore = scaleScore(instandhaltungsruecklageProM2, 5, 15, 25);
  const heizungScore = scaleScore(heizungsalterJahre === null ? null : 25 - heizungsalterJahre, 0, 5, 15);

  const value = zustandScore * 0.4 + ruecklageScore * 0.35 + heizungScore * 0.25;
  return { value: round1(value), components: { zustandScore, ruecklageScore, heizungScore } };
}

/**
 * Berechnet den Gesamt-Deal-Score (0-100) nach Abschnitt 10.
 */
function computeDealScore({
  bruttorendite,
  cashflowNachSteuerJahr1,
  marktBenchmarkBruttorenditePct,
  nutzungsart,
  effectiveAfaRateJahr1,
  verlustZielkorridor,
  korridorNochVerfuegbar,
  city,
  district,
  marktmieteAusgereizt,
  zustandRisikoScore,
  instandhaltungsruecklageProM2,
  heizungsalterJahre,
}) {
  const finanziell = computeFinancialScore({
    bruttorendite,
    cashflowNachSteuerJahr1,
    marktBenchmarkBruttorenditePct,
    nutzungsart,
  });
  const steuerAfa = computeSteuerAfaScore({ effectiveAfaRateJahr1, verlustZielkorridor, korridorNochVerfuegbar });
  const markt = computeMarktScore({ city, district, marktmieteAusgereizt });
  const risiko = computeRisikoScore({ zustandRisikoScore, instandhaltungsruecklageProM2, heizungsalterJahre });

  const total =
    finanziell.value * SCORE_WEIGHTS.finanziell +
    steuerAfa.value * SCORE_WEIGHTS.steuerAfa +
    markt.value * SCORE_WEIGHTS.markt +
    risiko.value * SCORE_WEIGHTS.risiko;

  const totalRounded = Math.round(total);

  return {
    total: totalRounded,
    isHot: totalRounded >= HOT_DEAL_SCORE_THRESHOLD,
    breakdown: { finanziell, steuerAfa, markt, risiko },
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

module.exports = {
  scaleScore,
  computeFinancialScore,
  computeSteuerAfaScore,
  computeMarktScore,
  computeRisikoScore,
  computeDealScore,
};
