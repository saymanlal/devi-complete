import express from 'express';
import { processRecording } from '../services/transcriptionService.js';
import { getCallBySid } from '../db/supabase.js';

const router = express.Router();

router.post('/complete', async (req, res) => {
  try {
    const { CallSid, RecordingUrl, RecordingSid } = req.body;

    res.sendStatus(200);

    const call = await getCallBySid(CallSid);
    if (!call) {
      console.error('Call not found for recording:', CallSid);
      return;
    }

    const fullRecordingUrl = `${RecordingUrl}.mp3`;

    processRecording(
      CallSid,
      fullRecordingUrl,
      call.caller_number,
      call.voice_message_url
    ).catch(err => console.error('Background processing error:', err));

  } catch (error) {
    console.error('Recording webhook error:', error);
    res.sendStatus(500);
  }
});

export default router;