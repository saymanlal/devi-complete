import express from 'express';
import { getCallBySid, updateCall } from '../db/supabase.js';
import { twilioClient } from '../services/twilioService.js';
import { sendSMS } from '../services/smsService.js';

const router = express.Router();

router.post('/complete', async (req, res) => {
  try {
    const { CallSid, RecordingUrl, RecordingSid } = req.body;
    
    // Respond immediately to Twilio
    res.sendStatus(200);
    
    const call = await getCallBySid(CallSid);
    if (!call) {
      console.error('Call not found for recording:', CallSid);
      return;
    }
    
    // Fetch recording to get PUBLIC URL (no auth required)
    const recording = await twilioClient.recordings(RecordingSid).fetch();
    
    // Build public URL - .uri is publicly accessible without authentication
    const publicUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;
    
    console.log('Public recording URL:', publicUrl);
    
    // Update database
    await updateCall(CallSid, {
      recording_url: publicUrl,
      status: 'completed'
    }).catch(e => console.error('DB update error:', e.message));
    
    // Send simple SMS with caller number and public recording link
    const smsBody = `DEVI Missed Call
From: ${call.caller_number}
Recording: ${publicUrl}`;
    
    await sendSMS(smsBody);
    console.log('SMS sent for call:', CallSid);
    
  } catch (error) {
    console.error('Recording webhook error:', error);
  }
});

export default router;