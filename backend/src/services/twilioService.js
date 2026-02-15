import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function initiateCallback(callerNumber) {
  try {
    const BASE_URL = process.env.BASE_URL;

    const call = await client.calls.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: callerNumber,
      url: `${BASE_URL}/webhook/twilio-voice`,
      statusCallback: `${BASE_URL}/webhook/twilio-voice`,
      statusCallbackEvent: ['completed'],
      record: true,
      recordingStatusCallback: `${BASE_URL}/webhook/recording/complete`,
      recordingStatusCallbackEvent: ['completed'],
      timeout: 30,
      // machineDetection REMOVED - causes "application error" on trial accounts
    });
    
    console.log('Callback initiated:', call.sid);
    return call.sid;
  } catch (error) {
    console.error('Twilio callback error:', error);
    throw error;
  }
}

export { client as twilioClient };