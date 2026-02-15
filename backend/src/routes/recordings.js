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
  console.log('Recording webhook:', req.body);
  
  res.sendStatus(200);
  
  try {
    const { RecordingSid, CallSid } = req.body;
    
    if (!RecordingSid) {
      console.error('No RecordingSid received');
      return;
    }
    
    const recording = await twilioClient.recordings(RecordingSid).fetch();
    const publicUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;
    
    console.log('Public URL:', publicUrl);
    
    const call = await twilioClient.calls(CallSid).fetch();
    const callerNumber = call.from;
    
    await twilioClient.messages.create({
      body: `DEVI Missed Call
From: ${callerNumber}
Recording: ${publicUrl}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.USER_PHONE_NUMBER,
    });
    
    console.log('SMS sent successfully');
    
  } catch (error) {
    console.error('Recording error:', error.message);
  }
});

export default router;