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
      statusCallbackMethod: 'POST',
      record: false, // We'll record via TwiML instead
      timeout: 30,
    });
    
    console.log('Callback initiated:', call.sid);
    return call.sid;
  } catch (error) {
    console.error('Twilio callback error:', error);
    throw error;
  }
}

// Function to get PUBLIC recording URL (no authentication needed)
export async function getPublicRecordingUrl(recordingSid) {
  try {
    const recording = await client.recordings(recordingSid).fetch();
    
    // Construct the PUBLIC media URL that doesn't require auth
    const publicUrl = `https://api.twilio.com${recording.mediaUrl}`;
    
    return publicUrl;
  } catch (error) {
    console.error('Error fetching recording:', error);
    return null;
  }
}

export { client as twilioClient };