'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_MEMO_DIR = path.join(__dirname, '..', '..', 'memos');

function eur(n) {
  return typeof n === 'number' ? n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €' : 'n/a';
}
function pct(n) {
  return typeof n === 'number' ? (n * 100).toFixed(2) + ' %' : 'n/a';
}

/**
 * Erzeugt ein 1-seitiges Markdown-Memo für ein DealAssessment.
 * @param {import('../models').DealAssessment} a
 * @returns {string} Markdown
 */
function buildMemoMarkdown(a) {
  const l = a.listing;
  const cf = a.cashflow;
  const buchwertRows = (a.afa.buchwertTabellen[a.afa.primaryVariantKey] || [])
    .map(
      (r) =>
        `| ${r.jahr} | ${eur(r.restbuchwertJahresbeginnEUR)} | ${eur(r.afaBetragEUR)} | ${eur(
          r.sonderAfaBetragEUR
        )} | ${eur(r.afaGesamtEUR)} | ${eur(r.restbuchwertJahresendeEUR)} | ${eur(r.kumulierteAfaEUR)} |`
    )
    .join('\n');

  return `# Deal-Memo — ${l.city}${l.district ? ' / ' + l.district : ''}

**Link:** ${l.url}
**Erstellt:** ${a.generatedAt}
**Score:** ${a.score.total}/100 ${a.isHotDeal ? '🔥 HOT DEAL' : ''}

> ${a.disclaimer}

## Objektdaten
- Kaufpreis: ${eur(l.priceEUR)}
- Wohnfläche: ${l.wohnflaecheM2} m², ${l.zimmer} Zimmer, Baujahr ${l.baujahr}
- Kaltmiete: ${eur(l.kaltmieteMonatlich)} / Monat
- Grundstücksanteil: ${a.groundRatio.available ? pct(a.groundRatio.groundRatio) + ' (' + a.groundRatio.status + ')' : 'unbekannt'}
- Gebäudeanteil (Annahme: ${a.gebaeudeanteil.assumption ? 'ja' : 'nein'}, Quelle: ${a.gebaeudeanteil.source}): ${pct(
    a.gebaeudeanteil.value
  )}
- Restnutzungsdauer-Gutachten empfohlen: ${a.rndGutachtenEmpfohlen ? 'JA' : 'nein'}

## Kalkulation
- Bruttorendite: ${pct(cf.bruttorendite)}
- Kaufpreisfaktor: ${cf.kaufpreisfaktor === null ? 'n/a' : cf.kaufpreisfaktor.toFixed(1)}
- Darlehen: ${eur(a.darlehen.darlehenEUR)} bei ${pct(a.darlehen.zinssatz)} Zins, EK-Quote ${pct(a.darlehen.eigenkapitalquote)}
- Kaufnebenkosten: ${eur(a.darlehen.acquisitionCostsEUR)}
- Cashflow Jahr 1 (vor Steuern, vor Tilgung): ${eur(cf.jahr1.cashflowVorSteuernVorTilgungEUR)}
- Cashflow Jahr 1 (nach Steuern, vor Tilgung): ${eur(cf.jahr1.cashflowNachSteuernVorTilgungEUR)}
- Cashflow Jahr 10 (nach Steuern, vor Tilgung): ${eur(cf.jahr10.cashflowNachSteuernVorTilgungEUR)}
- Renditemindestwerte erfüllt: ${a.returnThresholdCheck.allPassed ? 'JA' : 'NEIN'}

### Sensitivitäten (Jahr 1, nach Steuern)
- +1% Zinsen: ${eur(cf.sensitivities.zinsPlus1Pct.cashflowNachSteuernVorTilgungEUR)}
- −5% Miete: ${eur(cf.sensitivities.mieteMinus5Pct.cashflowNachSteuernVorTilgungEUR)}
- +20% Instandhaltung: ${eur(cf.sensitivities.instandhaltungPlus20Pct.cashflowNachSteuernVorTilgungEUR)}

## AfA-Tabelle (10 Jahre, Variante: ${a.afa.primaryVariantKey})
| Jahr | Restbuchwert Start | AfA | Sonder-AfA | AfA gesamt | Restbuchwert Ende | kum. AfA |
|---|---|---|---|---|---|---|
${buchwertRows}

## Steuerwirkung
- Steuerlicher Verlust Jahr 1: ${eur(a.taxLossYear1.verlustEUR)} (${a.taxLossYear1.zielkorridor})
- ${a.taxLossYear1.note}
- Portfolio-Korridor: ${a.portfolioCheck ? a.portfolioCheck.note : 'nicht geprüft (kein Portfolio-Status übergeben)'}

## Risiken
- Muss-Kriterien erfüllt: ${a.mussKriterien.allPassed ? 'JA' : 'NEIN — ' + a.mussKriterien.checks.filter((c) => !c.passed).map((c) => c.label).join('; ')}
- Ausschlusskriterien getroffen: ${a.exclusions.length === 0 ? 'keine' : a.exclusions.map((e) => e.label).join('; ')}
- Score-Breakdown: Finanziell ${a.score.breakdown.finanziell.value}, Steuer/AfA ${a.score.breakdown.steuerAfa.value}, Markt ${a.score.breakdown.markt.value}, Risiko ${a.score.breakdown.risiko.value}

## Next Steps
1. WEG-Unterlagen anfordern (Teilungserklärung, 3 Protokolle, Wirtschaftsplan, Rücklagenstand), falls noch nicht vorliegend.
2. Bodenrichtwert amtlich über BORIS Berlin / BORIS Bayern verifizieren.
3. ${a.rndGutachtenEmpfohlen ? 'Restnutzungsdauer-Gutachten beauftragen (~1.500 €) VOR Kaufvertrag.' : 'Kein RND-Gutachten notwendig.'}
4. Vor Kauf: Steuerberater zu §7b/Restnutzungsdauer/Kaufpreisaufteilung konsultieren.
5. Portfolio-Korridor und Jahres-Kauflimit final gegen den aktuellen Stand prüfen.

---
${a.disclaimer}
`;
}

/**
 * Schreibt das Memo als .md-Datei und gibt den Pfad zurück.
 */
function writeMemo(a, { dir = DEFAULT_MEMO_DIR } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${a.listing.id}.md`);
  fs.writeFileSync(filePath, buildMemoMarkdown(a), 'utf8');
  return filePath;
}

module.exports = { buildMemoMarkdown, writeMemo, DEFAULT_MEMO_DIR };
