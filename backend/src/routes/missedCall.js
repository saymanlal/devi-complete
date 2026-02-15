import express from 'express';
import { initiateCallback } from '../services/twilioService.js';
import { saveCall } from '../db/supabase.js';
import { sanitizePhoneNumber, validatePhoneNumber } from '../utils/validators.js';
import { log } from '../utils/logger.js';

const router = express.Router();
const recentCallbacks = new Map();

router.post('/', async (req, res) => {
  try {
    const { caller, timestamp } = req.body;
    
    if (!caller || !validatePhoneNumber(caller)) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }
    
    const sanitizedCaller = sanitizePhoneNumber(caller);
    const now = Date.now();
    const lastCallback = recentCallbacks.get(sanitizedCaller);
    
    if (lastCallback && (now - lastCallback) < 60000) {
      return res.json({
        success: true,
        message: 'Callback already initiated recently'
      });
    }
    
    recentCallbacks.set(sanitizedCaller, now);
    log('info', 'Missed call received', { caller: sanitizedCaller });
    
    const callSid = await initiateCallback(sanitizedCaller);
    
    await saveCall({
      caller_number: sanitizedCaller,
      twilio_call_sid: callSid,
      missed_at: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
      callback_initiated_at: new Date().toISOString()
    });
    
    res.json({
      success: true,
      callSid,
      message: 'DEVI callback initiated'
    });
    
  } catch (error) {
    log('error', 'Missed call webhook error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;