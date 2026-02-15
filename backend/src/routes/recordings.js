import express from 'express';
import { getCallBySid, updateCall } from '../db/supabase.js';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

router.post('/complete', async (req, res) => {
  console.log('========================================');
  console.log('=== RECORDING WEBHOOK FIRED ===');
  console.log('Time:', new Date().toISOString());
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('========================================');
  
  res.sendStatus(200);
  
  try {
    const { CallSid, RecordingSid, RecordingUrl } = req.body;
    
    if (!RecordingSid) {
      console.error('❌ NO RecordingSid!');
      return;
    }
    
    console.log('✅ RecordingSid found:', RecordingSid);
    console.log('📞 Fetching call from database...');
    
    const call = await getCallBySid(CallSid);
    if (!call) {
      console.error('❌ Call not found in database:', CallSid);
      return;
    }
    
    console.log('✅ Call found:', call.caller_number);
    console.log('🎙️ Fetching recording from Twilio...');
    
    const recording = await twilioClient.recordings(RecordingSid).fetch();
    const publicUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;
    
    console.log('✅ Public URL created:', publicUrl);
    console.log('💾 Updating database...');
    
    await updateCall(CallSid, {
      recording_url: publicUrl,
      voice_message_url: call.voice_message_url || publicUrl,
      status: 'completed'
    }).catch(e => console.error('DB update error:', e.message));
    
    console.log('✅ Database updated');
    console.log('📱 Sending SMS to:', process.env.USER_PHONE_NUMBER);
    console.log('📱 From:', process.env.TWILIO_PHONE_NUMBER);
    
    const smsBody = `DEVI Missed Call
From: ${call.caller_number}
Recording: ${publicUrl}`;
    
    console.log('SMS Body:', smsBody);
    
    const smsResult = await twilioClient.messages.create({
      body: smsBody,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.USER_PHONE_NUMBER,
    });
    
    console.log('✅✅✅ SMS SENT SUCCESSFULLY! ✅✅✅');
    console.log('SMS SID:', smsResult.sid);
    console.log('SMS Status:', smsResult.status);
    console.log('========================================');
    
  } catch (error) {
    console.error('========================================');
    console.error('❌❌❌ RECORDING WEBHOOK ERROR ❌❌❌');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('========================================');
  }
});

export default router;
