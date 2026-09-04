'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { scaleScore, computeDealScore } = require('../src/scoring');

test('scaleScore: 0/50/100 an den Ankerpunkten', () => {
  assert.equal(scaleScore(5, 5, 10, 20), 0);
  assert.equal(scaleScore(10, 5, 10, 20), 50);
  assert.equal(scaleScore(20, 5, 10, 20), 100);
  assert.equal(scaleScore(2, 5, 10, 20), 0);
  assert.equal(scaleScore(30, 5, 10, 20), 100);
});

test('scaleScore: unbekannter Wert liefert neutrale 50 Punkte', () => {
  assert.equal(scaleScore(null, 0, 1, 2), 50);
  assert.equal(scaleScore(undefined, 0, 1, 2), 50);
});

test('computeDealScore: starkes Objekt erreicht Hot-Deal-Schwelle', () => {
  const score = computeDealScore({
    bruttorendite: 0.045,
    cashflowNachSteuerJahr1: 2000,
    marktBenchmarkBruttorenditePct: 0.03,
    nutzungsart: 'kapitalanlage',
    effectiveAfaRateJahr1: 0.05,
    verlustZielkorridor: 'ziel',
    korridorNochVerfuegbar: true,
    city: 'Berlin',
    district: 'Prenzlauer Berg',
    marktmieteAusgereizt: false,
    zustandRisikoScore: 1,
    instandhaltungsruecklageProM2: 20,
    heizungsalterJahre: 2,
  });
  assert.ok(score.total >= 70, `Score war ${score.total}, erwartet >= 70`);
  assert.equal(score.isHot, true);
});

test('computeDealScore: schwaches Objekt bleibt unter der Schwelle', () => {
  const score = computeDealScore({
    bruttorendite: 0.02,
    cashflowNachSteuerJahr1: -1500,
    marktBenchmarkBruttorenditePct: 0.035,
    nutzungsart: 'kapitalanlage',
    effectiveAfaRateJahr1: 0.02,
    verlustZielkorridor: 'unter_ziel',
    korridorNochVerfuegbar: true,
    city: 'Leipzig',
    district: null,
    marktmieteAusgereizt: true,
    zustandRisikoScore: 8,
    instandhaltungsruecklageProM2: 3,
    heizungsalterJahre: 28,
  });
  assert.ok(score.total < 70, `Score war ${score.total}, erwartet < 70`);
  assert.equal(score.isHot, false);
});

test('computeDealScore: Gesamtscore bleibt im Bereich 0-100', () => {
  const score = computeDealScore({
    bruttorendite: null,
    cashflowNachSteuerJahr1: null,
    nutzungsart: 'kapitalanlage',
    effectiveAfaRateJahr1: null,
    verlustZielkorridor: 'ausschluss',
    korridorNochVerfuegbar: false,
    city: 'Unbekannt',
    zustandRisikoScore: 10,
    instandhaltungsruecklageProM2: 0,
    heizungsalterJahre: 40,
  });
  assert.ok(score.total >= 0 && score.total <= 100);
});
