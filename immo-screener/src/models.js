'use strict';

/**
 * Datenmodell für "Deals_Raw" (Rohdaten aus den Portalen) und die daraus
 * abgeleiteten "Hot_Deals". Dies ist reines JS ohne Typsystem — die
 * Feldliste dient als Vertrag zwischen Adaptern (src/adapters/*) und der
 * Pipeline (src/pipeline.js).
 *
 * @typedef {Object} RawListing
 * @property {string} id                       Eindeutige ID (Portal + Portal-interne ID)
 * @property {string} source                    'immoscout24' | 'immowelt' | 'kleinanzeigen' | 'manual'
 * @property {string} url
 * @property {string} city                      'Berlin' | 'Leipzig' | 'Regensburg'
 * @property {string} [district]                Bezirk/Stadtteil, z.B. 'Prenzlauer Berg'
 * @property {number} priceEUR                  Kaufpreis
 * @property {number} wohnflaecheM2             Wohnfläche laut Exposé
 * @property {number} [innenflaecheM2]           Reine Innenfläche ohne Balkon (falls bekannt)
 * @property {number} [balkonflaecheM2]
 * @property {number} [balkonAnrechnungsfaktor]  0.25-0.5, falls vom Makler angegeben
 * @property {number} zimmer
 * @property {number} baujahr
 * @property {boolean} [istNeubauOderErsterwerb]
 * @property {string} [baubeginnOderKaufvertragDatum] ISO-Datum, für §7 Abs.5a-Fenster
 * @property {number} kaltmieteMonatlich         Aktuelle oder erzielbare Kaltmiete/Monat
 * @property {boolean} [marktmieteAusgereizt]
 * @property {number} [grundstuecksflaecheM2]
 * @property {number} [miteigentumsanteilZaehler]
 * @property {number} [miteigentumsanteilNenner]
 * @property {number} [bodenrichtwertEURProM2]   Aus BORIS Berlin/Bayern manuell recherchiert
 * @property {number} [gebaeudeanteilAmKaufpreisPct] Falls im Vertrag/Exposé beziffert (0-1)
 * @property {number} [einbaukuecheWertEUR]
 * @property {number} [moeblierungWertEUR]
 * @property {boolean} [gtb7bBeworben]            Verkäufer wirbt mit §7b Sonder-AfA
 * @property {number} [anschaffungskostenGebaeudeProM2] Nachweis für §7b-Baukostengrenze
 * @property {number} [heizungBaujahr]
 * @property {boolean} [heizungAustauschBeschlossenFinanziert]
 * @property {number} [instandhaltungsruecklageEUR]
 * @property {boolean} [kernsanierungLetzte15Jahre]
 * @property {boolean} [mieterVorhandenOderSofortVermietbar]
 * @property {boolean} [wegUnterlagenVorhanden]   Teilungserklärung, 3 Protokolle, Wirtschaftsplan, Rücklagenstand
 * @property {boolean} [grossSanierungenErledigt]
 * @property {boolean} [mietpoolOderBetreibervertrag]
 * @property {boolean} [nutzungsbindung]          Studentenwohnen/Sozialbindung/Betreutes Wohnen
 * @property {boolean} [endfaelligesDarlehenOhneTilgungsersatz]
 * @property {boolean} [erbbaurecht]
 * @property {boolean} [bautraegervertragOhneBaugenehmigung]
 * @property {boolean} [zahlungNachMabvOhneBuergschaft]
 * @property {boolean} [zweckentfremdungssatzungBeiKurzzeitvermietungGeplant]
 * @property {boolean} [milieuschutzGeprueft]
 * @property {boolean} [umwandlungVorMehrAls10Jahren]
 * @property {boolean} [zeitmietvertrag575BgbAbTag1]
 * @property {boolean} [provisionsfrei]
 * @property {'kapitalanlage'|'selbstnutzung_ab_2036'} [nutzungsart]
 * @property {number} [zinssatzJahr1]             Angenommener Darlehenszins, z.B. 0.038
 * @property {number} [eigenkapitalquote]         z.B. 0.2
 * @property {number} [nichtUmlagefaehigeNebenkostenEURProJahr]
 * @property {number} [verwaltungEURProJahr]
 * @property {number} [marktBenchmarkBruttorenditePct] Regionaler Vergleichswert (Cap-Rate-Spread)
 * @property {number} [zustandRisikoScore]        0 (top) - 10 (sehr sanierungsbedürftig), grobe Einschätzung
 */

/**
 * @typedef {Object} DealAssessment
 * @property {RawListing} listing
 * @property {{passed: boolean, failedHardCriteria: string[], warnings: string[]}} quickcheck
 * @property {Object} groundRatio
 * @property {Object} afa
 * @property {Object} taxLossYear1
 * @property {Object} cashflow
 * @property {Object} score
 * @property {boolean} isHotDeal
 * @property {string} generatedAt
 */

const REQUIRED_RAW_FIELDS = [
  'id',
  'source',
  'url',
  'city',
  'priceEUR',
  'wohnflaecheM2',
  'zimmer',
  'baujahr',
  'kaltmieteMonatlich',
];

/**
 * Validiert die Mindestfelder eines RawListing. Wirft nicht, sondern gibt
 * eine Liste fehlender Felder zurück — Aufrufer entscheidet, ob das Listing
 * verworfen wird (unvollständige Exposés sind im Immobilienmarkt normal).
 * @param {Partial<RawListing>} listing
 * @returns {string[]} fehlende Pflichtfelder
 */
function missingRequiredFields(listing) {
  return REQUIRED_RAW_FIELDS.filter((f) => listing[f] === undefined || listing[f] === null);
}

module.exports = { REQUIRED_RAW_FIELDS, missingRequiredFields };
