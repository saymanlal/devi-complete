import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Twilio trial accounts: max 1 segment = 160 chars
// Twilio paid accounts: up to 1600 chars
// Set TWILIO_TRIAL=false in Render env when you upgrade
const IS_TRIAL = process.env.TWILIO_TRIAL !== 'false';
const MAX_CHARS = IS_TRIAL ? 155 : 1600;

export async function sendSMS(body) {
  try {
    const trimmed = body.substring(0, MAX_CHARS);
    const message = await twilioClient.messages.create({
      body: trimmed,
      from: process.env.TWILIO_PHONE_NUMBER,
      to:   process.env.USER_PHONE_NUMBER,
    });
    console.log('SMS sent:', message.sid, '| chars:', trimmed.length);
    return message.sid;
  } catch (error) {
    console.error('SMS send error:', error.message);
    throw error;
  }
}

export function buildSmsBody({ callerNumber, intent, keyPoints, transcript, recordingUrl, duration, time }) {
  const now = time || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const intentShort = {
    appointment: 'Appointment',
    complaint:   'Complaint',
    payment:     'Payment',
    information: 'Info request',
    general:     'General',
  };

  if (IS_TRIAL) {
    // ── TRIAL: ultra short — fits in 1 segment (160 chars) ──────
    // Format: "DEVI: +91XXXXXXXXXX | Appointment | <first 80 chars of transcript or keypoint>"
    const purpose = intentShort[intent] || 'General';
    const detail  = (transcript || (keyPoints && keyPoints[0]) || '').substring(0, 80);
    let body = `DEVI: ${callerNumber} | ${purpose}`;
    if (detail) body += ` | ${detail}`;
    if (recordingUrl) body += ` | ${recordingUrl.substring(recordingUrl.lastIndexOf('/') + 1)}`;
    return body.substring(0, 155);
  }

  // ── PAID: full detailed SMS ──────────────────────────────────
  let body =
    `📞 DEVI — Missed Call\n` +
    `From: ${callerNumber}\n` +
    `Time: ${now}\n` +
    `Duration: ${duration || '?'}s\n` +
    `Purpose: ${intentShort[intent] || 'General'}\n`;

  if (transcript) {
    body += `\nTranscript:\n${transcript}\n`;
  } else if (keyPoints && keyPoints.length > 0) {
    body += `\nCaller said:\n${keyPoints.join('\n')}\n`;
  }

  if (recordingUrl) {
    body += `\nRecording:\n${recordingUrl}`;
  }

  return body.substring(0, 1600);
}