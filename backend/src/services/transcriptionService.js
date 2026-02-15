import { transcribeAudio, getCallSummary, clearCallMemory } from './groqService.js';
import { sendSMS, buildSmsBody } from './smsService.js';
import { updateCall } from '../db/supabase.js';

export async function processRecording(callSid, recordingUrl, callerNumber, voiceMessageUrl = null) {
  try {
    console.log('Processing recording for ' + callSid);

    const urlToTranscribe = voiceMessageUrl || recordingUrl;
    const transcript = await transcribeAudio(urlToTranscribe);

    const summary = getCallSummary(callSid);
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Update DB
    await updateCall(callSid, {
      recording_url:     recordingUrl,
      transcript:        transcript || null,
      voice_message_url: voiceMessageUrl || null,
      status:            transcript ? 'completed' : 'transcription_failed',
    }).catch(e => console.error('DB update error:', e.message));

    // Ensure .mp3 extension on recording URL
    const mp3Url = recordingUrl.endsWith('.mp3') ? recordingUrl : recordingUrl + '.mp3';

    // Build SMS
    const smsBody = buildSmsBody({
      callerNumber,
      intent:       summary?.intent    || 'general',
      keyPoints:    summary?.keyPoints || [],
      transcript:   transcript         || null,
      recordingUrl: mp3Url,
      duration:     summary?.duration  || null,
      time:         now,
    });

    await sendSMS(smsBody);
    console.log('SMS sent for call: ' + callSid);

    clearCallMemory(callSid);

  } catch (error) {
    console.error('Processing error:', error.message);

    // Fallback — always send something
    try {
      const fallbackUrl = recordingUrl.endsWith('.mp3') ? recordingUrl : recordingUrl + '.mp3';
      await sendSMS(
        'DEVI: ' + callerNumber + ' | Recording: ' + fallbackUrl
      );
    } catch (smsErr) {
      console.error('Fallback SMS failed:', smsErr.message);
    }

    await updateCall(callSid, { status: 'processing_failed' }).catch(() => {});
  }
}