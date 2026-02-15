import express from 'express';
import twilio from 'twilio';

const router = express.Router();

router.post('/', (req, res) => {
  console.log('Voice webhook called');
  
  const twiml = new twilio.twiml.VoiceResponse();
  
  // Add Play instead of Say to bypass trial issues
  twiml.play('http://demo.twilio.com/docs/classic.mp3');
  
  twiml.record({
    maxLength: 120,
    playBeep: true,
    recordingStatusCallback: `${process.env.BASE_URL}/webhook/recording/complete`,
    recordingStatusCallbackMethod: 'POST',
    timeout: 2,
    finishOnKey: '#',
  });
  
  twiml.hangup();
  
  res.type('text/xml').send(twiml.toString());
});

export default router;