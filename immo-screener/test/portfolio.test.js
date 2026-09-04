'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { checkPortfolioConstraints } = require('../src/portfolio');

test('checkPortfolioConstraints: erster Kauf im Jahr mit ausreichendem Korridor ist zulässig', () => {
  const state = { purchases: {}, screenerAcquisitions: [] };
  const result = checkPortfolioConstraints(state, 2026, 9000);
  assert.equal(result.zulaessig, true);
  assert.equal(result.verbleibenderKorridorEUR, 20000);
});

test('checkPortfolioConstraints: zweiter Kauf im selben Jahr wird abgelehnt (max 1/Jahr)', () => {
  const state = { purchases: { 2026: 1 }, screenerAcquisitions: [] };
  const result = checkPortfolioConstraints(state, 2026, 5000);
  assert.equal(result.maxPurchasesReached, true);
  assert.equal(result.zulaessig, false);
});

test('checkPortfolioConstraints: Korridor wird durch bestehende Screener-Käufe reduziert', () => {
  const state = {
    purchases: {},
    screenerAcquisitions: [{ year: 2026, verlustJahr1EUR: 15000 }],
  };
  const result = checkPortfolioConstraints(state, 2026, 8000);
  assert.equal(result.verbleibenderKorridorEUR, 5000);
  assert.equal(result.korridorAusreichend, false);
  assert.equal(result.zulaessig, false);
});
