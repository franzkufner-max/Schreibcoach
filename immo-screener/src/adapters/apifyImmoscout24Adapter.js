'use strict';

/**
 * ImmoScout24-Adapter über einen Apify-Actor (kommerzieller Datenanbieter,
 * kein direkter Scrape der Portalseite durch dieses Projekt).
 *
 * Benötigte Umgebungsvariablen:
 *   APIFY_TOKEN               API-Token aus dem Apify-Account
 *   APIFY_IMMOSCOUT24_ACTOR_ID  z.B. "username~actor-name" (siehe Apify Store)
 *
 * HINWEIS: Das genaue Input-/Output-Schema hängt vom konkret gewählten
 * Apify-Actor ab und muss beim Einrichten einmalig gegen die Actor-
 * Dokumentation abgeglichen werden (Feldnamen unten sind best-effort und
 * mit TODO markiert). Prüfe zusätzlich die Nutzungsbedingungen des
 * gewählten Actors/Anbieters.
 */

const APIFY_BASE_URL = 'https://api.apify.com/v2';

function buildActorInput({ city, priceMin, priceMax, roomsMin }) {
  // TODO: an das Input-Schema des konkret gewählten Actors anpassen.
  return {
    location: city,
    propertyType: 'apartmentBuy',
    priceMin,
    priceMax,
    roomsMin,
  };
}

/**
 * Bildet ein rohes Apify-Datensatzelement bestmöglich auf das
 * RawListing-Format ab. Unbekannte/fehlende Felder bleiben undefined —
 * die Pipeline markiert Listings mit fehlenden Pflichtfeldern automatisch
 * als "incomplete" statt sie falsch zu bewerten.
 */
function mapToRawListing(item, city) {
  return {
    id: `immoscout24-${item.id || item.expose_id || item.exposeId}`,
    source: 'immoscout24',
    url: item.url || item.expose_url || item.link,
    city,
    district: item.district || item.quarter,
    priceEUR: item.price ?? item.buyingPrice ?? item.kaufpreis,
    wohnflaecheM2: item.livingSpace ?? item.wohnflaeche ?? item.area,
    zimmer: item.rooms ?? item.numberOfRooms,
    baujahr: item.constructionYear ?? item.baujahr,
    kaltmieteMonatlich: undefined, // Kaufobjekte haben i.d.R. keine Kaltmiete im Exposé — ggf. manuell ergänzen
    balkonflaecheM2: item.hasBalcony ? item.balconyArea ?? 1 : undefined,
    mieterVorhandenOderSofortVermietbar: item.tenanted ?? undefined,
  };
}

/**
 * @param {{city:string, priceMin?:number, priceMax?:number, roomsMin?:number}} params
 * @returns {Promise<import('../models').RawListing[]>}
 */
async function fetchListings(params) {
  const token = process.env.APIFY_TOKEN;
  const actorId = process.env.APIFY_IMMOSCOUT24_ACTOR_ID;
  if (!token || !actorId) {
    throw new Error(
      'APIFY_TOKEN und/oder APIFY_IMMOSCOUT24_ACTOR_ID nicht gesetzt. Adapter kann nicht laufen — ' +
        'siehe README.md, Abschnitt "Scraper-Adapter einrichten".'
    );
  }

  const url = `${APIFY_BASE_URL}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(
    token
  )}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(buildActorInput(params)),
  });

  if (!res.ok) {
    throw new Error(`Apify-Request fehlgeschlagen: ${res.status} ${res.statusText} — ${await res.text()}`);
  }

  const items = await res.json();
  return items.map((item) => mapToRawListing(item, params.city));
}

module.exports = { fetchListings, name: 'immoscout24_apify' };
