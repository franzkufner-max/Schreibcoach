'use strict';

const fs = require('fs');
const path = require('path');

const OUTBOX_DIR = path.join(__dirname, '..', 'data', 'notify_outbox');

/**
 * Sendet eine Zusammenfassung neuer Hot Deals über die konfigurierten
 * Kanäle. Jeder Kanal ist opt-in über eine Umgebungsvariable und no-op,
 * wenn nicht konfiguriert (kein harter Fehler, damit Trockenläufe ohne
 * Secrets funktionieren).
 *
 * Kanäle:
 *  - Slack:    SLACK_WEBHOOK_URL     (Incoming Webhook)
 *  - Telegram: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
 *  - E-Mail:   kein SMTP-Versand implementiert (keine Mail-Zugangsdaten
 *              in dieser Umgebung) — stattdessen wird ein Entwurf als
 *              .txt-Datei unter data/notify_outbox/ abgelegt, den man an
 *              einen bestehenden Mail-Versand (z.B. SMTP/Sendgrid) anbinden
 *              kann.
 */
async function sendHotDealsSummary(hotAssessments, { channels } = {}) {
  if (!hotAssessments || hotAssessments.length === 0) {
    return { sent: false, reason: 'keine neuen Hot Deals' };
  }

  const text = buildSummaryText(hotAssessments);
  const results = {};
  const wantedChannels = channels || inferChannelsFromEnv();

  if (wantedChannels.includes('slack')) {
    results.slack = await sendSlack(text);
  }
  if (wantedChannels.includes('telegram')) {
    results.telegram = await sendTelegram(text);
  }
  if (wantedChannels.includes('email')) {
    results.email = writeEmailDraft(text);
  }

  return { sent: true, channels: results };
}

function inferChannelsFromEnv() {
  const channels = [];
  if (process.env.SLACK_WEBHOOK_URL) channels.push('slack');
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) channels.push('telegram');
  if (channels.length === 0) channels.push('email'); // Fallback: immer einen Entwurf ablegen
  return channels;
}

function buildSummaryText(hotAssessments) {
  const lines = [`🔥 ${hotAssessments.length} neue(r) Hot Deal(s) — Immobilien-Deal-Screener`, ''];
  for (const a of hotAssessments) {
    const l = a.listing;
    lines.push(
      `• [${a.score.total}/100] ${l.city}${l.district ? '/' + l.district : ''} — ${l.priceEUR.toLocaleString(
        'de-DE'
      )} € — ${l.url}`
    );
  }
  lines.push('', 'Erste Einschätzung, keine Steuerberatung.');
  return lines.join('\n');
}

async function sendSlack(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return { ok: false, reason: 'SLACK_WEBHOOK_URL nicht gesetzt' };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return { ok: res.ok, status: res.status };
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, reason: 'TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID nicht gesetzt' };
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return { ok: res.ok, status: res.status };
}

function writeEmailDraft(text) {
  fs.mkdirSync(OUTBOX_DIR, { recursive: true });
  const filePath = path.join(OUTBOX_DIR, `hot-deals-${Date.now()}.txt`);
  fs.writeFileSync(filePath, text, 'utf8');
  return { ok: true, filePath, note: 'Kein SMTP konfiguriert — Entwurf lokal abgelegt.' };
}

module.exports = { sendHotDealsSummary, buildSummaryText };
