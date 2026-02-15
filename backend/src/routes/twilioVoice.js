import express from 'express';
import twilio from 'twilio';

const router = express.Router();

router.post('/', (req, res) => {
  console.log('Voice webhook:', req.body);
  
  const twiml = new twilio.twiml.VoiceResponse();
  
  twiml.say(
    { voice: 'Polly.Kajal', language: 'hi-IN' },
    'Namaskar. Beep ke baad apna sandesh chhod dijiye.'
  );
  
  twiml.record({
    maxLength: 120,
    playBeep: true,
    recordingStatusCallback: `${process.env.BASE_URL}/webhook/recording/complete`,
    recordingStatusCallbackMethod: 'POST',
  });
  
  twiml.say({ voice: 'Polly.Kajal', language: 'hi-IN' }, 'Namaste.');
  twiml.hangup();
  
  res.type('text/xml').send(twiml.toString());
});

export default router;