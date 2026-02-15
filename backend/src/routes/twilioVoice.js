import express from 'express';
import twilio from 'twilio';
import { updateCall } from '../db/supabase.js';

const router = express.Router();
const { VoiceResponse } = twilio.twiml;

const VOICE = 'Polly.Kajal';
const LANGUAGE = 'hi-IN';

const conversationState = new Map();

router.post('/', async (req, res) => {
  const { CallSid, SpeechResult, RecordingUrl, From, CallStatus, CallDuration } = req.body;
  
  console.log('Voice webhook received:', { CallSid, SpeechResult: !!SpeechResult, RecordingUrl: !!RecordingUrl, CallStatus });
  
  const response = new VoiceResponse();
  
  try {
    // Call completed callback
    if (CallStatus === 'completed') {
      await updateCall(CallSid, {
        call_duration: parseInt(CallDuration) || 0,
        status: 'call_completed',
      }).catch(() => {});
      conversationState.delete(CallSid);
      return res.sendStatus(200);
    }
    
    // Initialize state for new calls
    if (!conversationState.has(CallSid)) {
      conversationState.set(CallSid, {
        stage: 'greeting',
        callerNumber: From || '',
      });
    }
    
    const state = conversationState.get(CallSid);
    const ACTION_URL = `${process.env.BASE_URL}/webhook/twilio-voice`;
    
    // STAGE: Greeting
    if (state.stage === 'greeting') {
      state.stage = 'recording';
      
      response.say(
        { voice: VOICE, language: LANGUAGE },
        'Namaskar! Main DEVI hoon, Simon Sir ki assistant. Sir abhi available nahi hain. Kripya beep ke baad apna sandesh chhod dijiye.'
      );
      
      response.record({
        maxLength: 120,
        playBeep: true,
        action: ACTION_URL,
        recordingStatusCallback: `${process.env.BASE_URL}/webhook/recording/complete`,
        recordingStatusCallbackMethod: 'POST',
        timeout: 3,
        finishOnKey: '#',
      });
      
      return res.type('text/xml').send(response.toString());
    }
    
    // STAGE: Recording received
    if (state.stage === 'recording' && RecordingUrl) {
      await updateCall(CallSid, {
        voice_message_url: RecordingUrl + '.mp3'
      }).catch(() => {});
      
      response.say(
        { voice: VOICE, language: LANGUAGE },
        'Dhanyawaad. Aapka sandesh Simon Sir tak pahunch jayega. Namaste.'
      );
      response.hangup();
      
      conversationState.delete(CallSid);
      return res.type('text/xml').send(response.toString());
    }
    
    // Fallback - just hangup gracefully
    response.say(
      { voice: VOICE, language: LANGUAGE },
      'Dhanyawaad. Namaste.'
    );
    response.hangup();
    
    conversationState.delete(CallSid);
    return res.type('text/xml').send(response.toString());
    
  } catch (error) {
    console.error('Voice webhook error:', error.message);
    
    response.say(
      { voice: VOICE, language: LANGUAGE },
      'Kshama karein, technical samasya aa gayi. Kripya baad mein call karein. Namaste.'
    );
    response.hangup();
    
    return res.type('text/xml').send(response.toString());
  }
});

export default router;