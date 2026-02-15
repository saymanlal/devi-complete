import express from 'express';
import twilio from 'twilio';
import { updateCall } from '../db/supabase.js';

const router = express.Router();
const { VoiceResponse } = twilio.twiml;

const VOICE = 'Polly.Kajal';
const LANGUAGE = 'hi-IN';

router.post('/', async (req, res) => {
  const { CallSid, RecordingUrl, CallStatus, CallDuration } = req.body;
  
  const response = new VoiceResponse();
  
  try {
    // Handle call completion status callback
    if (CallStatus === 'completed') {
      await updateCall(CallSid, {
        call_duration: parseInt(CallDuration) || 0,
        status: 'call_completed',
      }).catch(() => {});
      return res.sendStatus(200);
    }
    
    // If we received a recording, thank and hangup
    if (RecordingUrl) {
      await updateCall(CallSid, {
        voice_message_url: RecordingUrl + '.mp3'
      }).catch(() => {});
      
      response.say(
        { voice: VOICE, language: LANGUAGE },
        'Dhanyawaad. Aapka sandesh Simon Sir tak pahunch jayega. Namaste.'
      );
      response.hangup();
      return res.type('text/xml').send(response.toString());
    }
    
    // First call - greet and start recording
    response.say(
      { voice: VOICE, language: LANGUAGE },
      'Namaskar! Main DEVI hoon, Simon Sir ki assistant. Sir abhi available nahi hain. Kripya beep ke baad apna sandesh chhod dijiye.'
    );
    
    response.record({
      maxLength: 120,
      playBeep: true,
      action: `${process.env.BASE_URL}/webhook/twilio-voice`,
      recordingStatusCallback: `${process.env.BASE_URL}/webhook/recording/complete`,
      recordingStatusCallbackMethod: 'POST',
      timeout: 3,
      finishOnKey: '#',
    });
    
    response.say({ voice: VOICE, language: LANGUAGE }, 'Namaste.');
    
    return res.type('text/xml').send(response.toString());
    
  } catch (error) {
    console.error('Voice webhook error:', error.message);
    response.say(
      { voice: VOICE, language: LANGUAGE },
      'Kshama karein, technical samasya aa gayi. Namaste.'
    );
    response.hangup();
    return res.type('text/xml').send(response.toString());
  }
});

export default router;