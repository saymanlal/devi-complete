import express from 'express';
import { twilioClient } from '../services/twilioService.js';
import { getCallBySid, updateCall } from '../db/supabase.js';
import { sendSMS } from '../services/smsService.js';

const router = express.Router();

router.post('/complete', async (req, res) => {
  console.log('Recording complete:', req.body);
  
  // Respond immediately
  res.sendStatus(200);
  
  try {
    const { CallSid, RecordingSid, RecordingUrl } = req.body;
    
    if (!RecordingSid) {
      console.error('No RecordingSid in webhook');
      return;
    }
    
    // Get call details
    const call = await getCallBySid(CallSid);
    if (!call) {
      console.error('Call not found:', CallSid);
      return;
    }
    
    // Fetch recording to get PUBLIC URL
    const recording = await twilioClient.recordings(RecordingSid).fetch();
    
    // Build public URL - this works WITHOUT authentication
    const publicUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;
    
    console.log('Public recording URL:', publicUrl);
    
    // Update database
    await updateCall(CallSid, {
      recording_url: publicUrl,
      status: 'completed'
    });
    
    // Send SMS with public link
    const smsBody = `DEVI Missed Call
From: ${call.caller_number}
Recording: ${publicUrl}`;
    
    await sendSMS(smsBody);
    console.log('SMS sent successfully');
    
  } catch (error) {
    console.error('Recording processing error:', error);
  }
});

export default router;