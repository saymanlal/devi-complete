import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FEMALE_VOICE = 'Polly.Aditi-Neural';
const LANGUAGE = 'hi-IN';

export async function initiateCallback(callerNumber) {
  try {
    const call = await client.calls.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: callerNumber,
      url: `${process.env.BASE_URL}/webhook/twilio-voice`,
      statusCallback: `${process.env.BASE_URL}/webhook/twilio-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      record: true,
      recordingStatusCallback: `${process.env.BASE_URL}/webhook/recording-complete`,
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
    'Apna message record karne ke liye beep ke baad bolna shuru karein. Recording khatam karne ke liye chup ho jayein.'
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