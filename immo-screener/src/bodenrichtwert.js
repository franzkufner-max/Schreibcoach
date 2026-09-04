'use strict';

const { GROUND_RATIO_LIMITS } = require('./config');

/**
 * Berechnet den Grundstücksanteil (ground_ratio) eines Objekts am Kaufpreis.
 *
 * Bodenwert = Grundstücksfläche × Bodenrichtwert × Miteigentumsanteil
 *
 * Der Bodenrichtwert selbst kommt NICHT aus einer öffentlichen API — BORIS
 * Berlin und bodenrichtwerte.bayern.de bieten keine offene, automatisiert
 * abfragbare Schnittstelle für Massenabfragen an. Der Wert muss pro Objekt
 * manuell recherchiert werden (Adresse/Flurstück in BORIS Berlin bzw. im
 * BayernAtlas nachschlagen) und als `bodenrichtwertEURProM2` im Listing
 * hinterlegt werden. Diese Funktion liefert nur die Berechnung + Bewertung.
 *
 * @param {import('./models').RawListing} listing
 * @returns {{
 *   available: boolean,
 *   bodenwertEUR: number|null,
 *   groundRatio: number|null,
 *   status: 'ok'|'warn'|'critical'|'unknown',
 *   note: string
 * }}
 */
function assessGroundRatio(listing) {
  const {
    grundstuecksflaecheM2,
    bodenrichtwertEURProM2,
    miteigentumsanteilZaehler,
    miteigentumsanteilNenner,
    priceEUR,
  } = listing;

  if (!grundstuecksflaecheM2 || !bodenrichtwertEURProM2 || !priceEUR) {
    return {
      available: false,
      bodenwertEUR: null,
      groundRatio: null,
      status: 'unknown',
      note:
        'Bodenrichtwert/Grundstücksfläche fehlt. Vor Kauf zwingend über BORIS Berlin ' +
        '(https://www.stadtentwicklung.berlin.de/geoinformation/bodenrichtwerte/) bzw. ' +
        'bodenrichtwerte.bayern.de recherchieren.',
    };
  }

  const mea =
    miteigentumsanteilZaehler && miteigentumsanteilNenner
      ? miteigentumsanteilZaehler / miteigentumsanteilNenner
      : 1;

  const bodenwertEUR = grundstuecksflaecheM2 * bodenrichtwertEURProM2 * mea;
  const groundRatio = bodenwertEUR / priceEUR;

  let status = 'ok';
  let note = `Grundstücksanteil ${(groundRatio * 100).toFixed(1)} % — im grünen Bereich (≤ ${
    GROUND_RATIO_LIMITS.softWarn * 100
  } %).`;

  if (groundRatio > GROUND_RATIO_LIMITS.hardMax) {
    status = 'critical';
    note = `Grundstücksanteil ${(groundRatio * 100).toFixed(1)} % > ${
      GROUND_RATIO_LIMITS.hardMax * 100
    } % (hart). Rendite neu rechnen bzw. Objekt kritisch prüfen — AfA-Basis stark reduziert.`;
  } else if (groundRatio > GROUND_RATIO_LIMITS.softWarn) {
    status = 'warn';
    note = `Grundstücksanteil ${(groundRatio * 100).toFixed(1)} % > ${
      GROUND_RATIO_LIMITS.softWarn * 100
    } % (weich) — kritisch markiert, im Detail prüfen.`;
  }

  return { available: true, bodenwertEUR, groundRatio, status, note };
}

module.exports = { assessGroundRatio };
