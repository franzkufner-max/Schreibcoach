'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assessDeal } = require('../src/pipeline');
const sampleListings = require('../data/deals_raw.sample.json');

function findListing(id) {
  const l = sampleListings.find((x) => x.id === id);
  assert.ok(l, `Sample-Listing ${id} nicht gefunden`);
  return l;
}

test('assessDeal: Objekt mit hohem Grundstücksanteil wird hart ausgeschlossen', () => {
  const listing = findListing('demo-berlin-prenzlauerberg-hoher-grundanteil');
  const result = assessDeal(listing, { year: 2026 });
  assert.equal(result.incomplete, false);
  assert.equal(result.groundRatio.status, 'critical');
  assert.equal(result.hardFail, true);
  assert.equal(result.isHotDeal, false);
});

test('assessDeal: Objekt unter 50 m² wird über die Ausschlussliste erkannt', () => {
  const listing = findListing('demo-leipzig-ausschluss-mehrfach');
  const result = assessDeal(listing, { year: 2026 });
  assert.ok(result.exclusions.some((e) => e.key === 'wohnflaeche_unter_50'));
  assert.equal(result.hardFail, true);
});

test('assessDeal: vollständiges Altbau-Objekt liefert plausible Kennzahlen', () => {
  const listing = findListing('demo-berlin-friedrichshain-altbau-1');
  const result = assessDeal(listing, { year: 2026 });
  assert.equal(result.incomplete, false);
  assert.equal(result.rndGutachtenEmpfohlen, true);
  assert.ok(result.cashflow.bruttorendite > 0.03);
  assert.ok(result.taxLossYear1.verlustEUR > 0);
  assert.ok(result.score.total >= 0 && result.score.total <= 100);
});

test('assessDeal: unvollständiges Listing wird als incomplete markiert statt falsch bewertet', () => {
  const result = assessDeal({ id: 'x', source: 'manual', url: 'https://example.invalid' });
  assert.equal(result.incomplete, true);
  assert.ok(result.missingFields.length > 0);
  assert.equal(result.isHotDeal, false);
});

test('assessDeal: Portfolio-Korridor-Check greift, wenn Zustand übergeben wird', () => {
  const listing = findListing('demo-berlin-friedrichshain-altbau-1');
  const engerZustand = { purchases: {}, screenerAcquisitions: [{ year: 2026, verlustJahr1EUR: 19000 }] };
  const result = assessDeal(listing, { year: 2026, portfolioState: engerZustand });
  assert.ok(result.portfolioCheck);
  assert.equal(result.portfolioCheck.korridorAusreichend, false);
  assert.equal(result.hardFail, true);
});
