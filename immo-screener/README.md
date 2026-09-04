# Immobilien-Deal-Screener & Steuer-Coach

Ein autonomer Screener für Kauf-Investments in Deutschland (Berlin, Leipzig,
Regensburg), der Angebote gegen ein steuerliches Prüfraster (AfA-Fokus,
Verlustkorridor, Grundstücksanteil) filtert, Rendite/Cashflow rechnet und
"heiße Deals" (Score ≥ 70) mit einem 1-seitigen Memo ausgibt.

> **Rechtlicher Hinweis:** Alle steuerlichen Aussagen dieses Tools sind eine
> **erste Einschätzung, keine Steuerberatung**. §7b- und
> Restnutzungsdauer-Fragen gehören vor jedem Kauf vor den Steuerberater.

## Was hier bereits läuft

- **Steuerliches Prüfraster als Code** (`src/config.js`): alle Schwellenwerte
  aus dem Prüfraster (Verlustkorridor 6.000-20.000 €, AfA-Mindestsatz 3,0 %,
  Grundstücksanteil 30 %/35 %, Renditemindestwerte, Portfoliogrenzen).
- **AfA-Rechner** (`src/afa.js`): linear (2,5 %/2 %/3 %), degressiv 5 %
  (§7 Abs. 5a EStG, Förderfenster 01.10.2023-30.09.2029), Sonder-AfA §7b
  (inkl. Baukostengrenzen-Check 5.200 €/m²), Restnutzungsdauer-Hebel-Logik,
  10-Jahres-Buchwerttabelle, separate Einrichtungs-AfA (10 Jahre).
- **Bodenrichtwert/Grundstücksanteil** (`src/bodenrichtwert.js`): berechnet
  `ground_ratio` aus manuell recherchiertem Bodenrichtwert (BORIS Berlin /
  BORIS Bayern haben keine offene Massen-API — Wert muss pro Objekt
  nachgeschlagen werden) und markiert `ok`/`warn`/`critical`.
- **5-Minuten-Schnellprüfung + Ausschlussliste** (`src/quickcheck.js`): alle
  Ausschlusskriterien aus dem Prüfraster als testbare Regeln.
- **Steuerlicher Verlust Jahr 1 + Zielkorridor** (`src/taxLoss.js`).
- **Rendite/Cashflow-Rechner** (`src/cashflow.js`): Bruttorendite,
  Kaufpreisfaktor, Annuitätendarlehen-Tilgungsplan, Cashflow vor/nach Steuern
  für Jahr 1 und Jahr 10, Sensitivitäten (+1 % Zins, −5 % Miete,
  +20 % Instandhaltung).
- **Deal-Score 0-100** (`src/scoring.js`): gewichtete Score-Logik
  (35 % finanziell / 30 % Steuer-AfA / 20 % Markt / 15 % Risiko), Hot-Deal ab
  Score ≥ 70.
- **Portfoliogrenzen** (`src/portfolio.js`): max. 1 Kauf/Jahr,
  20.000 €/Jahr-Verlustkorridor über alle vom Screener getätigten Käufe,
  Zustand in `data/portfolio_state.json`.
- **Pipeline** (`src/pipeline.js`): verkettet alles zu einer
  `assessDeal(listing)`-Funktion.
- **Adapter-Schicht** (`src/adapters/`): Mock-Adapter mit Beispieldaten +
  Apify-Adapter-Gerüst für ImmoScout24; Immowelt/Kleinanzeigen bewusst als
  Stub (siehe rechtliche Hinweise unten).
- **Ausgabe**: `Hot_Deals`-Tabelle als JSON+CSV (`src/output/hotDealsTable.js`),
  1-seitiges Markdown-Memo pro Deal (`src/output/memo.js`), Alerts via
  Slack/Telegram/E-Mail-Entwurf (`src/notify.js`).
- **CLI** (`src/run.js`) + **GitHub-Actions-Workflow** (alle 15 Minuten,
  `.github/workflows/immo-screener.yml`).
- **46 automatisierte Tests** (`node --test`) für AfA, Bodenrichtwert,
  Ausschlusskriterien, Steuerverlust, Cashflow, Score, Portfolio und die
  End-to-End-Pipeline.

## Was noch NICHT läuft (und warum)

Ein System, das *tatsächlich* alle 15 Minuten ImmoScout24, Immowelt und
Kleinanzeigen durchsucht, braucht drei Dinge, die diese Sitzung nicht
bereitstellen kann: bezahlte Zugänge zu einem Datenanbieter, ein Kanal für
Alerts (Slack/Telegram-Token) und — vor allem — eine bewusste Entscheidung
des Nutzers, welche Datenquelle rechtlich vertretbar ist:

- **ImmoScout24**: kein direkter Scraper. Stattdessen ein Adapter-Gerüst
  (`src/adapters/apifyImmoscout24Adapter.js`) für einen Apify-Actor
  (kommerzieller Anbieter mit eigener Lizenz). Erfordert `APIFY_TOKEN` +
  `APIFY_IMMOSCOUT24_ACTOR_ID`. **Das Feldmapping im Adapter ist best-effort
  und muss einmalig gegen das tatsächliche Output-Schema des gewählten
  Actors abgeglichen werden.**
- **Immowelt**: keine bekannte, lizenzierte API — Adapter ist ein Stub, der
  auf manuelle Dateneingabe verweist.
- **Kleinanzeigen**: AGB untersagen automatisiertes Auslesen explizit — es
  wurde bewusst **kein** Scraper implementiert. Manuelle Eingabe oder ein
  vom Nutzer selbst beauftragter, lizenzierter Datenanbieter sind die
  einzigen vertretbaren Wege.
- **Alerts**: Slack/Telegram funktionieren sofort, sobald die Secrets
  gesetzt sind. Für E-Mail ist kein SMTP-Versand implementiert (keine
  Zugangsdaten in dieser Umgebung) — stattdessen wird ein Text-Entwurf unter
  `data/notify_outbox/` abgelegt, den man an einen bestehenden Mailversand
  anschließen kann.
- **"Alle 60 Minuten Zusammenfassung"**: Der Workflow läuft alle 15 Minuten
  und benachrichtigt nur bei **neuen** Hot Deals (Dedupe über
  `data/seen_hot_deal_ids.json`) — das ist näher an "sofort informiert" als
  ein starres 60-Minuten-Fenster. Wer exakt die 60-Minuten-Kadenz will, legt
  einen zweiten Workflow mit `cron: '0 * * * *'` an, der nur
  `node src/run.js --notify` (ohne erneuten Scan) ausführt.

## Setup

```bash
cd immo-screener
node src/run.js --source=mock            # Trockenlauf mit Beispieldaten
node src/run.js --source=mock --notify   # + Alert-Versuch (fällt auf E-Mail-Entwurf zurück)
npm test                                  # 46 Tests
```

Keine npm-Abhängigkeiten nötig (nur Node.js ≥ 18, nutzt eingebautes `fetch`).

### Scraper-Adapter einrichten (ImmoScout24 via Apify)

1. Apify-Account anlegen, passenden ImmoScout24-Actor im Apify Store
   auswählen und dessen AGB/Nutzungsbedingungen prüfen.
2. `APIFY_TOKEN` und `APIFY_IMMOSCOUT24_ACTOR_ID` als GitHub-Secrets (oder
   lokal als Umgebungsvariablen) setzen.
3. `src/adapters/apifyImmoscout24Adapter.js`: `buildActorInput()` und
   `mapToRawListing()` gegen das tatsächliche Actor-Schema anpassen (mit
   `TODO`-Kommentaren markiert).
4. Testen: `node src/run.js --source=immoscout24_apify --cities=Berlin`.

### Alerts einrichten

| Kanal | Umgebungsvariablen |
|---|---|
| Slack | `SLACK_WEBHOOK_URL` (Incoming Webhook) |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| E-Mail | keine automatische Zustellung — Entwurf unter `data/notify_outbox/`, an eigenen SMTP/Mail-Versand anschließen |

### GitHub Actions (15-Minuten-Takt)

`.github/workflows/immo-screener.yml` läuft standardmäßig im `mock`-Modus
und lädt Ergebnisse als Workflow-Artefakt hoch (14 Tage Aufbewahrung). Für
dauerhafte Persistenz im Repo (Commit von `data/hot_deals.json` etc.) das
Repository-Variable `IMMO_SCREENER_AUTOCOMMIT=true` setzen (Settings →
Actions → Variables) — bewusst standardmäßig deaktiviert, damit nicht
ungefragt alle 15 Minuten Commits entstehen.

## Datenmodell

- `data/deals_raw.sample.json` — Beispiel-Rohdaten (4 Objekte, die
  unterschiedliche Fälle des Prüfrasters demonstrieren: Zielkorridor-Treffer,
  Grundstücksanteil-Ausschluss, Neubau-Degressiv-AfA, Mehrfach-Ausschluss).
- `data/portfolio_state.json` — Ausgangslage aus dem ESt-Bescheid 2025
  (zvE, Grenzsteuersatz, Verlustkorridor) + Historie der über den Screener
  getätigten Käufe.
- `data/hot_deals.json` / `.csv` — generierte Hot-Deals-Tabelle (Link, Stadt,
  Preis, Miete, Nettorendite, Cashflow vor/nach Steuern, AfA-Variante, Score,
  Begründung).
- `memos/*.md` — 1-seitiges Memo pro Hot Deal.

Feldreferenz für Rohdaten: `src/models.js` (JSDoc-Typedef `RawListing`).

## Bekannte Vereinfachungen (siehe Code-Kommentare)

- §7b Sonder-AfA wird nur additiv zur linearen AfA gerechnet, nicht zur
  degressiven (§7 Abs. 5a) — entspricht der herrschenden Meinung, aber im
  Einzelfall vom Steuerberater zu bestätigen.
- Degressive AfA wird über 10 Jahre als reine Restbuchwert-AfA fortgeführt
  (kein unterstellter Wechsel zur linearen AfA).
- Ohne explizite Bodenrichtwert-Daten wird der Gebäudeanteil konservativ auf
  75 % geschätzt und als Annahme markiert (`gebaeudeanteil.assumption`).
- Markt-/Risiko-Teilscores nutzen eine grobe Stadt-/Bezirks-Heuristik statt
  eines Live-Mietspiegel-Feeds — bei Bedarf in `src/scoring.js` durch echte
  Daten ersetzbar.
- Instandhaltungskosten p.a. werden, falls nicht angegeben, konservativ mit
  8 €/m²/Jahr geschätzt (`src/pipeline.js`).

## Startreihenfolge (aus der Aufgabenstellung) — Status

1. ✅ Datenmodell für Deals_Raw und Hot_Deals definiert.
2. 🟡 Scraper-Integration ImmoScout24: Adapter-Gerüst steht, Feldmapping
   muss gegen den gewählten Apify-Actor final abgeglichen werden.
3. ✅ Bodenrichtwert-Modul (`ground_ratio`) — Wertermittlung selbst bleibt
   mangels offener API manuell (BORIS Berlin / BORIS Bayern).
4. ✅ AfA-Rechner (linear/degressiv/Sonder-AfA) + Buchwerttabelle +
   Restnutzungsdauer-Hebel.
5. ✅ Score-Logik + Alerts (Slack/Telegram funktionsfähig, E-Mail als
   Entwurf).
6. ⬜ Testlauf mit 50-100 echten Inseraten und Gewichtungs-Nachjustierung —
   erfordert einen konfigurierten, lizenzierten Datenanbieter.
