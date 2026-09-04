'use strict';

const { LOSS_TARGET_YEAR1, TAX_CONTEXT } = require('./config');

/**
 * Abschnitt 8 — Steuerliche Verlust-Prognose (Jahr 1).
 * Verlust = (AfA + Zinsen + nicht umlagefähige NK + Verwaltung) − Mieteinnahmen
 *
 * @param {Object} p
 * @param {number} p.afaJahr1EUR                 AfA-Betrag Jahr 1 (inkl. ggf. Sonder-AfA + Einrichtung)
 * @param {number} p.zinsenJahr1EUR
 * @param {number} p.nichtUmlagefaehigeNkEUR
 * @param {number} p.verwaltungEUR
 * @param {number} p.mieteinnahmenJahr1EUR        Jahreskaltmiete
 * @returns {{
 *   werbungskostenEUR:number, mieteinnahmenEUR:number, verlustEUR:number,
 *   zielkorridor: 'unter_ziel'|'ziel'|'ueber_ziel_korridorabhaengig'|'ausschluss',
 *   note:string
 * }}
 */
function computeTaxLossYear1({
  afaJahr1EUR,
  zinsenJahr1EUR,
  nichtUmlagefaehigeNkEUR,
  verwaltungEUR,
  mieteinnahmenJahr1EUR,
}) {
  const werbungskosten = afaJahr1EUR + zinsenJahr1EUR + nichtUmlagefaehigeNkEUR + verwaltungEUR;
  const verlust = werbungskosten - mieteinnahmenJahr1EUR;

  let zielkorridor;
  let note;
  if (verlust <= 0) {
    zielkorridor = 'unter_ziel';
    note = 'Kein steuerlicher Verlust im ersten Jahr — Steuerhebel ungenutzt.';
  } else if (verlust < LOSS_TARGET_YEAR1.minUseful) {
    zielkorridor = 'unter_ziel';
    note = `Verlust ${round2(verlust)} € unter Zielbereich (${LOSS_TARGET_YEAR1.minUseful}-${
      LOSS_TARGET_YEAR1.softMax
    } €) — Steuerhebel ungenutzt. Ablehnen.`;
  } else if (verlust <= LOSS_TARGET_YEAR1.softMax) {
    zielkorridor = 'ziel';
    note = `Verlust ${round2(verlust)} € im Zielbereich (${LOSS_TARGET_YEAR1.minUseful}-${
      LOSS_TARGET_YEAR1.softMax
    } €).`;
  } else if (verlust <= LOSS_TARGET_YEAR1.hardMax) {
    zielkorridor = 'ueber_ziel_korridorabhaengig';
    note = `Verlust ${round2(verlust)} € über Zielbereich, unter 20.000 € — nur zulässig, wenn Verlustkorridor (${
      TAX_CONTEXT.totalLossCorridorEURPerYear
    } €/Jahr) noch ausreicht.`;
  } else {
    zielkorridor = 'ausschluss';
    note = `Verlust ${round2(
      verlust
    )} € über 20.000 € — Ausschluss (Grenzsteuersatz sinkt, AfA entwertet sich selbst).`;
  }

  return {
    werbungskostenEUR: round2(werbungskosten),
    mieteinnahmenEUR: round2(mieteinnahmenJahr1EUR),
    verlustEUR: round2(verlust),
    zielkorridor,
    note,
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

module.exports = { computeTaxLossYear1 };
