import { sendSMS, buildSmsBody } from './smsService.js';
import { updateCall } from '../db/supabase.js';
import { clearCallMemory } from './groqService.js';

export async function processRecording(callSid, recordingUrl, callerNumber, voiceMessageUrl = null) {
  try {
    console.log(`Processing recording for ${callSid}`);
    
    // Use voice message if available, otherwise main recording
    const finalUrl = voiceMessageUrl || recordingUrl;
    
    // Update database
    await updateCall(callSid, {
      recording_url: recordingUrl,
      voice_message_url: voiceMessageUrl || null,
      status: 'completed',
    }).catch(e => console.error('DB update error:', e.message));

    // Build simple SMS - just caller number and recording link
    const smsBody = buildSmsBody({
      callerNumber,
      recordingUrl: finalUrl
    });

    // Send SMS
    await sendSMS(smsBody);
    console.log('SMS sent for call:', callSid);
    
    clearCallMemory(callSid);
    
  } catch (error) {
    console.error('Processing error:', error.message);
    
    // Fallback SMS
    try {
      const fallbackUrl = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`;
      const fullFallbackUrl = fallbackUrl.includes('http') 
        ? fallbackUrl 
        : `https://api.twilio.com${fallbackUrl}`;
      
      await sendSMS(
        `DEVI Missed Call\nFrom: ${callerNumber}\nRecording: ${fullFallbackUrl}`
      );
    } catch (smsErr) {
      console.error('Fallback SMS failed:', smsErr.message);
    }
    
    await updateCall(callSid, { status: 'processing_failed' }).catch(() => {});
  }
}