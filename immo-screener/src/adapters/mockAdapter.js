'use strict';

const fs = require('fs');
const path = require('path');

const SAMPLE_PATH = path.join(__dirname, '..', '..', 'data', 'deals_raw.sample.json');

/**
 * Test-/Demo-Adapter: liest Beispiel-Listings aus data/deals_raw.sample.json.
 * Nützlich für Trockenläufe der Pipeline ohne Portal-/API-Zugang.
 * @param {{city?: string}} params
 * @returns {Promise<import('../models').RawListing[]>}
 */
async function fetchListings(params = {}) {
  const raw = fs.readFileSync(SAMPLE_PATH, 'utf8');
  const listings = JSON.parse(raw);
  return params.city ? listings.filter((l) => l.city === params.city) : listings;
}

module.exports = { fetchListings, name: 'mock' };
