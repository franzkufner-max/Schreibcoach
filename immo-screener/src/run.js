#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { getAdapter } = require('./adapters');
const { assessDeal } = require('./pipeline');
const { loadPortfolioState, DEFAULT_STATE_PATH } = require('./portfolio');
const { writeHotDeals } = require('./output/hotDealsTable');
const { writeMemo } = require('./output/memo');
const { sendHotDealsSummary } = require('./notify');
const { CITIES } = require('./config');

const SEEN_PATH = path.join(__dirname, '..', 'data', 'seen_hot_deal_ids.json');

function parseArgs(argv) {
  const args = { sources: ['mock'], cities: CITIES, notify: false, year: new Date().getFullYear() };
  for (const arg of argv) {
    if (arg.startsWith('--source=')) args.sources = arg.slice('--source='.length).split(',');
    else if (arg.startsWith('--cities=')) args.cities = arg.slice('--cities='.length).split(',');
    else if (arg === '--notify') args.notify = true;
    else if (arg.startsWith('--year=')) args.year = Number(arg.slice('--year='.length));
  }
  return args;
}

function loadSeenIds() {
  if (!fs.existsSync(SEEN_PATH)) return new Set();
  return new Set(JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8')));
}

function saveSeenIds(idsSet) {
  fs.mkdirSync(path.dirname(SEEN_PATH), { recursive: true });
  fs.writeFileSync(SEEN_PATH, JSON.stringify(Array.from(idsSet), null, 2) + '\n', 'utf8');
}

async function fetchAllListings(sources, cities) {
  const listings = [];
  for (const sourceName of sources) {
    const adapter = getAdapter(sourceName);
    for (const city of cities) {
      try {
        const cityListings = await adapter.fetchListings({ city });
        listings.push(...cityListings);
        console.log(`[${sourceName}] ${city}: ${cityListings.length} Listing(s)`);
      } catch (err) {
        console.warn(`[${sourceName}] ${city}: übersprungen — ${err.message}`);
      }
    }
  }
  return listings;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Immobilien-Deal-Screener — Quellen: ${args.sources.join(', ')} — Städte: ${args.cities.join(', ')}`);

  const portfolioState = fs.existsSync(DEFAULT_STATE_PATH) ? loadPortfolioState() : null;
  if (!portfolioState) {
    console.warn('Kein portfolio_state.json gefunden — Korridor-/Kauflimit-Check wird übersprungen.');
  }

  const listings = await fetchAllListings(args.sources, args.cities);
  console.log(`Insgesamt ${listings.length} Listing(s) geladen. Bewerte...`);

  const assessments = listings.map((listing) =>
    assessDeal(listing, { portfolioState: portfolioState || undefined, year: args.year })
  );

  const incomplete = assessments.filter((a) => a.incomplete);
  const evaluated = assessments.filter((a) => !a.incomplete);
  const hotDeals = evaluated.filter((a) => a.isHotDeal);

  console.log(
    `${incomplete.length} Listing(s) unvollständig (übersprungen), ${evaluated.length} bewertet, ${hotDeals.length} Hot Deal(s) (Score ≥ 70).`
  );

  if (hotDeals.length > 0) {
    const tableResult = writeHotDeals(hotDeals);
    console.log(`Hot_Deals-Tabelle aktualisiert: ${tableResult.totalCount} Einträge (${tableResult.jsonPath}).`);
    for (const a of hotDeals) {
      const memoPath = writeMemo(a);
      console.log(`Memo geschrieben: ${memoPath}`);
    }
  }

  if (args.notify) {
    const seenIds = loadSeenIds();
    const newHotDeals = hotDeals.filter((a) => !seenIds.has(a.listing.id));
    const result = await sendHotDealsSummary(newHotDeals);
    console.log('Notify-Ergebnis:', JSON.stringify(result));
    for (const a of hotDeals) seenIds.add(a.listing.id);
    saveSeenIds(seenIds);
  }

  console.log('Fertig. Erste Einschätzung, keine Steuerberatung.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

module.exports = { main, parseArgs };
