'use strict';

const fs = require('fs');
const path = require('path');
const { TAX_CONTEXT } = require('./config');

const DEFAULT_STATE_PATH = path.join(__dirname, '..', 'data', 'portfolio_state.json');

function loadPortfolioState(statePath = DEFAULT_STATE_PATH) {
  const raw = fs.readFileSync(statePath, 'utf8');
  return JSON.parse(raw);
}

function savePortfolioState(state, statePath = DEFAULT_STATE_PATH) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

/**
 * Abschnitt 5 — Portfoliogrenzen.
 *  - Höchstens ein Kauf pro Jahr.
 *  - Verlustkorridor gesamt 20.000 €/Jahr über alle (durch den Screener
 *    getätigten) Neu-Objekte hinweg.
 *
 * @param {Object} state Portfolio-Zustand (data/portfolio_state.json)
 * @param {number} year Kalenderjahr des geplanten Kaufs
 * @param {number} geplanterVerlustEUR Steuerlicher Verlust Jahr 1 des neuen Objekts
 */
function checkPortfolioConstraints(state, year, geplanterVerlustEUR) {
  const purchasesThisYear = state.purchases?.[year] || 0;
  const maxPurchasesReached = purchasesThisYear >= TAX_CONTEXT.maxPurchasesPerYear;

  const verbrauchterKorridor = (state.screenerAcquisitions || [])
    .filter((a) => a.year === year)
    .reduce((sum, a) => sum + (a.verlustJahr1EUR || 0), 0);

  const verbleibenderKorridor = TAX_CONTEXT.totalLossCorridorEURPerYear - verbrauchterKorridor;
  const korridorAusreichend = geplanterVerlustEUR <= verbleibenderKorridor;

  return {
    maxPurchasesReached,
    purchasesThisYear,
    verbrauchterKorridorEUR: round2(verbrauchterKorridor),
    verbleibenderKorridorEUR: round2(verbleibenderKorridor),
    korridorAusreichend,
    zulaessig: !maxPurchasesReached && korridorAusreichend,
    note: maxPurchasesReached
      ? `Bereits ${purchasesThisYear} Kauf/Käufe in ${year} — max. ${TAX_CONTEXT.maxPurchasesPerYear} pro Jahr.`
      : korridorAusreichend
      ? `Korridor ausreichend: ${round2(geplanterVerlustEUR)} € ≤ verbleibende ${round2(
          verbleibenderKorridor
        )} €.`
      : `Korridor nicht ausreichend: ${round2(geplanterVerlustEUR)} € > verbleibende ${round2(
          verbleibenderKorridor
        )} €.`,
  };
}

/**
 * Registriert einen tatsächlich getätigten Kauf im Portfolio-Zustand
 * (wird NICHT automatisch von der Screening-Pipeline aufgerufen — ein Kauf
 * ist eine bewusste, manuelle Entscheidung).
 */
function registerAcquisition(state, { id, year, city, priceEUR, verlustJahr1EUR, url }) {
  state.purchases = state.purchases || {};
  state.purchases[year] = (state.purchases[year] || 0) + 1;
  state.screenerAcquisitions = state.screenerAcquisitions || [];
  state.screenerAcquisitions.push({ id, year, city, priceEUR, verlustJahr1EUR, url, registeredAt: new Date().toISOString() });
  return state;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

module.exports = {
  DEFAULT_STATE_PATH,
  loadPortfolioState,
  savePortfolioState,
  checkPortfolioConstraints,
  registerAcquisition,
};
