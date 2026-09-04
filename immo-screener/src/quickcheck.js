'use strict';

const { OBJECT_CRITERIA, EXCLUSION_MIN_WOHNFLAECHE_M2, SONDERAFA_7B } = require('./config');

/**
 * Abschnitt 4 — Ausschlusskriterien. Ein Treffer genügt zur Ablehnung.
 * Jede Regel gibt true zurück, wenn sie GREIFT (=Ausschluss).
 * @type {Array<{key:string,label:string,test:(listing:import('./models').RawListing)=>boolean}>}
 */
const EXCLUSION_RULES = [
  {
    key: 'wohnflaeche_unter_50',
    label: 'Wohnfläche unter 50 m² — Klumpenrisiko, kein Eigennutzermarkt',
    test: (l) => typeof l.wohnflaecheM2 === 'number' && l.wohnflaecheM2 < EXCLUSION_MIN_WOHNFLAECHE_M2,
  },
  {
    key: 'sonderafa_7b_ohne_nachweis',
    label: 'Beworbene §7b-Sonder-AfA ohne Nachweis der 5.200 €/m²-Grenze',
    test: (l) =>
      l.gtb7bBeworben === true &&
      (typeof l.anschaffungskostenGebaeudeProM2 !== 'number' ||
        l.anschaffungskostenGebaeudeProM2 > SONDERAFA_7B.baukostengrenzeEURProM2),
  },
  {
    key: 'mietpool_betreibervertrag',
    label: 'Mietpool, Betreibervertrag oder Mietgarantie',
    test: (l) => l.mietpoolOderBetreibervertrag === true,
  },
  {
    key: 'nutzungsbindung',
    label: 'Nutzungsbindung (Studentenwohnen, Sozialbindung, Betreutes Wohnen)',
    test: (l) => l.nutzungsbindung === true,
  },
  {
    key: 'endfaelliges_darlehen',
    label: 'Endfälliges Darlehen ohne geplanten Tilgungsersatz',
    test: (l) => l.endfaelligesDarlehenOhneTilgungsersatz === true,
  },
  {
    key: 'erbbaurecht',
    label: 'Erbbaurecht',
    test: (l) => l.erbbaurecht === true,
  },
  {
    key: 'bautraeger_ohne_baugenehmigung',
    label: 'Bauträgervertrag ohne erteilte Baugenehmigung',
    test: (l) => l.bautraegervertragOhneBaugenehmigung === true,
  },
  {
    key: 'mabv_ohne_buergschaft',
    label: 'Zahlung nach §3 MaBV ohne Bürgschaft, Bauträger mit dünner Bonität',
    test: (l) => l.zahlungNachMabvOhneBuergschaft === true,
  },
  {
    key: 'anlagentechnik_alt_ruecklage_niedrig',
    label: 'Anlagentechnik älter als 25 Jahre bei Rücklage unter 15 €/m²',
    test: (l) => {
      const heizungAlter = l.heizungBaujahr ? new Date().getFullYear() - l.heizungBaujahr : null;
      const ruecklageProM2 =
        l.instandhaltungsruecklageEUR && l.wohnflaecheM2
          ? l.instandhaltungsruecklageEUR / l.wohnflaecheM2
          : null;
      return (
        heizungAlter !== null &&
        heizungAlter > 25 &&
        ruecklageProM2 !== null &&
        ruecklageProM2 < OBJECT_CRITERIA.minInstandhaltungsruecklageEURProM2
      );
    },
  },
  {
    key: 'kaufpreisaufteilung_fehlt',
    label: 'Kaufpreisaufteilung Grund/Gebäude nicht im Vertrag beziffert',
    test: (l) => l.gebaeudeanteilAmKaufpreisPct === undefined || l.gebaeudeanteilAmKaufpreisPct === null,
  },
  {
    key: 'verlust_ueber_20000',
    // Wird von der Pipeline gesetzt (benötigt Steuerverlust-Berechnung), hier nur Platzhalter.
    label: 'Steuerlicher Verlust im ersten Jahr über 20.000 €',
    test: () => false,
  },
  {
    key: 'zweckentfremdung',
    label: 'Zweckentfremdungssatzung am Ort bei geplanter Kurzzeitvermietung',
    test: (l) => l.zweckentfremdungssatzungBeiKurzzeitvermietungGeplant === true,
  },
];

/**
 * Abschnitt 6 — 5-Minuten-Schnellprüfung. Läuft in der vorgegebenen
 * Reihenfolge und bricht beim ersten harten Ausschluss ab (spart Zeit,
 * bevor eine Detailrechnung folgt).
 * @param {import('./models').RawListing} listing
 * @returns {{step:number, key:string, label:string, passed:boolean, note:string}[]}
 */
function runSchnellpruefung(listing) {
  const results = [];
  const jahreskaltmiete = (listing.kaltmieteMonatlich || 0) * 12;
  const kaufpreisfaktor = jahreskaltmiete > 0 ? listing.priceEUR / jahreskaltmiete : null;

  results.push({
    step: 1,
    key: 'kaufpreisfaktor',
    label: 'Kaufpreis ÷ Jahreskaltmiete',
    passed: kaufpreisfaktor === null ? false : kaufpreisfaktor <= 33 || listing.nutzungsart === 'selbstnutzung_ab_2036',
    note:
      kaufpreisfaktor === null
        ? 'Kaltmiete fehlt — Faktor nicht berechenbar.'
        : `Faktor ${kaufpreisfaktor.toFixed(1)}${
            kaufpreisfaktor > 33 && listing.nutzungsart !== 'selbstnutzung_ab_2036'
              ? ' > 33 — nur bei Selbstnutzungsabsicht weiter prüfen'
              : ''
          }`,
  });

  const innenflaeche = listing.innenflaecheM2 || listing.wohnflaecheM2;
  const preisProM2 = innenflaeche ? listing.priceEUR / innenflaeche : null;
  results.push({
    step: 2,
    key: 'preis_pro_m2',
    label: 'Kaufpreis ÷ Innenfläche ohne Balkon',
    passed: true, // rein informativ, kein Hart-Kriterium ohne lokalen Vergleichswert
    note:
      preisProM2 === null
        ? 'Innenfläche unbekannt.'
        : `${Math.round(preisProM2).toLocaleString('de-DE')} €/m² — gegen örtlichen Schnitt manuell prüfen.`,
  });

  results.push({
    step: 3,
    key: 'baujahr_rnd',
    label: 'Baujahr vor 1925? Restnutzungsdauer-Hebel prüfen',
    passed: true,
    note:
      listing.baujahr && listing.baujahr < 1925
        ? 'Baujahr vor 1925 — Restnutzungsdauer-Gutachten prüfen (§7 Abs.4 S.2 EStG).'
        : 'Kein Altbau-Hebel anwendbar.',
  });

  results.push({
    step: 4,
    key: 'bodenrichtwert',
    label: 'Bodenrichtwert — Grundstücksanteil über 35 %?',
    passed: true, // wird von bodenrichtwert.js im Detail bewertet
    note: 'Siehe groundRatio-Auswertung (BORIS Berlin / BORIS Bayern).',
  });

  const exclusions = runAusschlusspruefung(listing);
  results.push({
    step: 5,
    key: 'ausschlussliste',
    label: 'Ausschlussliste (Abschnitt 4)',
    passed: exclusions.length === 0,
    note:
      exclusions.length === 0
        ? 'Kein Ausschlusskriterium getroffen.'
        : `Ausschluss: ${exclusions.map((e) => e.label).join('; ')}`,
  });

  results.push({
    step: 6,
    key: 'cashflow',
    label: 'Cashflow rechnen',
    passed: true,
    note: 'Erst nach Bestehen der Schritte 1-5 — siehe cashflow.js.',
  });

  return results;
}

/**
 * @param {import('./models').RawListing} listing
 * @param {number} [steuerlicherVerlustJahr1]
 * @returns {Array<{key:string,label:string}>} getroffene Ausschlusskriterien
 */
function runAusschlusspruefung(listing, steuerlicherVerlustJahr1) {
  const hits = EXCLUSION_RULES.filter((rule) => {
    if (rule.key === 'verlust_ueber_20000') {
      return typeof steuerlicherVerlustJahr1 === 'number' && steuerlicherVerlustJahr1 > 20000;
    }
    return rule.test(listing);
  }).map((r) => ({ key: r.key, label: r.label }));
  return hits;
}

/**
 * Prüft die "Muss"-Objektkriterien aus Abschnitt 3 (keine Ausschlüsse, aber
 * Voraussetzung, damit ein Objekt überhaupt als geprüft gilt).
 * @param {import('./models').RawListing} listing
 */
function checkMussKriterien(listing) {
  const checks = [
    {
      key: 'wohnflaeche_min',
      label: `Wohnfläche ≥ ${OBJECT_CRITERIA.minWohnflaecheM2} m²`,
      passed: (listing.wohnflaecheM2 || 0) >= OBJECT_CRITERIA.minWohnflaecheM2,
    },
    {
      key: 'zimmer_min',
      label: `Mindestens ${OBJECT_CRITERIA.minZimmer} Zimmer`,
      passed: (listing.zimmer || 0) >= OBJECT_CRITERIA.minZimmer,
    },
    {
      key: 'balkon',
      label: 'Balkon, Loggia oder Terrasse',
      passed: (listing.balkonflaecheM2 || 0) > 0,
    },
    {
      key: 'vermietbar',
      label: 'Bestand mit Mieter oder sofort vermietbar',
      passed: listing.mieterVorhandenOderSofortVermietbar === true,
    },
    {
      key: 'weg_unterlagen',
      label: 'WEG-Unterlagen vor Reservierung vollständig',
      passed: listing.wegUnterlagenVorhanden === true,
    },
    {
      key: 'heizung',
      label: 'Heizung jünger als 20 Jahre oder Austausch beschlossen/finanziert',
      passed:
        (listing.heizungBaujahr &&
          new Date().getFullYear() - listing.heizungBaujahr <= OBJECT_CRITERIA.maxHeizungsalterJahre) ||
        listing.heizungAustauschBeschlossenFinanziert === true,
    },
    {
      key: 'hausgeld_aufgeschluesselt',
      label: 'Hausgeld nach umlagefähig/nicht umlagefähig aufgeschlüsselt',
      passed:
        typeof listing.nichtUmlagefaehigeNebenkostenEURProJahr === 'number' &&
        typeof listing.verwaltungEURProJahr === 'number',
    },
  ];
  return { checks, allPassed: checks.every((c) => c.passed) };
}

module.exports = {
  EXCLUSION_RULES,
  runSchnellpruefung,
  runAusschlusspruefung,
  checkMussKriterien,
};
