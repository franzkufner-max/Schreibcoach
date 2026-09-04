'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeBruttorendite,
  computeKaufpreisfaktor,
  buildLoanSchedule,
  computeSteuereffekt,
} = require('../src/cashflow');

test('computeBruttorendite und computeKaufpreisfaktor', () => {
  assert.equal(computeBruttorendite(12000, 300000), 0.04);
  assert.equal(computeKaufpreisfaktor(300000, 12000), 25);
});

test('buildLoanSchedule: Zinsen sinken, Tilgung steigt bei Annuitätendarlehen', () => {
  const rows = buildLoanSchedule(200000, 0.04, 0.02, 5);
  assert.equal(rows.length, 5);
  assert.ok(rows[0].zinsEUR > rows[4].zinsEUR);
  assert.ok(rows[0].tilgungEUR < rows[4].tilgungEUR);
  assert.ok(rows[4].restschuldEUR < rows[0].restschuldEUR);
});

test('computeSteuereffekt: positiver Verlust -> positive Steuererstattung', () => {
  const effekt = computeSteuereffekt(8000, 0.38);
  assert.ok(Math.abs(effekt - 3040) < 0.01);
});

test('computeSteuereffekt: negativer Verlust (Gewinn) -> negativer Effekt (Steuerlast)', () => {
  const effekt = computeSteuereffekt(-2000, 0.38);
  assert.ok(effekt < 0);
});
