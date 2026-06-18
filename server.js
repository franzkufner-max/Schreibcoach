const express = require('express');
const multer = require('multer');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

// ------------------------------------------------------------
//  Abschnitts-Kriterien
// ------------------------------------------------------------
const SECTION_CRITERIA = {
  'einleitung': {
    label: 'Einleitung',
    kriterien: 'Einführender Gedanke (Aufhänger) statt formelhaftem Basissatz ("In seinem Text ... schreibt der Autor ..."); Basisinformationen (Titel, Textsorte, Autor, Erscheinungsjahr); Thema und zentrale Problemstellung; Grundaussage und Intention des Autors (informieren/manipulieren/überzeugen/überreden).'
  },
  'inhaltsangabe': {
    label: 'Inhaltsangabe',
    kriterien: 'Strukturierte, knappe Zusammenfassung in eigenen Worten (keine Nacherzählung); Präsens; Position des Autors erkennbar; keine wörtliche Übernahme aus dem Text, stattdessen indirekte Rede; sachliche Sprache; roter Faden der Textabfolge.'
  },
  'analyse-argumentation': {
    label: 'Analyse: Argumentationsaufbau',
    kriterien: 'Roter Faden der Argumentation am Text nachgewiesen; Argumentationsabsicht herausgearbeitet und belegt; Aufbau (induktiv/deduktiv, Pro-Kontra, dialektisch) erkannt; Textverweise mit Zeilenangaben.'
  },
  'analyse-sprache': {
    label: 'Analyse: Sprachliche Mittel',
    kriterien: 'Sprachlich-stilistische Mittel benannt UND mit Funktion/Wirkabsicht verknüpft (nicht als Selbstzweck aufgelistet); konkrete Textbelege mit Zeilenangaben; Bezug zur Gesamtintention des Textes.'
  },
  'synthese': {
    label: 'Synthese',
    kriterien: 'Bewertung der Wirkung des Textes in Bezug zur Intention des Autors; abschließende Bewertung der Analyseergebnisse; KEINE neuen Analyseansätze; Absicht-Wirkung-Verhältnis eingeschätzt.'
  },
  'stellungnahme': {
    label: 'Stellungnahme / Erörterung',
    kriterien: 'Begründete eigene Position (nicht nur Pro-Contra-Auflistung, aber dialektisch reflektiert); eigene Meinung wird erst hier eingebracht; nachvollziehbare Begründung; Bezug zum Text.'
  },
  'schluss': {
    label: 'Schluss',
    kriterien: 'Aktualitätsbezug oder Einordnung in größere Zusammenhänge; keine wörtliche Wiederholung des Hauptteils; ggf. Wiederaufnahme des Einleitungsgedankens; runder Abschluss.'
  },
  'ganz': {
    label: 'Ganzer Aufsatz',
    kriterien: 'Alle Abschnitte der Analyse eines pragmatischen Textes: Einleitung (mit Aufhänger statt Basissatz), Inhaltsangabe, Analyse (Argumentationsaufbau und sprachliche Mittel mit Funktion/Wirkung), Synthese, Stellungnahme/Erörterung, Schluss. Zudem: Präsens, ggf. Konjunktiv I bei Zitaten, korrekte Zeilenverweise.'
  }
};

function buildSystemPrompt(mode, sectionKey, criteria) {
  const sectionLabel = criteria.label;
  const sectionCrit = criteria.kriterien;
  const isFull = sectionKey === 'ganz';

  const scopeNote = isFull
    ? 'Der Schüler reicht den GESAMTEN Aufsatz ein. Bewerte alle Abschnitte.'
    : `Der Schüler reicht NUR den Abschnitt "${sectionLabel}" ein, nicht den ganzen Aufsatz. Bewerte AUSSCHLIESSLICH diesen Abschnitt. Erwähne nicht, dass andere Abschnitte fehlen — das ist beabsichtigt.`;

  const kriterienBlock = `MASSGEBLICHE KRITERIEN für "${sectionLabel}":\n${sectionCrit}`;

  if (mode === 'hinweise') {
    return `Du bist ein erfahrener Deutschlehrer für Klasse 10 am bayerischen Gymnasium.
${scopeNote}

${kriterienBlock}

DEINE AUFGABE: Gib KEINE fertige Überarbeitung und formuliere KEINEN besseren Text.
Stelle stattdessen präzise Fragen und Hinweise, die den Schüler dazu bringen, selbst zu überarbeiten.

STRUKTUR DEINER ANTWORT:
### ${sectionLabel}
- Nenne 1–2 konkrete Stärken (kurz, mit Begründung)
- Stelle 2–4 gezielte Fragen im Stil: „Hast du überlegt, warum ...?", „Was genau meinst du mit ...?", „An welcher Stelle fehlt dir noch ein Beleg?"
- Formuliere bei Bedarf einen Hinweis zur Richtung (kein fertiger Satz)

Ton: kollegial, klar, konstruktiv. Kein Lob ohne Substanz. Auf Deutsch.`;
  } else {
    return `Du bist ein erfahrener Deutschlehrer für Klasse 10 am bayerischen Gymnasium.
${scopeNote}

${kriterienBlock}

DEINE AUFGABE: Gib eine direkte, ehrliche und konstruktive Rückmeldung zu diesem Abschnitt.

STRUKTUR DEINER ANTWORT:
### ${sectionLabel}
- Was gelingt konkret gut? (mit Begründung)
- Was fehlt oder ist schwächer? (konkret benennen)
- 2–3 präzise Verbesserungsvorschläge

Ton: direkt, sachlich, fair. Kein falsches Lob. Auf Deutsch.`;
  }
}

async function callAnthropic(messages, systemPrompt, maxTokens = 1500) {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `API-Fehler ${response.status}`);
  }

  const text = data.content.map(b => b.text || '').join('');
  return text;
}

// ------------------------------------------------------------
//  ROUTE 1: Transkription (Bild/PDF -> Text)
// ------------------------------------------------------------
app.post('/api/transcribe', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei empfangen.' });
    }

    const mimeType = req.file.mimetype;
    const fileData = req.file.buffer.toString('base64');

    const allowedImages = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const isPdf = mimeType === 'application/pdf';
    const isImage = allowedImages.includes(mimeType);

    if (!isPdf && !isImage) {
      return res.status(400).json({ error: 'Nur Bilder (JPG/PNG) oder PDF erlaubt.' });
    }

    const contentBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileData } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: fileData } };

    const messages = [{
      role: 'user',
      content: [
        contentBlock,
        { type: 'text', text: 'Transkribiere den handschriftlichen oder gedruckten Text auf diesem Bild/Dokument vollständig und originalgetreu. Gib NUR den transkribierten Text aus, ohne Einleitung, ohne Kommentar, ohne Markdown-Formatierung. Behalte Zeilenumbrüche sinngemäß bei, wo es für die Lesbarkeit hilft.' }
      ]
    }];

    const text = await callAnthropic(
      messages,
      'Du bist ein präzises Transkriptionswerkzeug für handschriftliche Schülertexte.',
      4000
    );

    res.json({ transcript: text.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------
//  ROUTE 2: Feedback
// ------------------------------------------------------------
app.post('/api/feedback', async (req, res) => {
  try {
    const { essay, mode, section } = req.body;
    const sectionKey = SECTION_CRITERIA[section] ? section : 'ganz';
    const criteria = SECTION_CRITERIA[sectionKey];

    if (!essay || essay.trim().length < 40) {
      return res.status(400).json({ error: 'Text zu kurz.' });
    }

    const systemPrompt = buildSystemPrompt(mode, sectionKey, criteria);
    const messages = [{ role: 'user', content: `Hier ist mein Text:\n\n${essay}` }];

    const text = await callAnthropic(messages, systemPrompt, 1500);
    res.json({ feedback: text });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Schreibcoach läuft auf Port ${PORT}`));
