import express from 'express';
import twilio from 'twilio';

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

router.post('/', async (req, res) => {
  console.log('Twilio voice webhook:', req.body);
  
  const { CallStatus, RecordingUrl } = req.body;
  
  // If call completed, just acknowledge
  if (CallStatus === 'completed') {
    return res.sendStatus(200);
  }
  
  const response = new VoiceResponse();
  
  // If we got a recording, thank and hangup
  if (RecordingUrl) {
    response.say({ voice: 'Polly.Kajal', language: 'hi-IN' }, 
      'Dhanyawaad. Aapka sandesh Simon Sir tak pahunch jayega. Namaste.');
    response.hangup();
    return res.type('text/xml').send(response.toString());
  }
  
  // First time - greet and start recording
  response.say({ voice: 'Polly.Kajal', language: 'hi-IN' },
    'Namaskar! Main DEVI hoon, Simon Sir ki assistant. Sir abhi available nahi hain. Kripya beep ke baad apna sandesh chhod dijiye.');
  
  response.record({
    maxLength: 120,
    playBeep: true,
    action: `${process.env.BASE_URL}/webhook/twilio-voice`,
    recordingStatusCallback: `${process.env.BASE_URL}/webhook/recording/complete`,
    recordingStatusCallbackMethod: 'POST',
    timeout: 2,
    finishOnKey: '#',
  });
  
  response.say({ voice: 'Polly.Kajal', language: 'hi-IN' }, 'Namaste.');
  
  return res.type('text/xml').send(response.toString());
});

export default router;