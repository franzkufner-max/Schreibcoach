'use strict';

const { RETURN_THRESHOLDS, TAX_CONTEXT } = require('./config');

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Bruttorendite = Jahreskaltmiete / Kaufpreis */
function computeBruttorendite(jahreskaltmieteEUR, kaufpreisEUR) {
  return kaufpreisEUR > 0 ? jahreskaltmieteEUR / kaufpreisEUR : null;
}

/** Kaufpreisfaktor = Kaufpreis / Jahreskaltmiete */
function computeKaufpreisfaktor(kaufpreisEUR, jahreskaltmieteEUR) {
  return jahreskaltmieteEUR > 0 ? kaufpreisEUR / jahreskaltmieteEUR : null;
}

/**
 * Annuitätendarlehen: baut einen Tilgungsplan über `years` Jahre.
 * Konstante Jahresannuität = Darlehen × (Zinssatz + Anfangstilgung).
 * @returns {Array<{jahr:number, zinsEUR:number, tilgungEUR:number, restschuldEUR:number}>}
 */
function buildLoanSchedule(darlehenEUR, zinssatz, anfangstilgung, years = 10) {
  const annuitaet = darlehenEUR * (zinssatz + anfangstilgung);
  const rows = [];
  let restschuld = darlehenEUR;
  for (let year = 1; year <= years; year++) {
    const zins = restschuld * zinssatz;
    const tilgung = Math.min(restschuld, annuitaet - zins);
    restschuld = Math.max(0, restschuld - tilgung);
    rows.push({ jahr: year, zinsEUR: round2(zins), tilgungEUR: round2(tilgung), restschuldEUR: round2(restschuld) });
  }
  return rows;
}

/**
 * Cashflow vor Tilgung (vor Steuern) für ein Jahr.
 */
function computeCashflowVorTilgungVorSteuern({
  mieteinnahmenEUR,
  zinsenEUR,
  nichtUmlagefaehigeNkEUR,
  verwaltungEUR,
  instandhaltungEUR,
}) {
  return round2(
    mieteinnahmenEUR -
      zinsenEUR -
      (nichtUmlagefaehigeNkEUR || 0) -
      (verwaltungEUR || 0) -
      (instandhaltungEUR || 0)
  );
}

/**
 * Steuereffekt = Verlust × persönlicher Grenzsteuersatz (positiver Wert =
 * Steuererstattung/-ersparnis; negativer Wert bei steuerlichem Gewinn).
 */
function computeSteuereffekt(verlustEUR, marginalTaxRate = TAX_CONTEXT.effectiveMarginalTaxRate + TAX_CONTEXT.kirchensteuerAddOn) {
  return round2(verlustEUR * marginalTaxRate);
}

/**
 * Vollständige Cashflow-Berechnung für ein Jahr inkl. Steuereffekt.
 */
function computeYearCashflow({
  mieteinnahmenEUR,
  zinsenEUR,
  nichtUmlagefaehigeNkEUR,
  verwaltungEUR,
  instandhaltungEUR,
  afaGesamtJahrEUR,
  marginalTaxRate,
}) {
  const cashflowVorSteuernVorTilgung = computeCashflowVorTilgungVorSteuern({
    mieteinnahmenEUR,
    zinsenEUR,
    nichtUmlagefaehigeNkEUR,
    verwaltungEUR,
    instandhaltungEUR,
  });
  const werbungskosten = afaGesamtJahrEUR + zinsenEUR + (nichtUmlagefaehigeNkEUR || 0) + (verwaltungEUR || 0);
  const steuerlicherVerlust = werbungskosten - mieteinnahmenEUR; // >0 = Verlust
  const steuereffekt = computeSteuereffekt(steuerlicherVerlust, marginalTaxRate);
  const cashflowNachSteuernVorTilgung = round2(cashflowVorSteuernVorTilgung + steuereffekt);

  return {
    cashflowVorSteuernVorTilgungEUR: cashflowVorSteuernVorTilgung,
    steuerlicherVerlustEUR: round2(steuerlicherVerlust),
    steuereffektEUR: steuereffekt,
    cashflowNachSteuernVorTilgungEUR: cashflowNachSteuernVorTilgung,
    cashflowNachSteuernVorTilgungEURProMonat: round2(cashflowNachSteuernVorTilgung / 12),
  };
}

/**
 * Baut Jahr-1- und Jahr-10-Cashflow sowie drei Standard-Sensitivitäten
 * (+1% Zinsen, -5% Miete, +20% Instandhaltung), angewendet auf Jahr 1.
 *
 * @param {Object} p
 * @param {number} p.kaufpreisEUR
 * @param {number} p.jahreskaltmieteEUR
 * @param {number} p.darlehenEUR
 * @param {number} p.zinssatz
 * @param {number} p.anfangstilgung
 * @param {number} p.nichtUmlagefaehigeNkEUR
 * @param {number} p.verwaltungEUR
 * @param {number} p.instandhaltungEUR
 * @param {Array<{afaGesamtEUR:number}>} p.buchwertTabelle 10-Jahres-AfA-Tabelle (aus afa.js)
 * @param {number} [p.marginalTaxRate]
 */
function computeFullCashflowAnalysis(p) {
  const {
    kaufpreisEUR,
    jahreskaltmieteEUR,
    darlehenEUR,
    zinssatz,
    anfangstilgung,
    nichtUmlagefaehigeNkEUR,
    verwaltungEUR,
    instandhaltungEUR,
    buchwertTabelle,
    marginalTaxRate,
  } = p;

  const loanSchedule = buildLoanSchedule(darlehenEUR, zinssatz, anfangstilgung, 10);
  const bruttorendite = computeBruttorendite(jahreskaltmieteEUR, kaufpreisEUR);
  const kaufpreisfaktor = computeKaufpreisfaktor(kaufpreisEUR, jahreskaltmieteEUR);

  const jahr1 = computeYearCashflow({
    mieteinnahmenEUR: jahreskaltmieteEUR,
    zinsenEUR: loanSchedule[0].zinsEUR,
    nichtUmlagefaehigeNkEUR,
    verwaltungEUR,
    instandhaltungEUR,
    afaGesamtJahrEUR: buchwertTabelle[0] ? buchwertTabelle[0].afaGesamtEUR : 0,
    marginalTaxRate,
  });

  const jahr10 = computeYearCashflow({
    mieteinnahmenEUR: jahreskaltmieteEUR, // konservativ: keine Mietsteigerung unterstellt
    zinsenEUR: loanSchedule[9].zinsEUR,
    nichtUmlagefaehigeNkEUR,
    verwaltungEUR,
    instandhaltungEUR,
    afaGesamtJahrEUR: buchwertTabelle[9] ? buchwertTabelle[9].afaGesamtEUR : 0,
    marginalTaxRate,
  });

  const sensitivities = {
    zinsPlus1Pct: computeYearCashflow({
      mieteinnahmenEUR: jahreskaltmieteEUR,
      zinsenEUR: darlehenEUR * (zinssatz + 0.01),
      nichtUmlagefaehigeNkEUR,
      verwaltungEUR,
      instandhaltungEUR,
      afaGesamtJahrEUR: buchwertTabelle[0] ? buchwertTabelle[0].afaGesamtEUR : 0,
      marginalTaxRate,
    }),
    mieteMinus5Pct: computeYearCashflow({
      mieteinnahmenEUR: jahreskaltmieteEUR * 0.95,
      zinsenEUR: loanSchedule[0].zinsEUR,
      nichtUmlagefaehigeNkEUR,
      verwaltungEUR,
      instandhaltungEUR,
      afaGesamtJahrEUR: buchwertTabelle[0] ? buchwertTabelle[0].afaGesamtEUR : 0,
      marginalTaxRate,
    }),
    instandhaltungPlus20Pct: computeYearCashflow({
      mieteinnahmenEUR: jahreskaltmieteEUR,
      zinsenEUR: loanSchedule[0].zinsEUR,
      nichtUmlagefaehigeNkEUR,
      verwaltungEUR,
      instandhaltungEUR: instandhaltungEUR * 1.2,
      afaGesamtJahrEUR: buchwertTabelle[0] ? buchwertTabelle[0].afaGesamtEUR : 0,
      marginalTaxRate,
    }),
  };

  return { bruttorendite, kaufpreisfaktor, loanSchedule, jahr1, jahr10, sensitivities };
}

/**
 * Prüft Renditemindestwerte (Abschnitt 2) gegen berechnete Kennzahlen.
 */
function checkReturnThresholds(nutzungsart, { bruttorendite, kaufpreisfaktor, jahr1, jahr10 }) {
  const t =
    nutzungsart === 'selbstnutzung_ab_2036'
      ? RETURN_THRESHOLDS.selbstnutzungAb2036
      : RETURN_THRESHOLDS.kapitalanlage;

  const checks = [];
  checks.push({
    key: 'bruttorendite',
    passed: bruttorendite !== null && bruttorendite >= t.bruttorenditeMin,
    detail: `${bruttorendite === null ? 'n/a' : (bruttorendite * 100).toFixed(2) + ' %'} (Min ${(
      t.bruttorenditeMin * 100
    ).toFixed(1)} %)`,
  });
  checks.push({
    key: 'kaufpreisfaktor',
    passed: kaufpreisfaktor !== null && kaufpreisfaktor <= t.kaufpreisfaktorMax,
    detail: `${kaufpreisfaktor === null ? 'n/a' : kaufpreisfaktor.toFixed(1)} (Max ${t.kaufpreisfaktorMax})`,
  });

  if (nutzungsart === 'selbstnutzung_ab_2036') {
    checks.push({
      key: 'cashflow_jahr1',
      passed: jahr1.cashflowNachSteuernVorTilgungEURProMonat >= t.cashflowJahr1MinEURProMonat,
      detail: `${jahr1.cashflowNachSteuernVorTilgungEURProMonat} €/Monat (Min ${t.cashflowJahr1MinEURProMonat} €/Monat)`,
    });
    checks.push({
      key: 'cashflow_jahr10',
      passed: jahr10.cashflowNachSteuernVorTilgungEURProMonat >= t.cashflowJahr10MinEURProMonat,
      detail: `${jahr10.cashflowNachSteuernVorTilgungEURProMonat} €/Monat (Min ${t.cashflowJahr10MinEURProMonat} €/Monat)`,
    });
  } else {
    checks.push({
      key: 'cashflow_jahr1',
      passed: jahr1.cashflowNachSteuernVorTilgungEUR >= t.cashflowJahr1MinEUR,
      detail: `${jahr1.cashflowNachSteuernVorTilgungEUR} € (Min ${t.cashflowJahr1MinEUR} €)`,
    });
    checks.push({
      key: 'cashflow_jahr10',
      passed: jahr10.cashflowNachSteuernVorTilgungEUR >= t.cashflowJahr10MinEUR,
      detail: `${jahr10.cashflowNachSteuernVorTilgungEUR} € (Min ${t.cashflowJahr10MinEUR} €)`,
    });
  }

  return { checks, allPassed: checks.every((c) => c.passed) };
}

module.exports = {
  computeBruttorendite,
  computeKaufpreisfaktor,
  buildLoanSchedule,
  computeCashflowVorTilgungVorSteuern,
  computeSteuereffekt,
  computeYearCashflow,
  computeFullCashflowAnalysis,
  checkReturnThresholds,
};
