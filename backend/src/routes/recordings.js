import express from 'express';
import { getCallBySid } from '../db/supabase.js';
import { twilioClient } from '../services/twilioService.js';
import { sendSMS } from '../services/smsService.js';

const router = express.Router();

router.post('/complete', async (req, res) => {
  try {
    const { CallSid, RecordingUrl, RecordingSid } = req.body;
    
    console.log('Recording complete:', { CallSid, RecordingSid });
    
    // Respond immediately to Twilio
    res.sendStatus(200);
    
    // Process in background
    const call = await getCallBySid(CallSid);
    if (!call) {
      console.error('Call not found for recording:', CallSid);
      return;
    }
    
    // Fetch the recording to get PUBLIC media URL
    const recording = await twilioClient.recordings(RecordingSid).fetch();
    
    // Create PUBLIC URL that doesn't require authentication
    // Use .uri instead of .mediaUrl for public access
    const publicUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;
    
    console.log('Public recording URL:', publicUrl);
    
    // Send simple SMS with caller number and public recording link
    const smsBody = `DEVI Missed Call
From: ${call.caller_number}
Recording: ${publicUrl}`;
    
    await sendSMS(smsBody);
    console.log('SMS sent for call:', CallSid);
    
  } catch (error) {
    console.error('Recording webhook error:', error.message);
  }
});

export default router;