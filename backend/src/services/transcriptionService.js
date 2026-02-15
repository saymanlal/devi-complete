import { sendSMS } from './smsService.js';
import { updateCall } from '../db/supabase.js';
import { clearCallMemory } from './groqService.js';

export async function processRecording(callSid, recordingUrl, callerNumber, voiceMessageUrl = null) {
  try {
    console.log(`Processing recording for ${callSid}`);
    
    const finalUrl = voiceMessageUrl || recordingUrl;
    
    await updateCall(callSid, {
      recording_url: recordingUrl,
      voice_message_url: voiceMessageUrl || null,
      status: 'completed',
    }).catch(e => console.error('DB update error:', e.message));

    let fullUrl = finalUrl;
    if (!finalUrl.includes('http')) {
      fullUrl = `https://api.twilio.com${finalUrl}`;
    }
    if (!fullUrl.endsWith('.mp3')) {
      fullUrl = `${fullUrl}.mp3`;
    }

    const smsBody = `DEVI Missed Call
From: ${callerNumber}
Recording: ${fullUrl}`;

    await sendSMS(smsBody);
    console.log('SMS sent for call:', callSid);
    
    clearCallMemory(callSid);
    
  } catch (error) {
    console.error('Processing error:', error.message);
    
    try {
      let fallbackUrl = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`;
      if (!fallbackUrl.includes('http')) {
        fallbackUrl = `https://api.twilio.com${fallbackUrl}`;
      }
      
      await sendSMS(`DEVI Missed Call\nFrom: ${callerNumber}\nRecording: ${fallbackUrl}`);
    } catch (smsErr) {
      console.error('Fallback SMS failed:', smsErr.message);
    }
    
    await updateCall(callSid, { status: 'processing_failed' }).catch(() => {});
  }
}
