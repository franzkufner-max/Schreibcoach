'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_JSON_PATH = path.join(__dirname, '..', '..', 'data', 'hot_deals.json');
const DEFAULT_CSV_PATH = path.join(__dirname, '..', '..', 'data', 'hot_deals.csv');

function toRow(assessment) {
  const l = assessment.listing;
  const cf = assessment.cashflow;
  return {
    id: l.id,
    url: l.url,
    stadt: l.city,
    bezirk: l.district || '',
    preisEUR: l.priceEUR,
    kaltmieteMonatlichEUR: l.kaltmieteMonatlich,
    bruttorenditePct: cf.bruttorendite === null ? '' : round2(cf.bruttorendite * 100),
    cashflowVorSteuernJahr1EUR: cf.jahr1.cashflowVorSteuernVorTilgungEUR,
    cashflowNachSteuernJahr1EUR: cf.jahr1.cashflowNachSteuernVorTilgungEUR,
    afaVariante: assessment.afa.primaryVariantKey,
    afaSatzJahr1Pct: assessment.afa.effectiveAfaRateJahr1 === null ? '' : round2(assessment.afa.effectiveAfaRateJahr1 * 100),
    steuerlicherVerlustJahr1EUR: assessment.taxLossYear1.verlustEUR,
    score: assessment.score.total,
    begruendung: buildBegruendung(assessment),
    generiertAm: assessment.generatedAt,
  };
}

function buildBegruendung(assessment) {
  const l = assessment.listing;
  const cf = assessment.cashflow;
  const parts = [];
  parts.push(
    `${l.city}${l.district ? ' / ' + l.district : ''}, ${l.priceEUR.toLocaleString('de-DE')} € für ${l.wohnflaecheM2} m².`
  );
  parts.push(
    `Bruttorendite ${cf.bruttorendite === null ? 'n/a' : (cf.bruttorendite * 100).toFixed(2) + ' %'}, Kaufpreisfaktor ${
      cf.kaufpreisfaktor === null ? 'n/a' : cf.kaufpreisfaktor.toFixed(1)
    }.`
  );
  parts.push(
    `AfA-Variante "${assessment.afa.primaryVariantKey}" mit effektiv ${
      assessment.afa.effectiveAfaRateJahr1 === null ? 'n/a' : (assessment.afa.effectiveAfaRateJahr1 * 100).toFixed(1) + ' %'
    } im ersten Jahr.`
  );
  parts.push(`Steuerlicher Verlust Jahr 1: ${assessment.taxLossYear1.verlustEUR.toLocaleString('de-DE')} € (${assessment.taxLossYear1.zielkorridor}).`);
  parts.push(`Deal-Score ${assessment.score.total}/100.`);
  return parts.join(' ');
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toCsv(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h] ?? '')).join(','));
  }
  return lines.join('\n') + '\n';
}

/**
 * Schreibt/aktualisiert die Hot_Deals-Tabelle (JSON + CSV) mit den
 * übergebenen "heißen" DealAssessments. Bestehende Einträge mit gleicher
 * `id` werden ersetzt (Dedupe), neue angehängt.
 */
function writeHotDeals(hotAssessments, { jsonPath = DEFAULT_JSON_PATH, csvPath = DEFAULT_CSV_PATH } = {}) {
  let existing = [];
  if (fs.existsSync(jsonPath)) {
    existing = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  }

  const newRows = hotAssessments.map(toRow);
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const row of newRows) byId.set(row.id, row);
  const merged = Array.from(byId.values()).sort((a, b) => b.score - a.score);

  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  fs.writeFileSync(csvPath, toCsv(merged), 'utf8');

  return { newCount: newRows.length, totalCount: merged.length, jsonPath, csvPath };
}

module.exports = { toRow, writeHotDeals, DEFAULT_JSON_PATH, DEFAULT_CSV_PATH };
