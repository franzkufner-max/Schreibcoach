'use strict';

/**
 * Zentrale Konfiguration des Immobilien-Deal-Screeners.
 * Alle Werte stammen aus dem steuerlichen Prüfraster des Nutzers (ESt-Bescheid 2025).
 *
 * RECHTLICHER HINWEIS: Alle steuerlichen Aussagen sind eine erste Einschätzung,
 * keine Steuerberatung. §7b- und Restnutzungsdauer-Fragen gehören vor jedem Kauf
 * vor den Steuerberater.
 */

const TAX_CONTEXT = {
  zvE2025: 136658,
  marginalTaxRateAtBescheid: 0.42,
  zvEAfterCurrentLosses: 105000,
  effectiveMarginalTaxRate: 0.36, // + Kirchensteuer
  kirchensteuerAddOn: 0.02,
  kinderfreibetragKipppunktZvE: 80000,
  totalLossCorridorEURPerYear: 20000,
  maxPurchasesPerYear: 1,
};

const CITIES = ['Berlin', 'Leipzig', 'Regensburg'];

// Nebenkostenquoten (Kaufnebenkosten) je Region, aus Abschnitt 2
const ACQUISITION_COST_RATES = {
  Berlin: { grESt: 0.06, notarGrundbuch: 0.02, makler: 0.0357, total: 0.1157 },
  Leipzig: { grESt: 0.035, notarGrundbuch: 0.02, makler: 0.0357, total: 0.0907 },
  Regensburg: { grESt: 0.035, notarGrundbuch: 0.02, makler: 0.0357, total: 0.0907 },
  _default: { grESt: 0.05, notarGrundbuch: 0.02, makler: 0.0357, total: 0.1057 },
};

// Abschnitt 1.1 – Steuerlicher Verlust pro Objekt (Jahr 1)
const LOSS_TARGET_YEAR1 = {
  minUseful: 6000, // darunter: Steuerhebel ungenutzt
  softMax: 10000, // 10-20k: nur wenn Korridor ausreicht
  hardMax: 20000, // darüber: Ausschluss
};

// Abschnitt 1.2 – AfA-Sätze
const AFA_RATES = {
  altbauVor1925Pauschal: 0.025,
  altbauVor1925MitGutachten: 0.03, // Zielbereich 3.0-3.5%, konservativ 3.0% als Basiswert
  altbauVor1925MitGutachtenMax: 0.035,
  bestandAb1925: 0.02,
  neubauLinearAb2023: 0.03,
  neubauDegressiv: 0.05, // §7 Abs. 5a EStG, auf Restbuchwert
  sonderAfa7b: 0.05, // p.a., erste 4 Jahre, on top of linearer AfA
  gewerbe: 0.03,
  minAcceptable: 0.03,
};

const SONDERAFA_7B = {
  years: 4,
  baukostengrenzeEURProM2: 5200,
  vertragBeginFrom: '2023-01-01',
};

const DEGRESSIVE_5A_WINDOW = {
  from: '2023-10-01',
  to: '2029-09-30',
};

// Abschnitt 1.2 – Restnutzungsdauer-Gutachten
const RND_GUTACHTEN = {
  costEUR: 1500,
  minKaufpreisEUR: 250000,
  minGebaeudewertEUR: 200000,
  maxJahreSeitKernsanierung: 15,
  afaOhneGutachten: 0.025,
  afaMitGutachtenMin: 0.03,
  afaMitGutachtenMax: 0.033,
};

// Abschnitt 1.3 – Grundstücksanteil
const GROUND_RATIO_LIMITS = {
  hardMax: 0.35,
  softWarn: 0.3,
};

// Abschnitt 1.4 – Einrichtung
const FURNITURE_AFA_YEARS = 10;
const BUILDING_AFA_YEARS_FALLBACK = 40; // grobe Fallback-Nutzungsdauer für "33-50 Jahre"-Vergleich

// Abschnitt 2 – Renditemindestwerte
const RETURN_THRESHOLDS = {
  kapitalanlage: {
    bruttorenditeMin: 0.032,
    kaufpreisfaktorMax: 31,
    cashflowJahr1MinEUR: 0,
    cashflowJahr10MinEUR: 0,
    eigenkapitalMin: 0.15,
    eigenkapitalMax: 0.2,
  },
  selbstnutzungAb2036: {
    bruttorenditeMin: 0.027,
    kaufpreisfaktorMax: 37,
    cashflowJahr1MinEURProMonat: -150,
    cashflowJahr10MinEURProMonat: -250,
    eigenkapitalMin: 0.2,
  },
};

// Abschnitt 3 – Objektkriterien (Muss)
const OBJECT_CRITERIA = {
  minWohnflaecheM2: 65,
  minZimmer: 2,
  balkonAnrechnungMin: 0.25,
  balkonAnrechnungMax: 0.5,
  maxHeizungsalterJahre: 20,
  minInstandhaltungsruecklageEURProM2: 15,
  sollBaujahrVor: 1925,
  sollBaujahrAb: 2015,
  selbstnutzung: {
    minWohnflaecheM2: 75,
    bezirke: ['Prenzlauer Berg', 'Mitte', 'Friedrichshain'],
    umwandlungMindestjahre: 10, // §577a BGB Kündigungssperrfrist
  },
};

// Abschnitt 4 – Ausschlusskriterien (harte K.O.-Kriterien)
const EXCLUSION_MIN_WOHNFLAECHE_M2 = 50;

// Abschnitt 10 – Deal-Score Gewichtung
const SCORE_WEIGHTS = {
  finanziell: 0.35,
  steuerAfa: 0.3,
  markt: 0.2,
  risiko: 0.15,
};
const HOT_DEAL_SCORE_THRESHOLD = 70;

const DISCLAIMER =
  'Erste Einschätzung, keine Steuerberatung. §7b- und Restnutzungsdauer-Fragen ' +
  'vor jedem Kauf mit dem Steuerberater klären.';

module.exports = {
  TAX_CONTEXT,
  CITIES,
  ACQUISITION_COST_RATES,
  LOSS_TARGET_YEAR1,
  AFA_RATES,
  SONDERAFA_7B,
  DEGRESSIVE_5A_WINDOW,
  RND_GUTACHTEN,
  GROUND_RATIO_LIMITS,
  FURNITURE_AFA_YEARS,
  BUILDING_AFA_YEARS_FALLBACK,
  RETURN_THRESHOLDS,
  OBJECT_CRITERIA,
  EXCLUSION_MIN_WOHNFLAECHE_M2,
  SCORE_WEIGHTS,
  HOT_DEAL_SCORE_THRESHOLD,
  DISCLAIMER,
};
