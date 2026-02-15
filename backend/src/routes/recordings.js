import express from 'express';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

router.post('/complete', async (req, res) => {
  console.log('=== RECORDING WEBHOOK ===');
  console.log(req.body);
  
  res.sendStatus(200);
  
  try {
    const { RecordingSid, CallSid } = req.body;
    
    if (!RecordingSid) {
      console.error('NO RecordingSid!');
      return;
    }
    
    console.log('Fetching recording:', RecordingSid);
    
    const recording = await twilioClient.recordings(RecordingSid).fetch();
    const publicUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;
    
    console.log('Public URL:', publicUrl);
    
    const call = await twilioClient.calls(CallSid).fetch();
    const callerNumber = call.from;
    
    console.log('Sending SMS to:', process.env.USER_PHONE_NUMBER);
    
    const message = await twilioClient.messages.create({
      body: `DEVI Missed Call
From: ${callerNumber}
Recording: ${publicUrl}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.USER_PHONE_NUMBER,
    });
    
    console.log('SMS SENT!', message.sid);
    
  } catch (error) {
    console.error('RECORDING ERROR:', error.message);
    console.error(error.stack);
  }
});

export default router;