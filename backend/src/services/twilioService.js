import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// FIX: Polly.Aditi-Neural does NOT exist on Twilio — causes "application error"
// Polly.Kajal is AWS Neural Hindi, best Indian female voice on Twilio
const FEMALE_VOICE = 'Polly.Kajal';
const LANGUAGE = 'hi-IN';

export async function initiateCallback(callerNumber) {
  try {
    const BASE_URL = process.env.BASE_URL;

    const call = await client.calls.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: callerNumber,
      // FIX: all 3 URLs now match routes mounted in index.js
      url: `${BASE_URL}/webhook/twilio-voice`,
      statusCallback: `${BASE_URL}/webhook/twilio-voice`,
      statusCallbackEvent: ['completed'],
      record: true,
      recordingStatusCallback: `${BASE_URL}/webhook/recording/complete`,
      recordingStatusCallbackEvent: ['completed'],
      timeout: 30,
      machineDetection: 'DetectMessageEnd'
    });
    console.log('Callback initiated:', call.sid);
    return call.sid;
  } catch (error) {
    console.error('Twilio callback error:', error);
    throw error;
  }
}

export function generateVoiceResponse(text, gatherConfig = null) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  if (text) {
    response.say({ voice: FEMALE_VOICE, language: LANGUAGE }, text);
  }

  if (gatherConfig) {
    const gather = response.gather({
      input: 'speech',
      language: LANGUAGE,
      speechTimeout: 'auto',
      action: gatherConfig.action,
      method: 'POST',
      speechModel: 'phone_call',
      hints: 'haan,nahi,yes,no,message,okay,thik hai,bilkul,zaroor'
    });

    if (gatherConfig.prompt) {
      gather.say({ voice: FEMALE_VOICE, language: LANGUAGE }, gatherConfig.prompt);
    }
  }

  return response.toString();
}

export function generateRecordingResponse(action) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();
  response.say(
    { voice: FEMALE_VOICE, language: LANGUAGE },
    'Apna sandesh record karne ke liye beep ke baad boliye. Khatam hone par chup ho jaiye.'
  );
  response.record({
    maxLength: 120,
    playBeep: true,
    action: action,
    method: 'POST',
    transcribe: false
  });
  return response.toString();
}

export function generateHangupResponse(message) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();
  response.say({ voice: FEMALE_VOICE, language: LANGUAGE }, message);
  response.hangup();
  return response.toString();
}

export { client as twilioClient };