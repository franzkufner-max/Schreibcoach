<?php
// ============================================================
//  SCHREIBCOACH – Gymnasium Lappersdorf
//  Analyse eines pragmatischen Textes
//  Einfach ANTHROPIC_API_KEY unten eintragen, fertig.
// ============================================================

define('ANTHROPIC_API_KEY', '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');
define('ANTHROPIC_MODEL',   'claude-sonnet-4-6');

$SECTION_CRITERIA = [
    'einleitung' => [
        'label' => 'Einleitung',
        'kriterien' => 'Einfuehrender Gedanke (Aufhaenger) statt formelhaftem Basissatz ("In seinem Text ... schreibt der Autor ..."); Basisinformationen (Titel, Textsorte, Autor, Erscheinungsjahr); Thema und zentrale Problemstellung; Grundaussage und Intention des Autors (informieren/manipulieren/ueberzeugen/ueberreden).'
    ],
    'inhaltsangabe' => [
        'label' => 'Inhaltsangabe',
        'kriterien' => 'Strukturierte, knappe Zusammenfassung in eigenen Worten (keine Nacherzaehlung); Praesens; Position des Autors erkennbar; keine woertliche Uebernahme aus dem Text, stattdessen indirekte Rede; sachliche Sprache; roter Faden der Textabfolge.'
    ],
    'analyse-argumentation' => [
        'label' => 'Analyse: Argumentationsaufbau',
        'kriterien' => 'Roter Faden der Argumentation am Text nachgewiesen; Argumentationsabsicht herausgearbeitet und belegt; Aufbau (induktiv/deduktiv, Pro-Kontra, dialektisch) erkannt; Textverweise mit Zeilenangaben.'
    ],
    'analyse-sprache' => [
        'label' => 'Analyse: Sprachliche Mittel',
        'kriterien' => 'Sprachlich-stilistische Mittel benannt UND mit Funktion/Wirkabsicht verknuepft (nicht als Selbstzweck aufgelistet); konkrete Textbelege mit Zeilenangaben; Bezug zur Gesamtintention des Textes.'
    ],
    'synthese' => [
        'label' => 'Synthese',
        'kriterien' => 'Bewertung der Wirkung des Textes in Bezug zur Intention des Autors; abschliessende Bewertung der Analyseergebnisse; KEINE neuen Analyseansaetze; Absicht-Wirkung-Verhaeltnis eingeschaetzt.'
    ],
    'stellungnahme' => [
        'label' => 'Stellungnahme / Eroerterung',
        'kriterien' => 'Begruendete eigene Position (nicht nur Pro-Contra-Auflistung, aber dialektisch reflektiert); eigene Meinung wird erst hier eingebracht; nachvollziehbare Begruendung; Bezug zum Text.'
    ],
    'schluss' => [
        'label' => 'Schluss',
        'kriterien' => 'Aktualitaetsbezug oder Einordnung in groessere Zusammenhaenge; keine woertliche Wiederholung des Hauptteils; ggf. Wiederaufnahme des Einleitungsgedankens; runder Abschluss.'
    ],
    'ganz' => [
        'label' => 'Ganzer Aufsatz',
        'kriterien' => 'Alle Abschnitte der Analyse eines pragmatischen Textes: Einleitung (mit Aufhaenger statt Basissatz), Inhaltsangabe, Analyse (Argumentationsaufbau und sprachliche Mittel mit Funktion/Wirkung), Synthese, Stellungnahme/Eroerterung, Schluss. Zudem: Praesens, ggf. Konjunktiv I bei Zitaten, korrekte Zeilenverweise.'
    ],
];

function buildSystemPrompt($mode, $sectionKey, $criteria) {
    $sectionLabel = $criteria['label'];
    $sectionCrit  = $criteria['kriterien'];
    $isFull = ($sectionKey === 'ganz');

    if ($isFull) {
        $scopeNote = "Der Schueler reicht den GESAMTEN Aufsatz ein. Bewerte alle Abschnitte.";
    } else {
        $scopeNote = 'Der Schueler reicht NUR den Abschnitt "' . $sectionLabel . '" ein, nicht den ganzen Aufsatz. Bewerte AUSSCHLIESSLICH diesen Abschnitt. Erwaehne nicht, dass andere Abschnitte fehlen, das ist beabsichtigt.';
    }

    $kriterienBlock = 'MASSGEBLICHE KRITERIEN fuer "' . $sectionLabel . '":' . "\n" . $sectionCrit;

    if ($mode === 'hinweise') {
        $out = "Du bist ein erfahrener Deutschlehrer fuer Klasse 10 am bayerischen Gymnasium.\n";
        $out .= $scopeNote . "\n\n";
        $out .= $kriterienBlock . "\n\n";
        $out .= "DEINE AUFGABE: Gib KEINE fertige Ueberarbeitung und formuliere KEINEN besseren Text.\n";
        $out .= "Stelle stattdessen praezise Fragen und Hinweise, die den Schueler dazu bringen, selbst zu ueberarbeiten.\n\n";
        $out .= "STRUKTUR DEINER ANTWORT:\n";
        $out .= "### " . $sectionLabel . "\n";
        $out .= "- Nenne 1-2 konkrete Staerken (kurz, mit Begruendung)\n";
        $out .= "- Stelle 2-4 gezielte Fragen im Stil: 'Hast du ueberlegt, warum ...?', 'Was genau meinst du mit ...?', 'An welcher Stelle fehlt dir noch ein Beleg?'\n";
        $out .= "- Formuliere bei Bedarf einen Hinweis zur Richtung (kein fertiger Satz)\n\n";
        $out .= "Ton: kollegial, klar, konstruktiv. Kein Lob ohne Substanz. Auf Deutsch.";
        return $out;
    } else {
        $out = "Du bist ein erfahrener Deutschlehrer fuer Klasse 10 am bayerischen Gymnasium.\n";
        $out .= $scopeNote . "\n\n";
        $out .= $kriterienBlock . "\n\n";
        $out .= "DEINE AUFGABE: Gib eine direkte, ehrliche und konstruktive Rueckmeldung zu diesem Abschnitt.\n\n";
        $out .= "STRUKTUR DEINER ANTWORT:\n";
        $out .= "### " . $sectionLabel . "\n";
        $out .= "- Was gelingt konkret gut? (mit Begruendung)\n";
        $out .= "- Was fehlt oder ist schwaecher? (konkret benennen)\n";
        $out .= "- 2-3 praezise Verbesserungsvorschlaege\n\n";
        $out .= "Ton: direkt, sachlich, fair. Kein falsches Lob. Auf Deutsch.";
        return $out;
    }
}

function callAnthropic($messages, $systemPrompt, $maxTokens = 1500) {
    $payload = json_encode([
        'model'      => ANTHROPIC_MODEL,
        'max_tokens' => $maxTokens,
        'system'     => $systemPrompt,
        'messages'   => $messages
    ]);

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'x-api-key: ' . ANTHROPIC_API_KEY,
            'anthropic-version: 2023-06-01',
        ],
        CURLOPT_TIMEOUT        => 90,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        return ['error' => 'Verbindungsfehler: ' . $curlErr];
    }

    $data = json_decode($response, true);

    if ($httpCode !== 200) {
        $msg = isset($data['error']['message']) ? $data['error']['message'] : ('API-Fehler ' . $httpCode);
        return ['error' => $msg];
    }

    $text = '';
    if (isset($data['content']) && is_array($data['content'])) {
        foreach ($data['content'] as $block) {
            if ($block['type'] === 'text') $text .= $block['text'];
        }
    }
    return ['text' => $text];
}

// ROUTE 1: Transkription
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['api']) && $_GET['api'] === 'transcribe') {
    header('Content-Type: application/json; charset=utf-8');

    if (!isset($_FILES['file'])) {
        echo json_encode(['error' => 'Keine Datei empfangen.']);
        exit;
    }

    $tmpPath  = $_FILES['file']['tmp_name'];
    $mimeType = mime_content_type($tmpPath);
    $fileData = base64_encode(file_get_contents($tmpPath));

    $allowedImages = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    $isPdf = ($mimeType === 'application/pdf');
    $isImage = in_array($mimeType, $allowedImages);

    if (!$isPdf && !$isImage) {
        echo json_encode(['error' => 'Nur Bilder (JPG/PNG) oder PDF erlaubt.']);
        exit;
    }

    if ($isPdf) {
        $contentBlock = ['type' => 'document', 'source' => ['type' => 'base64', 'media_type' => 'application/pdf', 'data' => $fileData]];
    } else {
        $contentBlock = ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $mimeType, 'data' => $fileData]];
    }

    $messages = [[
        'role' => 'user',
        'content' => [
            $contentBlock,
            ['type' => 'text', 'text' => 'Transkribiere den handschriftlichen oder gedruckten Text auf diesem Bild/Dokument vollstaendig und originalgetreu. Gib NUR den transkribierten Text aus, ohne Einleitung, ohne Kommentar, ohne Markdown-Formatierung. Behalte Zeilenumbrueche sinngemaess bei, wo es fuer die Lesbarkeit hilft.']
        ]
    ]];

    $result = callAnthropic($messages, 'Du bist ein praezises Transkriptionswerkzeug fuer handschriftliche Schuelertexte.', 4000);

    if (isset($result['error'])) {
        echo json_encode(['error' => $result['error']]);
    } else {
        echo json_encode(['transcript' => trim($result['text'])]);
    }
    exit;
}

// ROUTE 2: Feedback
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['api']) && $_GET['api'] === 'feedback') {
    header('Content-Type: application/json; charset=utf-8');

    $body = json_decode(file_get_contents('php://input'), true);
    $essay      = trim($body['essay'] ?? '');
    $mode       = $body['mode'] ?? 'hinweise';
    $sectionKey = $body['section'] ?? 'ganz';

    global $SECTION_CRITERIA;
    if (!isset($SECTION_CRITERIA[$sectionKey])) $sectionKey = 'ganz';
    $criteria = $SECTION_CRITERIA[$sectionKey];

    if (mb_strlen($essay) < 40) {
        echo json_encode(['error' => 'Text zu kurz.']);
        exit;
    }

    $systemPrompt = buildSystemPrompt($mode, $sectionKey, $criteria);
    $messages = [['role' => 'user', 'content' => "Hier ist mein Text:\n\n" . $essay]];

    $result = callAnthropic($messages, $systemPrompt, 1500);

    if (isset($result['error'])) {
        echo json_encode(['error' => $result['error']]);
    } else {
        echo json_encode(['feedback' => $result['text']]);
    }
    exit;
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Schreibcoach - Analyse pragmatischer Texte</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Serif+4:ital,wght@0,300;0,400;1,300&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #1a1208; --paper: #f5f0e8; --accent: #8b2e0f; --accent-light: #c4541e;
    --gold: #b8860b; --muted: #6b5d4f; --border: #c9bba8; --hint-bg: #fdf6ec;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--paper); color: var(--ink); font-family: 'Source Serif 4', Georgia, serif; font-size: 17px; line-height: 1.7; min-height: 100vh; }
  .container { max-width: 800px; margin: 0 auto; padding: 40px 24px 80px; }
  header { text-align: center; padding: 48px 0 40px; border-bottom: 2px solid var(--border); margin-bottom: 40px; }
  .logo-mark { display: inline-flex; align-items: center; gap: 10px; font-family: 'Playfair Display', serif; font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--accent); margin-bottom: 16px; }
  .logo-mark::before, .logo-mark::after { content: ''; display: block; width: 32px; height: 1px; background: var(--accent); }
  h1 { font-family: 'Playfair Display', serif; font-size: clamp(28px,5vw,44px); font-weight: 700; color: var(--ink); margin-bottom: 12px; }
  .subtitle { color: var(--muted); font-style: italic; font-size: 16px; }
  .card { background: white; border: 1.5px solid var(--border); border-radius: 2px; padding: 32px; margin-bottom: 28px; box-shadow: 0 2px 8px rgba(26,18,8,0.06); }
  .card h2 { font-family: 'Playfair Display', serif; font-size: 18px; margin-bottom: 8px; color: var(--accent); }
  .card > p.hint { color: var(--muted); font-size: 15px; margin-bottom: 20px; font-style: italic; }
  .step-label { display: inline-block; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gold); margin-bottom: 6px; }

  .mode-options { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .mode-btn { padding: 16px 20px; border: 2px solid var(--border); background: var(--paper); border-radius: 2px; cursor: pointer; text-align: left; transition: all 0.2s; font-family: 'Source Serif 4', serif; }
  .mode-btn:hover { border-color: var(--accent-light); background: var(--hint-bg); }
  .mode-btn.active { border-color: var(--accent); background: white; box-shadow: inset 3px 0 0 var(--accent); }
  .mode-btn .mode-title { font-size: 15px; color: var(--ink); display: block; margin-bottom: 4px; }
  .mode-btn .mode-desc { font-size: 13px; color: var(--muted); font-style: italic; }

  .section-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .section-btn {
    padding: 12px 16px; border: 1.5px solid var(--border); background: var(--paper);
    border-radius: 2px; cursor: pointer; font-family: 'Source Serif 4', serif; font-size: 14px;
    text-align: left; transition: all 0.15s; color: var(--ink);
  }
  .section-btn:hover { border-color: var(--accent-light); background: var(--hint-bg); }
  .section-btn.active { border-color: var(--accent); background: white; box-shadow: inset 3px 0 0 var(--accent); font-weight: 600; }
  .section-btn.full { grid-column: 1 / -1; text-align: center; }

  .input-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
  .input-tab {
    flex: 1; padding: 12px; border: 1.5px solid var(--border); background: var(--paper);
    border-radius: 2px; cursor: pointer; text-align: center; font-size: 14px; transition: all 0.15s;
  }
  .input-tab.active { border-color: var(--accent); background: white; box-shadow: inset 0 -3px 0 var(--accent); font-weight: 600; }

  textarea {
    width: 100%; min-height: 280px; padding: 20px; border: 1.5px solid var(--border); border-radius: 2px;
    background: var(--paper); font-family: 'Source Serif 4', serif; font-size: 15px; line-height: 1.8;
    color: var(--ink); resize: vertical; transition: border-color 0.2s;
  }
  textarea:focus { outline: none; border-color: var(--accent-light); background: white; }
  .char-count { text-align: right; font-size: 13px; color: var(--muted); margin-top: 8px; font-style: italic; }

  .upload-zone {
    border: 2px dashed var(--border); border-radius: 4px; padding: 48px 24px;
    text-align: center; cursor: pointer; transition: all 0.2s; background: var(--paper);
  }
  .upload-zone:hover, .upload-zone.dragover { border-color: var(--accent-light); background: var(--hint-bg); }
  .upload-zone .icon { font-size: 36px; display: block; margin-bottom: 12px; color: var(--accent); }
  .upload-zone p { color: var(--muted); font-style: italic; font-size: 15px; }
  .upload-zone input { display: none; }
  .file-preview { margin-top: 16px; padding: 12px 16px; background: var(--hint-bg); border-radius: 2px; font-size: 14px; display: none; align-items: center; justify-content: space-between; }
  .file-preview.show { display: flex; }

  .submit-btn {
    width: 100%; padding: 18px 32px; background: var(--accent); color: var(--paper); border: none;
    border-radius: 2px; font-family: 'Playfair Display', serif; font-size: 17px; cursor: pointer;
    transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 10px;
  }
  .submit-btn:hover:not(:disabled) { background: var(--accent-light); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(139,46,15,0.3); }
  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .submit-btn.secondary { background: transparent; color: var(--accent); border: 1.5px solid var(--accent); }

  .loading { text-align: center; padding: 60px 40px; display: none; }
  .quill-anim { font-size: 40px; display: block; margin-bottom: 16px; animation: bob 1.5s ease-in-out infinite; }
  @keyframes bob { 0%,100%{transform:translateY(0) rotate(-5deg);}50%{transform:translateY(-8px) rotate(5deg);} }
  .loading p { color: var(--muted); font-style: italic; }

  .response-card { background: white; border: 1.5px solid var(--border); border-radius: 2px; padding: 40px; margin-top: 28px; box-shadow: 0 2px 8px rgba(26,18,8,0.06); display: none; animation: fadeUp 0.5s ease; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);} }
  .response-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
  .mode-badge { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 12px; border: 1px solid var(--accent); color: var(--accent); border-radius: 2px; }
  .section-badge { font-size: 12px; letter-spacing: 0.05em; padding: 4px 12px; background: var(--hint-bg); color: var(--muted); border-radius: 2px; }

  .response-body { color: var(--ink); line-height: 1.85; }
  .response-body h3 { font-family: 'Playfair Display', serif; font-size: 17px; color: var(--accent); margin: 28px 0 10px; padding-left: 12px; border-left: 3px solid var(--gold); }
  .response-body h3:first-child { margin-top: 0; }
  .response-body p { margin-bottom: 14px; }
  .response-body ul { padding-left: 24px; margin-bottom: 14px; }
  .response-body li { margin-bottom: 8px; }
  .response-body strong { color: var(--accent); }
  .response-body blockquote { background: var(--hint-bg); border-left: 4px solid var(--gold); padding: 14px 20px; margin: 16px 0; font-style: italic; border-radius: 0 2px 2px 0; }

  .reset-btn { margin-top: 28px; padding: 12px 24px; background: transparent; border: 1.5px solid var(--border); color: var(--muted); border-radius: 2px; font-family: 'Source Serif 4', serif; font-size: 15px; cursor: pointer; transition: all 0.2s; width: 100%; }
  .reset-btn:hover { border-color: var(--accent); color: var(--accent); }

  .error-msg { background: #fdf0f0; border: 1.5px solid #e88; border-radius: 2px; padding: 20px 24px; color: #8b2020; margin-top: 16px; display: none; font-size: 15px; }
  .ornament { text-align: center; color: var(--gold); font-size: 20px; margin: 8px 0; letter-spacing: 0.3em; }
  .info-note { font-size: 13px; color: var(--muted); font-style: italic; margin-top: 10px; }

  @media(max-width:600px){.mode-options,.section-grid{grid-template-columns:1fr;}.card,.response-card{padding:24px 20px;}}
</style>
</head>
<body>
<div class="container">
  <header>
    <div class="logo-mark">Gymnasium Lappersdorf - Deutsch Klasse 10</div>
    <h1>Schreibcoach</h1>
    <p class="subtitle">KI-Feedback zur Analyse pragmatischer Texte</p>
  </header>

  <div id="form-area">

    <div class="card">
      <span class="step-label">Schritt 1</span>
      <h2>Welchen Abschnitt moechtest du einreichen?</h2>
      <p class="hint">Du kannst nur einen Teil oder den ganzen Aufsatz bewerten lassen.</p>
      <div class="section-grid" id="section-grid">
        <button class="section-btn" data-section="einleitung" onclick="selectSection(this)">Einleitung</button>
        <button class="section-btn" data-section="inhaltsangabe" onclick="selectSection(this)">Inhaltsangabe</button>
        <button class="section-btn" data-section="analyse-argumentation" onclick="selectSection(this)">Analyse: Argumentationsaufbau</button>
        <button class="section-btn" data-section="analyse-sprache" onclick="selectSection(this)">Analyse: Sprachliche Mittel</button>
        <button class="section-btn" data-section="synthese" onclick="selectSection(this)">Synthese</button>
        <button class="section-btn" data-section="stellungnahme" onclick="selectSection(this)">Stellungnahme / Eroerterung</button>
        <button class="section-btn" data-section="schluss" onclick="selectSection(this)">Schluss</button>
        <button class="section-btn active full" data-section="ganz" onclick="selectSection(this)">Ganzer Aufsatz</button>
      </div>
    </div>

    <div class="card">
      <span class="step-label">Schritt 2</span>
      <h2>Was moechtest du?</h2>
      <p class="hint">Waehle, wie die KI dir helfen soll.</p>
      <div class="mode-options">
        <button class="mode-btn active" data-mode="hinweise" onclick="selectMode(this)">
          <span class="mode-title">Hinweise &amp; Fragen</span>
          <span class="mode-desc">Ich bekomme Denkanstoesse und ueberarbeite selbst.</span>
        </button>
        <button class="mode-btn" data-mode="konkret" onclick="selectMode(this)">
          <span class="mode-title">Konkrete Rueckmeldung</span>
          <span class="mode-desc">Ich bekomme direktes Feedback zu meinem Text.</span>
        </button>
      </div>
    </div>

    <div class="ornament">. . .</div>

    <div class="card">
      <span class="step-label">Schritt 3</span>
      <h2>Deinen Text einreichen</h2>
      <p class="hint">Per Tastatur eintippen/einfuegen oder ein Foto/PDF deines handschriftlichen Textes hochladen.</p>

      <div class="input-tabs">
        <div class="input-tab active" data-tab="text" onclick="switchInputTab(this)">Text eingeben</div>
        <div class="input-tab" data-tab="upload" onclick="switchInputTab(this)">Foto / PDF hochladen</div>
      </div>

      <div id="tab-text">
        <textarea id="essay-input" placeholder="Schreibe oder fuege deinen Text hier ein ..." oninput="updateCount()"></textarea>
        <div class="char-count" id="char-count">0 Zeichen</div>
      </div>

      <div id="tab-upload" style="display:none;">
        <div class="upload-zone" id="upload-zone" onclick="document.getElementById('file-input').click()">
          <span class="icon">&#128196;</span>
          <p>Foto oder PDF hier ablegen, oder klicken zum Auswaehlen</p>
          <input type="file" id="file-input" accept="image/jpeg,image/png,image/webp,application/pdf" onchange="handleFileSelect(event)">
        </div>
        <div class="file-preview" id="file-preview">
          <span id="file-name"></span>
          <span id="file-remove" style="cursor:pointer;color:var(--accent);" onclick="clearFile()">entfernen</span>
        </div>
        <button class="submit-btn secondary" id="transcribe-btn" style="margin-top:16px;" onclick="transcribeFile()" disabled>
          Text erkennen lassen
        </button>

        <div id="transcript-review" style="display:none; margin-top:24px;">
          <span class="step-label">Schritt 3b</span>
          <h2 style="margin-bottom:6px;">Erkannten Text pruefen und korrigieren</h2>
          <p class="hint">Die KI hat deinen Text gelesen - bitte kontrolliere, ob alles richtig erkannt wurde, bevor du Feedback einholst.</p>
          <textarea id="transcript-text" oninput="syncTranscriptToEssay()"></textarea>
          <div class="info-note">Tipp: Eigennamen, Zahlen und Zeilenangaben sind bei der Texterkennung am fehleranfaelligsten.</div>
        </div>
      </div>
    </div>

    <button class="submit-btn" id="submit-btn" onclick="submitEssay()">
      <span>Feedback einholen</span><span>-&gt;</span>
    </button>
    <div class="error-msg" id="error-msg"></div>
  </div>

  <div class="loading" id="loading">
    <span class="quill-anim">&#9991;</span>
    <p id="loading-text">Die KI liest deinen Text ...<br><em>Das dauert etwa 15-30 Sekunden.</em></p>
  </div>

  <div class="response-card" id="response-card">
    <div class="response-header">
      <span class="mode-badge" id="mode-badge">Hinweise &amp; Fragen</span>
      <span class="section-badge" id="section-badge">Ganzer Aufsatz</span>
    </div>
    <div class="response-body" id="response-body"></div>
    <button class="reset-btn" onclick="resetForm()">Neuen Text einreichen</button>
  </div>
</div>

<script>
let selectedMode = 'hinweise';
let selectedSection = 'ganz';
let selectedSectionLabel = 'Ganzer Aufsatz';
let selectedFile = null;
let activeInputTab = 'text';

const sectionLabels = {
  'einleitung': 'Einleitung',
  'inhaltsangabe': 'Inhaltsangabe',
  'analyse-argumentation': 'Analyse: Argumentationsaufbau',
  'analyse-sprache': 'Analyse: Sprachliche Mittel',
  'synthese': 'Synthese',
  'stellungnahme': 'Stellungnahme / Eroerterung',
  'schluss': 'Schluss',
  'ganz': 'Ganzer Aufsatz'
};

function selectSection(btn) {
  document.querySelectorAll('.section-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedSection = btn.dataset.section;
  selectedSectionLabel = sectionLabels[selectedSection];
}

function selectMode(btn) {
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedMode = btn.dataset.mode;
}

function switchInputTab(tab) {
  document.querySelectorAll('.input-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  activeInputTab = tab.dataset.tab;
  document.getElementById('tab-text').style.display = activeInputTab === 'text' ? 'block' : 'none';
  document.getElementById('tab-upload').style.display = activeInputTab === 'upload' ? 'block' : 'none';
}

function updateCount() {
  const len = document.getElementById('essay-input').value.length;
  document.getElementById('char-count').textContent = len.toLocaleString('de') + ' Zeichen';
}

const uploadZone = document.getElementById('upload-zone');
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) {
    document.getElementById('file-input').files = e.dataTransfer.files;
    handleFileSelect({ target: { files: e.dataTransfer.files } });
  }
});

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  selectedFile = file;
  document.getElementById('file-name').textContent = file.name + ' (' + Math.round(file.size/1024) + ' KB)';
  document.getElementById('file-preview').classList.add('show');
  document.getElementById('transcribe-btn').disabled = false;
  document.getElementById('transcript-review').style.display = 'none';
}

function clearFile() {
  selectedFile = null;
  document.getElementById('file-input').value = '';
  document.getElementById('file-preview').classList.remove('show');
  document.getElementById('transcribe-btn').disabled = true;
  document.getElementById('transcript-review').style.display = 'none';
}

async function transcribeFile() {
  if (!selectedFile) return;
  document.getElementById('form-area').style.display = 'none';
  document.getElementById('loading-text').innerHTML = 'Die KI liest dein Foto/PDF ...<br><em>Das dauert etwa 15-20 Sekunden.</em>';
  document.getElementById('loading').style.display = 'block';

  const formData = new FormData();
  formData.append('file', selectedFile);

  try {
    const res = await fetch('?api=transcribe', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Fehler bei der Texterkennung');

    document.getElementById('form-area').style.display = 'block';
    document.getElementById('loading').style.display = 'none';
    document.getElementById('transcript-text').value = data.transcript;
    document.getElementById('transcript-review').style.display = 'block';
    document.getElementById('transcript-review').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    document.getElementById('form-area').style.display = 'block';
    document.getElementById('loading').style.display = 'none';
    showError('Fehler: ' + err.message);
  }
}

function syncTranscriptToEssay() {}

async function submitEssay() {
  let text;
  if (activeInputTab === 'upload') {
    text = document.getElementById('transcript-text').value.trim();
    if (!text) { showError('Bitte lade zuerst ein Foto/PDF hoch und lasse den Text erkennen.'); return; }
  } else {
    text = document.getElementById('essay-input').value.trim();
  }

  if (text.length < 40) { showError('Bitte gib deinen Text ein (mindestens 40 Zeichen).'); return; }
  hideError();
  document.getElementById('form-area').style.display = 'none';
  document.getElementById('loading-text').innerHTML = 'Die KI liest deinen Text ...<br><em>Das dauert etwa 15-30 Sekunden.</em>';
  document.getElementById('loading').style.display = 'block';

  try {
    const res = await fetch('?api=feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ essay: text, mode: selectedMode, section: selectedSection })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Serverfehler');
    renderResponse(data.feedback);
  } catch (err) {
    document.getElementById('form-area').style.display = 'block';
    document.getElementById('loading').style.display = 'none';
    showError('Fehler: ' + err.message);
  }
}

function renderResponse(md) {
  let html = md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/### (.+)/g,'<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/^> (.+)$/gm,'<blockquote>$1</blockquote>')
    .replace(/^- (.+)$/gm,'<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => '<ul>' + m + '</ul>')
    .replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>');
  if (!html.startsWith('<h3>')) html = '<p>' + html + '</p>';
  document.getElementById('response-body').innerHTML = html;
  document.getElementById('mode-badge').textContent = selectedMode === 'hinweise' ? 'Hinweise & Fragen' : 'Konkrete Rueckmeldung';
  document.getElementById('section-badge').textContent = selectedSectionLabel;
  document.getElementById('loading').style.display = 'none';
  document.getElementById('response-card').style.display = 'block';
  document.getElementById('response-card').scrollIntoView({ behavior: 'smooth' });
}

function resetForm() {
  document.getElementById('form-area').style.display = 'block';
  document.getElementById('response-card').style.display = 'none';
  document.getElementById('essay-input').value = '';
  document.getElementById('char-count').textContent = '0 Zeichen';
  clearFile();
  document.getElementById('transcript-text').value = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showError(msg) { const e = document.getElementById('error-msg'); e.textContent = msg; e.style.display = 'block'; }
function hideError() { document.getElementById('error-msg').style.display = 'none'; }
</script>
</body>
</html>
