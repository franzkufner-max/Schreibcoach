'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  shouldRecommendRndGutachten,
  determineGebaeudeanteil,
  determineAfaVariants,
  computeAfaBasis,
  buildBuchwertTabelle,
  isWithinDegressiveWindow,
} = require('../src/afa');

test('isWithinDegressiveWindow: erkennt Fenster 01.10.2023-30.09.2029', () => {
  assert.equal(isWithinDegressiveWindow('2024-01-01'), true);
  assert.equal(isWithinDegressiveWindow('2023-09-30'), false);
  assert.equal(isWithinDegressiveWindow('2029-09-30'), true);
  assert.equal(isWithinDegressiveWindow('2029-10-01'), false);
  assert.equal(isWithinDegressiveWindow(undefined), false);
});

test('shouldRecommendRndGutachten: nur bei Altbau <1925, Mindestwerten, ohne Kernsanierung', () => {
  const base = { baujahr: 1910, priceEUR: 300000, kernsanierungLetzte15Jahre: false };
  assert.equal(shouldRecommendRndGutachten(base, 250000), true);
  assert.equal(shouldRecommendRndGutachten({ ...base, baujahr: 1930 }, 250000), false);
  assert.equal(shouldRecommendRndGutachten({ ...base, priceEUR: 100000 }, 250000), false);
  assert.equal(shouldRecommendRndGutachten(base, 150000), false);
  assert.equal(shouldRecommendRndGutachten({ ...base, kernsanierungLetzte15Jahre: true }, 250000), false);
});

test('determineGebaeudeanteil: Priorität Vertrag > Bodenrichtwert > Schätzung', () => {
  const explicit = determineGebaeudeanteil({ gebaeudeanteilAmKaufpreisPct: 0.8 }, null);
  assert.equal(explicit.value, 0.8);
  assert.equal(explicit.assumption, false);

  const fromGround = determineGebaeudeanteil({}, { available: true, groundRatio: 0.3 });
  assert.equal(fromGround.value, 0.7);
  assert.equal(fromGround.assumption, false);

  const fallback = determineGebaeudeanteil({}, { available: false, groundRatio: null });
  assert.equal(fallback.value, 0.75);
  assert.equal(fallback.assumption, true);
});

test('determineAfaVariants: Altbau vor 1925 liefert pauschal + RND-Variante', () => {
  const variants = determineAfaVariants({ baujahr: 1910, istNeubauOderErsterwerb: false });
  const keys = variants.map((v) => v.key);
  assert.ok(keys.includes('altbau_pauschal_2_5'));
  assert.ok(keys.includes('altbau_rnd_gutachten'));
  const pauschal = variants.find((v) => v.key === 'altbau_pauschal_2_5');
  assert.equal(pauschal.rate, 0.025);
});

test('determineAfaVariants: Bestand 1925-2022 liefert 2%-Variante unter Mindestsatz', () => {
  const variants = determineAfaVariants({ baujahr: 1990, istNeubauOderErsterwerb: false });
  assert.equal(variants.length, 1);
  assert.equal(variants[0].rate, 0.02);
});

test('determineAfaVariants: Neubau im Förderfenster liefert degressiv 5% + linear 3%', () => {
  const variants = determineAfaVariants({
    istNeubauOderErsterwerb: true,
    baubeginnOderKaufvertragDatum: '2024-06-01',
  });
  const keys = variants.map((v) => v.key);
  assert.ok(keys.includes('neubau_degressiv_5a'));
  assert.ok(keys.includes('neubau_linear_3pct'));
});

test('determineAfaVariants: §7b beworben ohne Nachweis -> Sonder-AfA nicht anwendbar markiert', () => {
  const variants = determineAfaVariants({
    istNeubauOderErsterwerb: true,
    baubeginnOderKaufvertragDatum: '2024-06-01',
    gtb7bBeworben: true,
  });
  const linear = variants.find((v) => v.key === 'neubau_linear_3pct');
  assert.equal(linear.sonderAfaEligible, false);
  assert.match(linear.notes, /AUSSCHLUSS-VERDACHT/);
});

test('determineAfaVariants: §7b beworben mit gültigem Nachweis -> Sonder-AfA möglich', () => {
  const variants = determineAfaVariants({
    istNeubauOderErsterwerb: true,
    baubeginnOderKaufvertragDatum: '2024-06-01',
    gtb7bBeworben: true,
    anschaffungskostenGebaeudeProM2: 4800,
  });
  const linear = variants.find((v) => v.key === 'neubau_linear_3pct');
  assert.equal(linear.sonderAfaEligible, true);
});

test('computeAfaBasis: Gebäudeanteil + anteilige Nebenkosten, Einrichtung separat', () => {
  const listing = { priceEUR: 300000, einbaukuecheWertEUR: 8000, moeblierungWertEUR: 2000 };
  const result = computeAfaBasis(listing, 0.8, 30000);
  assert.equal(result.gebaeudewertKaufpreisEUR, 240000);
  assert.equal(result.anteiligeNebenkostenEUR, 24000);
  assert.equal(result.afaBasisEUR, 264000);
  assert.equal(result.furnitureValueEUR, 10000);
  assert.equal(result.furnitureAfaPerYearEUR, 1000); // 10 Jahre
});

test('buildBuchwertTabelle: linear AfA bleibt über 10 Jahre konstant', () => {
  const variant = { rate: 0.03, type: 'linear', sonderAfaEligible: false };
  const rows = buildBuchwertTabelle(300000, variant, 10);
  assert.equal(rows.length, 10);
  assert.equal(rows[0].afaBetragEUR, 9000);
  assert.equal(rows[9].afaBetragEUR, 9000);
  assert.equal(rows[9].kumulierteAfaEUR, 90000);
});

test('buildBuchwertTabelle: degressive AfA sinkt auf Restbuchwert', () => {
  const variant = { rate: 0.05, type: 'degressiv', sonderAfaEligible: false };
  const rows = buildBuchwertTabelle(200000, variant, 3);
  assert.equal(rows[0].afaBetragEUR, 10000); // 5% von 200000
  assert.equal(rows[0].restbuchwertJahresendeEUR, 190000);
  assert.equal(rows[1].afaBetragEUR, 9500); // 5% von 190000
  assert.ok(rows[2].afaBetragEUR < rows[1].afaBetragEUR);
});

test('buildBuchwertTabelle: Sonder-AfA §7b nur in den ersten 4 Jahren addiert', () => {
  const variant = { rate: 0.03, type: 'linear', sonderAfaEligible: true };
  const rows = buildBuchwertTabelle(300000, variant, 6);
  assert.equal(rows[0].sonderAfaBetragEUR, 15000); // 5% von 300000
  assert.equal(rows[3].sonderAfaBetragEUR, 15000);
  assert.equal(rows[4].sonderAfaBetragEUR, 0);
  assert.equal(rows[0].afaGesamtEUR, 9000 + 15000);
});
