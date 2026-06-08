# Schreibcoach – Deployment-Anleitung

## Lokaler Test (5 Minuten)

1. Node.js installieren: https://nodejs.org (LTS-Version)
2. Diesen Ordner irgendwo entpacken
3. Terminal öffnen, in den Ordner wechseln:
   ```
   cd schreibcoach
   npm install
   ```
4. API-Key setzen und starten:
   - **Mac/Linux:** `ANTHROPIC_API_KEY=sk-ant-... node server.js`
   - **Windows:** `set ANTHROPIC_API_KEY=sk-ant-... && node server.js`
5. Browser öffnen: http://localhost:3000

---

## Deployment auf Railway (kostenlos, empfohlen)

1. Account anlegen: https://railway.app (GitHub-Login reicht)
2. "New Project" → "Deploy from GitHub repo"
   - Oder: Ordner als ZIP hochladen via Railway CLI
3. Unter **Variables** eintragen:
   - `ANTHROPIC_API_KEY` = dein Key (sk-ant-...)
4. Railway gibt dir eine URL wie `schreibcoach-xxx.up.railway.app`
5. Diese URL den Schülern geben – fertig.

---

## Deployment auf Render (Alternative)

1. Account anlegen: https://render.com
2. "New Web Service" → GitHub-Repo verbinden
3. Build command: `npm install`
4. Start command: `node server.js`
5. Environment variable: `ANTHROPIC_API_KEY` = dein Key
6. Free tier reicht für Schulbetrieb (bei Inaktivität schläft der Server ein, startet aber automatisch)

---

## Kosten

- Hosting: kostenlos (Railway/Render Free Tier)
- Anthropic API: ca. 0,003 € pro Feedback-Anfrage (claude-sonnet)
- Bei 25 Schülern × 3 Versuche = ca. 0,23 € pro Unterrichtsstunde
