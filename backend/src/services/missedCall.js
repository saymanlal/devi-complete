import express from 'express';
import { initiateCallback } from '../services/twilioService.js';
import { saveCall } from '../db/supabase.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { caller, timestamp } = req.body;
    
    if (!caller) {
      return res.status(400).json({ error: 'Missing caller number' });
    }
    
    console.log('Missed call from:', caller);
    
    const callSid = await initiateCallback(caller);
    
    await saveCall({
      caller_number: caller,
      twilio_call_sid: callSid,
      missed_at: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
      callback_initiated_at: new Date().toISOString()
    });
    
    res.json({ success: true, callSid });
  } catch (error) {
    console.error('Missed call error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;