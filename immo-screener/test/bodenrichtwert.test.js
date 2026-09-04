'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assessGroundRatio } = require('../src/bodenrichtwert');

test('assessGroundRatio: unknown status wenn Daten fehlen', () => {
  const result = assessGroundRatio({ priceEUR: 300000 });
  assert.equal(result.available, false);
  assert.equal(result.status, 'unknown');
});

test('assessGroundRatio: ok status bei niedrigem Grundstücksanteil', () => {
  const result = assessGroundRatio({
    priceEUR: 300000,
    grundstuecksflaecheM2: 300,
    bodenrichtwertEURProM2: 500,
    miteigentumsanteilZaehler: 50,
    miteigentumsanteilNenner: 1000,
  });
  // Bodenwert = 300 * 500 * 0.05 = 7500 -> ratio = 2.5%
  assert.equal(result.available, true);
  assert.equal(result.bodenwertEUR, 7500);
  assert.ok(Math.abs(result.groundRatio - 0.025) < 1e-9);
  assert.equal(result.status, 'ok');
});

test('assessGroundRatio: warn status zwischen 30% und 35%', () => {
  const result = assessGroundRatio({
    priceEUR: 100000,
    grundstuecksflaecheM2: 100,
    bodenrichtwertEURProM2: 320,
    miteigentumsanteilZaehler: 1,
    miteigentumsanteilNenner: 1,
  });
  // Bodenwert = 32000 -> ratio 32%
  assert.equal(result.status, 'warn');
});

test('assessGroundRatio: critical status über 35%', () => {
  const result = assessGroundRatio({
    priceEUR: 100000,
    grundstuecksflaecheM2: 100,
    bodenrichtwertEURProM2: 400,
    miteigentumsanteilZaehler: 1,
    miteigentumsanteilNenner: 1,
  });
  // Bodenwert = 40000 -> ratio 40%
  assert.equal(result.status, 'critical');
});

test('assessGroundRatio: Miteigentumsanteil default 1 wenn nicht angegeben', () => {
  const result = assessGroundRatio({
    priceEUR: 100000,
    grundstuecksflaecheM2: 50,
    bodenrichtwertEURProM2: 200,
  });
  // Bodenwert = 50 * 200 * 1 = 10000 -> ratio 10%
  assert.equal(result.bodenwertEUR, 10000);
  assert.equal(result.status, 'ok');
});
