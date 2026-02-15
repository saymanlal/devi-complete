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
  try {
    const { CallSid, RecordingSid } = req.body;
    
    res.sendStatus(200);
    
    const call = await getCallBySid(CallSid);
    if (!call) {
      console.error('Call not found for recording:', CallSid);
      return;
    }
    
    // ONLY CHANGE: Fetch recording to get PUBLIC URL
    const recording = await twilioClient.recordings(RecordingSid).fetch();
    const publicUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;
    
    console.log('Public recording URL:', publicUrl);
    
    // Update database with public URL
    await updateCall(CallSid, {
      recording_url: publicUrl,
      voice_message_url: call.voice_message_url || publicUrl,
      status: 'completed'
    }).catch(e => console.error('DB update error:', e.message));
    
    // Send SMS with public URL
    await twilioClient.messages.create({
      body: `DEVI Missed Call
From: ${call.caller_number}
Recording: ${publicUrl}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.USER_PHONE_NUMBER,
    });
    
    console.log('SMS sent for call:', CallSid);
    
  } catch (error) {
    console.error('Recording webhook error:', error);
  }
});

export default router;