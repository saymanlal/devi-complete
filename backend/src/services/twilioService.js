import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function initiateCallback(callerNumber) {
  try {
    const BASE_URL = process.env.BASE_URL;
    
    const call = await twilioClient.calls.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: callerNumber,
      url: `${BASE_URL}/webhook/twilio-voice`,
      statusCallback: `${BASE_URL}/webhook/twilio-voice`,
      statusCallbackEvent: ['completed'],
      statusCallbackMethod: 'POST',
      timeout: 30,
    });
    
    console.log('Callback initiated:', call.sid);
    return call.sid;
  } catch (error) {
    console.error('Twilio callback error:', error);
    throw error;
  }
}