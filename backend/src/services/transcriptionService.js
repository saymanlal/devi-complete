import { transcribeAudio } from './groqService.js';
import { sendWhatsAppMessage, sendWhatsAppAudio } from './whatsappService.js';
import { sendSMS } from './smsService.js';
import { updateCall } from '../db/supabase.js';

export async function processRecording(callSid, recordingUrl, callerNumber, voiceMessageUrl = null) {
  try {
    console.log(`Processing recording for ${callSid}`);

    const urlToTranscribe = voiceMessageUrl || recordingUrl;
    const transcript = await transcribeAudio(urlToTranscribe);

    if (!transcript) {
      await updateCall(callSid, { recording_url: recordingUrl, status: 'transcription_failed' });
      await sendSMS(`📞 Missed call callback completed\nFrom: ${callerNumber}\nTranscription failed but recording available:\n${recordingUrl}`);
      return;
    }

    await updateCall(callSid, {
      recording_url: recordingUrl,
      transcript: transcript,
      voice_message_url: voiceMessageUrl,
      status: 'completed'
    });

    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const message = `📞 *MISSED CALL - DEVI AI*
━━━━━━━━━━━━━━━━━━━━
👤 *Caller:* ${callerNumber}
🕐 *Time:* ${now}
━━━━━━━━━━━━━━━━━━━━
📝 *Transcript:*
${transcript}
━━━━━━━━━━━━━━━━━━━━
🎵 Recording: ${recordingUrl}${voiceMessageUrl ? `\n📨 Voice Message: ${voiceMessageUrl}` : ''}`;

    const whatsappSuccess = await sendWhatsAppMessage(message);

    if (whatsappSuccess && recordingUrl) {
      await sendWhatsAppAudio(recordingUrl, `Call from ${callerNumber}`);
      if (voiceMessageUrl) {
        await sendWhatsAppAudio(voiceMessageUrl, `Voice message from ${callerNumber}`);
      }
    } else {
      console.log('WhatsApp failed, falling back to SMS');
      await sendSMS(`Missed call from ${callerNumber}\n\nTranscript:\n${transcript}\n\nRecording: ${recordingUrl}`);
    }

  } catch (error) {
    console.error('Processing error:', error);
    await updateCall(callSid, { status: 'processing_failed' });
    try {
      await sendSMS(`Error processing call from ${callerNumber}. Recording: ${recordingUrl}`);
    } catch (smsError) {
      console.error('SMS fallback also failed:', smsError);
    }
  }
}