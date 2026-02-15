import express from 'express';
import { getCallBySid, updateCall } from '../db/supabase.js';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

router.post('/complete', async (req, res) => {
  console.log('=== RECORDING WEBHOOK RECEIVED ===');
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  res.sendStatus(200);
  
  try {
    const { CallSid, RecordingSid, RecordingUrl } = req.body;
    
    if (!RecordingSid) {
      console.error('NO RecordingSid in webhook!');
      return;
    }
    
    const call = await getCallBySid(CallSid);
    if (!call) {
      console.error('Call not found for recording:', CallSid);
      return;
    }
    
    console.log('Fetching recording:', RecordingSid);
    const recording = await twilioClient.recordings(RecordingSid).fetch();
    const publicUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;
    
    console.log('Public recording URL:', publicUrl);
    
    await updateCall(CallSid, {
      recording_url: publicUrl,
      voice_message_url: call.voice_message_url || publicUrl,
      status: 'completed'
    }).catch(e => console.error('DB update error:', e.message));
    
    console.log('Sending SMS to:', process.env.USER_PHONE_NUMBER);
    
    const smsResult = await twilioClient.messages.create({
      body: `DEVI Missed Call
From: ${call.caller_number}
Recording: ${publicUrl}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.USER_PHONE_NUMBER,
    });
    
    console.log('SMS SENT!', smsResult.sid);
    
  } catch (error) {
    console.error('Recording webhook error:', error.message);
    console.error('Full error:', error);
  }
});

export default router;