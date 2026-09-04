'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeTaxLossYear1 } = require('../src/taxLoss');

test('computeTaxLossYear1: Verlust im Zielbereich 6000-10000', () => {
  const result = computeTaxLossYear1({
    afaJahr1EUR: 9000,
    zinsenJahr1EUR: 9000,
    nichtUmlagefaehigeNkEUR: 600,
    verwaltungEUR: 400,
    mieteinnahmenJahr1EUR: 11000,
  });
  // Werbungskosten 19000 - Miete 11000 = 8000
  assert.equal(result.verlustEUR, 8000);
  assert.equal(result.zielkorridor, 'ziel');
});

test('computeTaxLossYear1: unter Zielbereich -> Steuerhebel ungenutzt', () => {
  const result = computeTaxLossYear1({
    afaJahr1EUR: 3000,
    zinsenJahr1EUR: 3000,
    nichtUmlagefaehigeNkEUR: 300,
    verwaltungEUR: 200,
    mieteinnahmenJahr1EUR: 5000,
  });
  assert.equal(result.zielkorridor, 'unter_ziel');
});

test('computeTaxLossYear1: über Zielbereich, unter 20000 -> korridorabhängig', () => {
  const result = computeTaxLossYear1({
    afaJahr1EUR: 12000,
    zinsenJahr1EUR: 6000,
    nichtUmlagefaehigeNkEUR: 800,
    verwaltungEUR: 400,
    mieteinnahmenJahr1EUR: 4000,
  });
  // Werbungskosten 19200 - 4000 = 15200
  assert.equal(result.verlustEUR, 15200);
  assert.equal(result.zielkorridor, 'ueber_ziel_korridorabhaengig');
});

test('computeTaxLossYear1: über 20000 -> Ausschluss', () => {
  const result = computeTaxLossYear1({
    afaJahr1EUR: 25000,
    zinsenJahr1EUR: 15000,
    nichtUmlagefaehigeNkEUR: 1000,
    verwaltungEUR: 500,
    mieteinnahmenJahr1EUR: 6000,
  });
  assert.equal(result.zielkorridor, 'ausschluss');
});
