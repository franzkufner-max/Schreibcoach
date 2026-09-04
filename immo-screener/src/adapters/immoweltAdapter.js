'use strict';

/**
 * Immowelt hat keine öffentlich dokumentierte, frei nutzbare Such-API und
 * untersagt automatisiertes Auslesen der Website in den AGB. Dieses Projekt
 * implementiert deshalb keinen direkten Scraper gegen immowelt.de.
 *
 * Optionen für eine legale Anbindung (vom Nutzer zu prüfen/abzuschließen):
 *  - Kommerzielle Datenanbieter mit Immowelt-Abdeckung (z.B. Piloterr,
 *    RealtyAPI, o.ä.) — sofern deren Lizenz die Weiterverarbeitung erlaubt.
 *  - Manuelle Eingabe einzelner Exposés über `data/deals_raw.manual.json`
 *    und den `mock`-Adapter (siehe README).
 *
 * Sobald ein konkreter, lizenzierter Anbieter feststeht, kann dieser Adapter
 * analog zu adapters/apifyImmoscout24Adapter.js implementiert werden.
 */
async function fetchListings() {
  throw new Error(
    'immoweltAdapter ist ein Stub: keine legale automatisierte Datenquelle konfiguriert. ' +
      'Siehe README.md, Abschnitt "Datenquellen & rechtliche Hinweise".'
  );
}

module.exports = { fetchListings, name: 'immowelt' };
