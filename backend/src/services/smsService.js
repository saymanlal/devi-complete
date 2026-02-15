import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function sendSMS(body) {
  try {
    const message = await twilioClient.messages.create({
      body: body.substring(0, 1600),
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.USER_PHONE_NUMBER,
    });
    console.log('SMS sent:', message.sid, '| chars:', body.length);
    return message.sid;
  } catch (error) {
    console.error('SMS send error:', error.message);
    throw error;
  }
}

export function buildSmsBody({ callerNumber, recordingUrl }) {
  // Ensure we have the full Twilio recording URL
  let fullUrl = recordingUrl;
  
  // If it's a relative path, prepend Twilio API base
  if (!recordingUrl.includes('http')) {
    fullUrl = `https://api.twilio.com${recordingUrl}`;
  }
  
  // Ensure .mp3 extension
  if (!fullUrl.endsWith('.mp3')) {
    fullUrl = `${fullUrl}.mp3`;
  }
  
  // Simple 3-line SMS: title, caller, clickable link
  return `DEVI Missed Call
From: ${callerNumber}
Recording: ${fullUrl}`;
}