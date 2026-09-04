'use strict';

const { missingRequiredFields } = require('./models');
const { checkMussKriterien, runSchnellpruefung, runAusschlusspruefung } = require('./quickcheck');
const { assessGroundRatio } = require('./bodenrichtwert');
const {
  shouldRecommendRndGutachten,
  determineGebaeudeanteil,
  determineAfaVariants,
  computeAfaBasis,
  buildBuchwertTabelle,
} = require('./afa');
const { computeTaxLossYear1 } = require('./taxLoss');
const { computeFullCashflowAnalysis, checkReturnThresholds } = require('./cashflow');
const { computeDealScore } = require('./scoring');
const { checkPortfolioConstraints } = require('./portfolio');
const { ACQUISITION_COST_RATES, AFA_RATES, DISCLAIMER } = require('./config');

const DEFAULT_ZINSSATZ = 0.038;
const DEFAULT_ANFANGSTILGUNG = 0.02;
const DEFAULT_EIGENKAPITALQUOTE = 0.2;
const DEFAULT_INSTANDHALTUNG_EUR_PRO_M2_JAHR = 8; // konservative Branchenannahme, falls nicht angegeben

function pickPrimaryAfaVariant(variants) {
  if (variants.length === 0) return null;
  const scored = variants.map((v) => ({
    v,
    effectiveFirstYearRate: v.rate + (v.sonderAfaEligible ? AFA_RATES.sonderAfa7b : 0),
  }));
  scored.sort((a, b) => b.effectiveFirstYearRate - a.effectiveFirstYearRate);
  return scored[0].v;
}

/**
 * Bewertet ein einzelnes RawListing vollständig gegen das steuerliche
 * Prüfraster und liefert eine DealAssessment-Struktur zurück.
 *
 * @param {import('./models').RawListing} listing
 * @param {Object} [options]
 * @param {Object} [options.portfolioState] Aktueller Portfolio-Zustand (für Korridor-Check)
 * @param {number} [options.year] Kalenderjahr für den Portfolio-Check (Default: aktuelles Jahr)
 * @returns {import('./models').DealAssessment}
 */
function assessDeal(listing, options = {}) {
  const year = options.year || new Date().getFullYear();
  const missing = missingRequiredFields(listing);
  if (missing.length > 0) {
    return {
      listing,
      incomplete: true,
      missingFields: missing,
      isHotDeal: false,
      generatedAt: new Date().toISOString(),
    };
  }

  const mussKriterien = checkMussKriterien(listing);
  const schnellpruefung = runSchnellpruefung(listing);
  const groundRatioResult = assessGroundRatio(listing);

  const gebaeudeanteil = determineGebaeudeanteil(listing, groundRatioResult);
  const acquisitionRates = ACQUISITION_COST_RATES[listing.city] || ACQUISITION_COST_RATES._default;
  const acquisitionCostsEUR = listing.priceEUR * acquisitionRates.total;
  const afaBasisResult = computeAfaBasis(listing, gebaeudeanteil.value, acquisitionCostsEUR);

  const gebaeudewertEUR = afaBasisResult.gebaeudewertKaufpreisEUR;
  const rndEmpfohlen = shouldRecommendRndGutachten(listing, gebaeudewertEUR);

  const afaVariants = determineAfaVariants(listing);
  const primaryVariant = pickPrimaryAfaVariant(afaVariants);
  const buchwertTabellen = Object.fromEntries(
    afaVariants.map((v) => [v.key, buildBuchwertTabelle(afaBasisResult.afaBasisEUR, v, 10)])
  );
  const primaryBuchwertTabelle = primaryVariant ? buchwertTabellen[primaryVariant.key] : [];
  const furnitureAfaJahr1 = afaBasisResult.furnitureAfaPerYearEUR;
  const afaJahr1GesamtEUR =
    (primaryBuchwertTabelle[0] ? primaryBuchwertTabelle[0].afaGesamtEUR : 0) + furnitureAfaJahr1;
  const effectiveAfaRateJahr1 = afaBasisResult.afaBasisEUR > 0 ? afaJahr1GesamtEUR / afaBasisResult.afaBasisEUR : null;

  const jahreskaltmieteEUR = (listing.kaltmieteMonatlich || 0) * 12;
  const eigenkapitalquote = listing.eigenkapitalquote ?? DEFAULT_EIGENKAPITALQUOTE;
  const darlehenEUR = listing.priceEUR * (1 - eigenkapitalquote);
  const zinssatz = listing.zinssatzJahr1 ?? DEFAULT_ZINSSATZ;
  const nichtUmlagefaehigeNkEUR = listing.nichtUmlagefaehigeNebenkostenEURProJahr ?? 0;
  const verwaltungEUR = listing.verwaltungEURProJahr ?? 0;
  const instandhaltungEUR =
    listing.instandhaltungskostenEURProJahr ?? listing.wohnflaecheM2 * DEFAULT_INSTANDHALTUNG_EUR_PRO_M2_JAHR;

  const zinsenJahr1EUR = darlehenEUR * zinssatz;
  const taxLossYear1 = computeTaxLossYear1({
    afaJahr1EUR: afaJahr1GesamtEUR,
    zinsenJahr1EUR,
    nichtUmlagefaehigeNkEUR,
    verwaltungEUR,
    mieteinnahmenJahr1EUR: jahreskaltmieteEUR,
  });

  const exclusions = runAusschlusspruefung(listing, taxLossYear1.verlustEUR);

  const cashflowAnalysis = computeFullCashflowAnalysis({
    kaufpreisEUR: listing.priceEUR,
    jahreskaltmieteEUR,
    darlehenEUR,
    zinssatz,
    anfangstilgung: DEFAULT_ANFANGSTILGUNG,
    nichtUmlagefaehigeNkEUR,
    verwaltungEUR,
    instandhaltungEUR,
    buchwertTabelle: primaryBuchwertTabelle,
  });
  const returnThresholdCheck = checkReturnThresholds(listing.nutzungsart, cashflowAnalysis);

  let portfolioCheck = null;
  if (options.portfolioState) {
    portfolioCheck = checkPortfolioConstraints(options.portfolioState, year, taxLossYear1.verlustEUR);
  }

  const heizungsalterJahre = listing.heizungBaujahr ? new Date().getFullYear() - listing.heizungBaujahr : null;
  const instandhaltungsruecklageProM2 =
    listing.instandhaltungsruecklageEUR && listing.wohnflaecheM2
      ? listing.instandhaltungsruecklageEUR / listing.wohnflaecheM2
      : null;

  const score = computeDealScore({
    bruttorendite: cashflowAnalysis.bruttorendite,
    cashflowNachSteuerJahr1:
      listing.nutzungsart === 'selbstnutzung_ab_2036'
        ? cashflowAnalysis.jahr1.cashflowNachSteuernVorTilgungEURProMonat
        : cashflowAnalysis.jahr1.cashflowNachSteuernVorTilgungEUR,
    marktBenchmarkBruttorenditePct: listing.marktBenchmarkBruttorenditePct,
    nutzungsart: listing.nutzungsart,
    effectiveAfaRateJahr1,
    verlustZielkorridor: taxLossYear1.zielkorridor,
    korridorNochVerfuegbar: portfolioCheck ? portfolioCheck.korridorAusreichend : true,
    city: listing.city,
    district: listing.district,
    marktmieteAusgereizt: listing.marktmieteAusgereizt,
    zustandRisikoScore: listing.zustandRisikoScore,
    instandhaltungsruecklageProM2,
    heizungsalterJahre,
  });

  const hardFail =
    !mussKriterien.allPassed ||
    exclusions.length > 0 ||
    groundRatioResult.status === 'critical' ||
    !returnThresholdCheck.allPassed ||
    (portfolioCheck !== null && !portfolioCheck.zulaessig);

  const isHotDeal = !hardFail && score.isHot;

  return {
    listing,
    incomplete: false,
    disclaimer: DISCLAIMER,
    mussKriterien,
    schnellpruefung,
    exclusions,
    groundRatio: groundRatioResult,
    gebaeudeanteil,
    rndGutachtenEmpfohlen: rndEmpfohlen,
    afa: {
      basis: afaBasisResult,
      variants: afaVariants,
      primaryVariantKey: primaryVariant ? primaryVariant.key : null,
      buchwertTabellen,
      effectiveAfaRateJahr1,
    },
    darlehen: { darlehenEUR: round2(darlehenEUR), zinssatz, eigenkapitalquote, acquisitionCostsEUR: round2(acquisitionCostsEUR) },
    taxLossYear1,
    cashflow: cashflowAnalysis,
    returnThresholdCheck,
    portfolioCheck,
    score,
    hardFail,
    isHotDeal,
    generatedAt: new Date().toISOString(),
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

module.exports = { assessDeal };
