'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runAusschlusspruefung, runSchnellpruefung, checkMussKriterien } = require('../src/quickcheck');

test('runAusschlusspruefung: Wohnfläche unter 50 m² wird ausgeschlossen', () => {
  const hits = runAusschlusspruefung({ wohnflaecheM2: 45 });
  assert.ok(hits.some((h) => h.key === 'wohnflaeche_unter_50'));
});

test('runAusschlusspruefung: §7b beworben ohne Nachweis wird ausgeschlossen', () => {
  const hits = runAusschlusspruefung({ wohnflaecheM2: 70, gtb7bBeworben: true });
  assert.ok(hits.some((h) => h.key === 'sonderafa_7b_ohne_nachweis'));
});

test('runAusschlusspruefung: §7b beworben mit Nachweis unter Grenze ist ok', () => {
  const hits = runAusschlusspruefung({
    wohnflaecheM2: 70,
    gtb7bBeworben: true,
    anschaffungskostenGebaeudeProM2: 4500,
    gebaeudeanteilAmKaufpreisPct: 0.8,
  });
  assert.ok(!hits.some((h) => h.key === 'sonderafa_7b_ohne_nachweis'));
});

test('runAusschlusspruefung: Verlust über 20000 nur mit übergebenem Wert ausgeschlossen', () => {
  const listing = { wohnflaecheM2: 70, gebaeudeanteilAmKaufpreisPct: 0.8 };
  assert.ok(!runAusschlusspruefung(listing, 15000).some((h) => h.key === 'verlust_ueber_20000'));
  assert.ok(runAusschlusspruefung(listing, 25000).some((h) => h.key === 'verlust_ueber_20000'));
});

test('runAusschlusspruefung: Kaufpreisaufteilung fehlt wird erkannt', () => {
  const hits = runAusschlusspruefung({ wohnflaecheM2: 70 });
  assert.ok(hits.some((h) => h.key === 'kaufpreisaufteilung_fehlt'));
});

test('runAusschlusspruefung: alte Anlagentechnik + niedrige Rücklage', () => {
  const hits = runAusschlusspruefung({
    wohnflaecheM2: 70,
    gebaeudeanteilAmKaufpreisPct: 0.8,
    heizungBaujahr: new Date().getFullYear() - 30,
    instandhaltungsruecklageEUR: 100,
  });
  assert.ok(hits.some((h) => h.key === 'anlagentechnik_alt_ruecklage_niedrig'));
});

test('runSchnellpruefung: läuft alle 6 Schritte durch', () => {
  const listing = {
    priceEUR: 300000,
    kaltmieteMonatlich: 900,
    innenflaecheM2: 70,
    baujahr: 1930,
    wohnflaecheM2: 72,
    gebaeudeanteilAmKaufpreisPct: 0.8,
  };
  const results = runSchnellpruefung(listing);
  assert.equal(results.length, 6);
  assert.equal(results[0].key, 'kaufpreisfaktor');
  assert.equal(results[5].key, 'cashflow');
});

test('checkMussKriterien: erkennt fehlende Muss-Kriterien', () => {
  const { checks, allPassed } = checkMussKriterien({ wohnflaecheM2: 40, zimmer: 1 });
  assert.equal(allPassed, false);
  assert.ok(checks.find((c) => c.key === 'wohnflaeche_min').passed === false);
});
