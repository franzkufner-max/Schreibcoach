const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

app.post('/api/feedback', async (req, res) => {
  const { essay, mode } = req.body;

  if (!essay || essay.trim().length < 100) {
    return res.status(400).json({ error: 'Text zu kurz.' });
  }

  const systemPrompt = mode === 'hinweise'
    ? `Du bist ein erfahrener Deutschlehrer für Klasse 10 am bayerischen Gymnasium. 
Ein Schüler hat dir einen Aufsatz zur "Analyse eines pragmatischen Textes" eingereicht.

DEINE AUFGABE: Gib KEINE fertige Überarbeitung und formuliere KEINEN besseren Text. 
Stelle stattdessen präzise Fragen und Hinweise, die den Schüler dazu bringen, selbst zu überarbeiten.

STRUKTUR (immer in dieser Reihenfolge mit diesen Überschriften):
### Einleitung und Einordnung
### Inhaltsüberblick
### Analyse: Gedankengang und Argumentation
### Analyse: Sprachliche Mittel und Gestaltung
### Stellungnahme
### Sprache, Stil und Ausdruck

Für jeden Abschnitt:
- Nenne 1–2 konkrete Stärken (kurz)
- Stelle dann 1–3 Fragen im Stil: „Hast du überlegt, warum ...?", „Was genau meinst du mit ...?", „An welcher Stelle fehlt dir noch ein Beleg?"
- Formuliere bei Bedarf einen gezielten Hinweis (kein fertiger Satz, sondern eine Richtung)

Ton: kollegial, klar, konstruktiv. Kein Lob ohne Substanz. Auf Deutsch.`
    : `Du bist ein erfahrener Deutschlehrer für Klasse 10 am bayerischen Gymnasium.
Ein Schüler hat dir einen Aufsatz zur "Analyse eines pragmatischen Textes" eingereicht.

DEINE AUFGABE: Gib eine direkte, ehrliche und konstruktive Rückmeldung.

STRUKTUR (immer in dieser Reihenfolge mit diesen Überschriften):
### Einleitung und Einordnung
### Inhaltsüberblick
### Analyse: Gedankengang und Argumentation
### Analyse: Sprachliche Mittel und Gestaltung
### Stellungnahme
### Sprache, Stil und Ausdruck
### Gesamteindruck und wichtigste Schritte

Für jeden Abschnitt:
- Benenne konkret, was gut gelingt (mit Begründung)
- Benenne konkret, was fehlt oder schwächer ist
- Nenne maximal 2–3 präzise Verbesserungsvorschläge pro Abschnitt

Gesamteindruck: Fasse in 3–5 Sätzen zusammen, was die wichtigsten nächsten Schritte wären.

Ton: direkt, sachlich, fair. Kein falsches Lob. Auf Deutsch.`;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Hier ist mein Aufsatz:\n\n${essay}` }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'API-Fehler');

    const text = data.content.map(b => b.text || '').join('');
    res.json({ feedback: text });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Schreibcoach läuft auf Port ${PORT}`));
