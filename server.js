const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Prüfe API-Key beim Start
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('FEHLER: ANTHROPIC_API_KEY nicht gesetzt!');
}

// Multer für File Uploads
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/transcribe', upload.single('file'), async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Server nicht konfiguriert. API-Key fehlt.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei empfangen.' });
    }

    const mimeType = req.file.mimetype;
    const fileBuffer = req.file.buffer;
    const base64Data = fileBuffer.toString('base64');

    const allowedImages = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const isPdf = mimeType === 'application/pdf';
    const isImage = allowedImages.includes(mimeType);

    if (!isPdf && !isImage) {
      return res.status(400).json({ error: 'Nur Bilder (JPG/PNG/WebP/GIF) oder PDF erlaubt.' });
    }

    const contentBlocks = [];

    if (isPdf) {
      contentBlocks.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64Data
        }
      });
    } else {
      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType,
          data: base64Data
        }
      });
    }

    contentBlocks.push({
      type: 'text',
      text: 'Transkribiere den handschriftlichen oder gedruckten Text auf diesem Bild/Dokument vollständig und originalgetreu. Gib NUR den transkribierten Text aus, ohne Erklärungen oder Anmerkungen[...]'
    });

    // Build headers for the Anthropic request. anthropic-version is optional and only added
    // if ANTHROPIC_API_VERSION is set in the environment. We avoid logging the API key value.
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY
    };
    if (process.env.ANTHROPIC_API_VERSION) {
      headers['anthropic-version'] = process.env.ANTHROPIC_API_VERSION;
    }

    // Log which headers will be sent (DO NOT print the API key value).
    console.log('Outgoing Anthropic request headers:', Object.keys(headers).map(k => k === 'x-api-key' ? 'x-api-key (REDACTED)' : k));

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: 'Du bist ein präzises Transkriptionswerkzeug für handschriftliche Schülertexte.',
        messages: [{
          role: 'user',
          content: contentBlocks
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(400).json({ error: data.error?.message || 'API-Fehler' });
    }

    const text = data.content.map(b => b.text || '').join('');
    res.json({ transcript: text.trim() });

  } catch (err) {
    console.error('Error in /api/transcribe:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/feedback', async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Server nicht konfiguriert. API-Key fehlt.' });
    }

    const { essay, mode, section } = req.body;

    if (!essay || essay.trim().length < 40) {
      return res.status(400).json({ error: 'Text zu kurz.' });
    }

    const sectionKey = section || 'ganz';
    const systemPrompt = buildSystemPrompt(mode, sectionKey);

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY
    };
    if (process.env.ANTHROPIC_API_VERSION) {
      headers['anthropic-version'] = process.env.ANTHROPIC_API_VERSION;
    }
    console.log('Outgoing Anthropic request headers:', Object.keys(headers).map(k => k === 'x-api-key' ? 'x-api-key (REDACTED)' : k));

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Hier ist mein Text:\n\n${essay}` }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(400).json({ error: data.error?.message || 'API-Fehler' });
    }

    const text = data.content.map(b => b.text || '').join('');
    res.json({ feedback: text });

  } catch (err) {
    console.error('Error in /api/feedback:', err);
    res.status(500).json({ error: err.message });
  }
});

function buildSystemPrompt(mode, sectionKey) {
  const sections = {
    'einleitung': 'Einleitung',
    'inhaltsangabe': 'Inhaltsangabe',
    'analyse-argumentation': 'Analyse: Argumentationsaufbau',
    'analyse-sprache': 'Analyse: Sprachliche Mittel',
    'synthese': 'Synthese',
    'stellungnahme': 'Stellungnahme / Erörterung',
    'schluss': 'Schluss',
    'ganz': 'Ganzer Aufsatz'
  };

  const label = sections[sectionKey] || 'Ganzer Aufsatz';

  if (mode === 'hinweise') {
    return `Du bist ein erfahrener Deutschlehrer für Klasse 10 am bayerischen Gymnasium.

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

Ton: kollegial, klar, konstruktiv. Kein Lob ohne Substanz. Auf Deutsch.`;
  } else {
    return `Du bist ein erfahrener Deutschlehrer für Klasse 10 am bayerischen Gymnasium.

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
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Schreibcoach läuft auf Port ${PORT}`));
