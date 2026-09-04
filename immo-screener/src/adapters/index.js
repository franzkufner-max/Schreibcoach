'use strict';

/**
 * Adapter-Interface: jeder Adapter exportiert eine Funktion
 *   fetchListings({city, priceMin, priceMax, ...}) => Promise<RawListing[]>
 * die rohe Portaldaten in das models.js-RawListing-Format übersetzt.
 *
 * WICHTIG (rechtlich): Vor Nutzung jedes Adapters die AGB des jeweiligen
 * Portals bzw. Datenanbieters prüfen. ImmoScout24, Immowelt und
 * Kleinanzeigen untersagen in ihren Nutzungsbedingungen überwiegend das
 * automatisierte Auslesen (Scraping) der Website direkt. Dieses Projekt
 * implementiert deshalb bewusst KEINEN direkten HTML-Scraper gegen die
 * Portale, sondern eine Anbindung an kommerzielle Datenanbieter (z.B.
 * Apify-Actors, die eigene Lizenz-/Nutzungsbedingungen mit den Portalen
 * haben) — Nutzung erfolgt auf eigene Verantwortung und nur mit gültigem
 * Account/API-Key des jeweiligen Anbieters. Wo keine legale Datenquelle
 * bekannt ist (aktuell: Kleinanzeigen, Immowelt ohne Partner-API), bleibt
 * der Adapter ein Stub, der auf manuelle Dateneingabe verweist.
 */

const mockAdapter = require('./mockAdapter');
const apifyImmoscout24Adapter = require('./apifyImmoscout24Adapter');
const immoweltAdapter = require('./immoweltAdapter');
const kleinanzeigenAdapter = require('./kleinanzeigenAdapter');

const ADAPTERS = {
  mock: mockAdapter,
  immoscout24_apify: apifyImmoscout24Adapter,
  immowelt: immoweltAdapter,
  kleinanzeigen: kleinanzeigenAdapter,
};

function getAdapter(name) {
  const adapter = ADAPTERS[name];
  if (!adapter) {
    throw new Error(`Unbekannter Adapter "${name}". Verfügbar: ${Object.keys(ADAPTERS).join(', ')}`);
  }
  return adapter;
}

module.exports = { ADAPTERS, getAdapter };
