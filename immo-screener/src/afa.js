'use strict';

const {
  AFA_RATES,
  SONDERAFA_7B,
  DEGRESSIVE_5A_WINDOW,
  RND_GUTACHTEN,
  FURNITURE_AFA_YEARS,
  DISCLAIMER,
} = require('./config');

/**
 * AfA-Rechner: ermittelt anwendbare AfA-Varianten, die AfA-Bemessungsgrundlage
 * und eine 10-Jahres-Buchwerttabelle je Variante.
 *
 * Vereinfachungen (siehe DISCLAIMER):
 *  - §7b Sonder-AfA wird nur zusätzlich zur LINEAREN AfA gerechnet (nicht
 *    kombinierbar mit der degressiven AfA nach §7 Abs. 5a — das entspricht
 *    der herrschenden Meinung, ist aber im Einzelfall vom Steuerberater zu
 *    bestätigen).
 *  - Die degressive AfA wird hier über 10 Jahre als reine 5%-Buchwert-AfA
 *    fortgeführt (kein Wechsel zur linearen AfA unterstellt).
 *  - Einrichtungsgegenstände (Einbauküche/Möblierung) werden separat über
 *    10 Jahre linear abgeschrieben und aus der Gebäude-AfA-Basis
 *    herausgerechnet.
 */

function isWithinDegressiveWindow(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= new Date(DEGRESSIVE_5A_WINDOW.from) && d <= new Date(DEGRESSIVE_5A_WINDOW.to);
}

/**
 * Prüft, ob sich ein Restnutzungsdauer-Gutachten (§7 Abs.4 S.2 EStG) lohnt.
 * @param {import('./models').RawListing} listing
 * @param {number} gebaeudewertEUR geschätzter Gebäudewert (Kaufpreis × Gebäudeanteil)
 */
function shouldRecommendRndGutachten(listing, gebaeudewertEUR) {
  if (!listing.baujahr || listing.baujahr >= 1925) return false;
  const kernsaniertRecent = listing.kernsanierungLetzte15Jahre === true;
  return (
    listing.priceEUR >= RND_GUTACHTEN.minKaufpreisEUR &&
    gebaeudewertEUR >= RND_GUTACHTEN.minGebaeudewertEUR &&
    !kernsaniertRecent
  );
}

/**
 * Ermittelt den Gebäudeanteil am Kaufpreis (0-1).
 * Priorität: 1) explizit im Exposé/Vertrag beziffert, 2) aus ground_ratio
 * (1 - Grundstücksanteil), 3) konservative Schätzung (als Annahme markiert).
 * @param {import('./models').RawListing} listing
 * @param {{available: boolean, groundRatio: number|null}} groundRatioResult
 */
function determineGebaeudeanteil(listing, groundRatioResult) {
  if (typeof listing.gebaeudeanteilAmKaufpreisPct === 'number') {
    return { value: listing.gebaeudeanteilAmKaufpreisPct, source: 'vertrag/exposé', assumption: false };
  }
  if (groundRatioResult && groundRatioResult.available) {
    return {
      value: Math.max(0, 1 - groundRatioResult.groundRatio),
      source: 'bodenrichtwert (1 - ground_ratio)',
      assumption: false,
    };
  }
  return {
    value: 0.75,
    source: 'konservative Standardannahme (Bodenrichtwert unbekannt)',
    assumption: true,
  };
}

/**
 * Bestimmt alle plausiblen AfA-Varianten für ein Objekt.
 * @param {import('./models').RawListing} listing
 * @returns {Array<{key:string,label:string,rate:number,type:'linear'|'degressiv',
 *   sonderAfaEligible:boolean, notes:string}>}
 */
function determineAfaVariants(listing) {
  const variants = [];
  const isGewerbe = listing.objekttyp === 'gewerbe';

  if (isGewerbe) {
    variants.push({
      key: 'gewerbe',
      label: 'Gewerbe linear 3%',
      rate: AFA_RATES.gewerbe,
      type: 'linear',
      sonderAfaEligible: false,
      notes: 'Gewerbeimmobilie, feste lineare AfA.',
    });
    return variants;
  }

  const neubauFenster = isWithinDegressiveWindow(listing.baubeginnOderKaufvertragDatum);

  if (listing.istNeubauOderErsterwerb) {
    // §7b Baukostengrenze: nur relevant, wenn mit Sonder-AfA geworben wird
    const baukostenNachweisVorhanden = typeof listing.anschaffungskostenGebaeudeProM2 === 'number';
    const baukostenUnterGrenze =
      baukostenNachweisVorhanden &&
      listing.anschaffungskostenGebaeudeProM2 <= SONDERAFA_7B.baukostengrenzeEURProM2;
    const sonderAfa7bPruefung = listing.gtb7bBeworben
      ? baukostenNachweisVorhanden
        ? baukostenUnterGrenze
          ? 'möglich, wenn weitere Voraussetzungen erfüllt (Nachweis ≤ 5.200 €/m² vorhanden)'
          : 'AUSSCHLUSS-VERDACHT: Nachweis liegt über 5.200 €/m² Baukostengrenze — §7b nicht anwendbar, Angebot falsch gerechnet'
        : 'AUSSCHLUSS-VERDACHT: §7b beworben, aber kein Nachweis der Anschaffungskosten je m² ohne Grundstücksanteil vorgelegt'
      : 'nicht beworben';

    if (neubauFenster) {
      variants.push({
        key: 'neubau_degressiv_5a',
        label: 'Neubau degressiv 5% (§7 Abs. 5a EStG, auf Restbuchwert)',
        rate: AFA_RATES.neubauDegressiv,
        type: 'degressiv',
        sonderAfaEligible: false, // nicht kombinierbar mit §7b (vereinfachte Annahme)
        notes: `Baubeginn/Kaufvertrag ${listing.baubeginnOderKaufvertragDatum} im Förderfenster (01.10.2023-30.09.2029). ${DISCLAIMER}`,
      });
    }

    variants.push({
      key: 'neubau_linear_3pct',
      label: 'Neubau linear 3% (§7 Abs. 4 EStG) ' + (listing.gtb7bBeworben ? '+ ggf. §7b Sonder-AfA' : ''),
      rate: AFA_RATES.neubauLinearAb2023,
      type: 'linear',
      sonderAfaEligible: listing.gtb7bBeworben === true && baukostenUnterGrenze === true,
      notes: `§7b Sonder-AfA: ${sonderAfa7bPruefung}`,
    });
  } else if (listing.baujahr && listing.baujahr < 1925) {
    variants.push({
      key: 'altbau_pauschal_2_5',
      label: 'Altbau vor 1925, pauschale AfA 2,5%',
      rate: AFA_RATES.altbauVor1925Pauschal,
      type: 'linear',
      sonderAfaEligible: false,
      notes: 'Ohne Restnutzungsdauer-Gutachten — unter dem Zielwert von 3,0%.',
    });
    variants.push({
      key: 'altbau_rnd_gutachten',
      label: 'Altbau vor 1925, mit Restnutzungsdauer-Gutachten 3,0-3,3%',
      rate: RND_GUTACHTEN.afaMitGutachtenMin,
      rateMax: RND_GUTACHTEN.afaMitGutachtenMax,
      type: 'linear',
      sonderAfaEligible: false,
      notes: `Gutachten ~${RND_GUTACHTEN.costEUR} € Kosten (§7 Abs.4 S.2 EStG). ${DISCLAIMER}`,
    });
  } else if (listing.baujahr) {
    variants.push({
      key: 'bestand_2pct',
      label: 'Bestand ab 1925, linear 2%',
      rate: AFA_RATES.bestandAb1925,
      type: 'linear',
      sonderAfaEligible: false,
      notes: 'Unter Mindest-AfA-Satz von 3,0% aus dem Prüfraster.',
    });
  }

  return variants;
}

/**
 * Baut die AfA-Bemessungsgrundlage: Gebäudeanteil am Kaufpreis + anteilige
 * Kaufnebenkosten, abzüglich separat abgeschriebener Einrichtung.
 */
function computeAfaBasis(listing, gebaeudeanteil, acquisitionCostsEUR) {
  const gebaeudewertKaufpreis = listing.priceEUR * gebaeudeanteil;
  const anteiligeNebenkosten = (acquisitionCostsEUR || 0) * gebaeudeanteil;
  const furnitureValue = (listing.einbaukuecheWertEUR || 0) + (listing.moeblierungWertEUR || 0);

  const afaBasis = gebaeudewertKaufpreis + anteiligeNebenkosten;

  return {
    gebaeudewertKaufpreisEUR: round2(gebaeudewertKaufpreis),
    anteiligeNebenkostenEUR: round2(anteiligeNebenkosten),
    afaBasisEUR: round2(afaBasis),
    furnitureValueEUR: round2(furnitureValue),
    furnitureAfaPerYearEUR: round2(furnitureValue / FURNITURE_AFA_YEARS),
  };
}

/**
 * Erstellt die 10-Jahres-Buchwerttabelle für eine AfA-Variante.
 * @param {number} afaBasisEUR
 * @param {{rate:number, rateMax?:number, type:'linear'|'degressiv', sonderAfaEligible:boolean}} variant
 * @param {number} [years=10]
 */
function buildBuchwertTabelle(afaBasisEUR, variant, years = 10) {
  const rows = [];
  let restbuchwert = afaBasisEUR;
  let kumuliert = 0;
  const rate = variant.rate;

  for (let year = 1; year <= years; year++) {
    const restbuchwertStart = restbuchwert;
    const afaBetrag =
      variant.type === 'degressiv' ? restbuchwertStart * rate : afaBasisEUR * rate;
    const sonderAfaBetrag =
      variant.sonderAfaEligible && year <= SONDERAFA_7B.years ? afaBasisEUR * AFA_RATES.sonderAfa7b : 0;
    const gesamtAfaJahr = afaBetrag + sonderAfaBetrag;
    restbuchwert = Math.max(0, restbuchwertStart - gesamtAfaJahr);
    kumuliert += gesamtAfaJahr;

    rows.push({
      jahr: year,
      restbuchwertJahresbeginnEUR: round2(restbuchwertStart),
      afaBetragEUR: round2(afaBetrag),
      sonderAfaBetragEUR: round2(sonderAfaBetrag),
      afaGesamtEUR: round2(gesamtAfaJahr),
      restbuchwertJahresendeEUR: round2(restbuchwert),
      kumulierteAfaEUR: round2(kumuliert),
    });
  }

  return rows;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

module.exports = {
  isWithinDegressiveWindow,
  shouldRecommendRndGutachten,
  determineGebaeudeanteil,
  determineAfaVariants,
  computeAfaBasis,
  buildBuchwertTabelle,
};
