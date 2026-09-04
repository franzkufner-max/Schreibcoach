'use strict';

/**
 * Kleinanzeigen (ehem. eBay Kleinanzeigen) untersagt in seinen AGB explizit
 * das automatisierte Auslesen/Scraping der Plattform und bietet keine
 * öffentliche Such-API für Immobilienanzeigen an. Ein automatisierter
 * Scraper gegen kleinanzeigen.de würde die Nutzungsbedingungen verletzen —
 * dieses Projekt implementiert daher bewusst keinen solchen Adapter.
 *
 * Empfohlenes Vorgehen: Inserate manuell sichten und relevante Exposés über
 * `data/deals_raw.manual.json` (mock-Adapter-Format) einspeisen, oder einen
 * Datenanbieter mit nachgewiesener, lizenzierter Kleinanzeigen-Abdeckung
 * nutzen, sofern ein Nutzer einen solchen vertraglich einsetzt.
 */
async function fetchListings() {
  throw new Error(
    'kleinanzeigenAdapter ist ein Stub: automatisiertes Scraping von Kleinanzeigen verstößt gegen ' +
      'dessen AGB und wird hier nicht implementiert. Siehe README.md, Abschnitt ' +
      '"Datenquellen & rechtliche Hinweise".'
  );
}

module.exports = { fetchListings, name: 'kleinanzeigen' };
