import express from 'express';
import {
  generateVoiceResponse,
  generateRecordingResponse,
  generateHangupResponse
} from '../services/twilioService.js';
import { generateAIResponse, detectLanguageMix } from '../services/groqService.js';
import {
  GREETING_TEXT,
  INITIAL_QUESTION,
  MESSAGE_PROMPT_MID,
  CLOSING_PROMPT
} from '../config/prompts.js';
import { updateCall } from '../db/supabase.js';

const router = express.Router();

const conversationState = new Map();

router.post('/', async (req, res) => {
  try {
    const callSid = req.body.CallSid;
    const speechResult = req.body.SpeechResult;
    const recordingUrl = req.body.RecordingUrl;

    if (!conversationState.has(callSid)) {
      conversationState.set(callSid, {
        history: [],
        stage: 'greeting',
        messageOffered: false,
        languageStyle: 'hindi',
        voiceMessageUrl: null
      });
    }

    const state = conversationState.get(callSid);

    if (state.stage === 'greeting') {
      state.stage = 'conversation';
      const opening = `${GREETING_TEXT} ${INITIAL_QUESTION}`;
      const twiml = generateVoiceResponse(opening, {
        action: '/webhook/twilio-voice',
        prompt: ''
      });
      return res.type('text/xml').send(twiml);
    }

    if (state.stage === 'awaiting_message_yn') {
      if (speechResult) {
        const lower = speechResult.toLowerCase();
        const agreed = lower.includes('haan') || lower.includes('yes') ||
          lower.includes('ha ') || lower.includes('zaroor') ||
          lower.includes('bilkul') || lower.includes('okay') ||
          lower.includes('thik') || lower.includes('sure');

        if (agreed) {
          state.stage = 'recording';
          const twiml = generateRecordingResponse('/webhook/twilio-voice');
          return res.type('text/xml').send(twiml);
        } else {
          state.stage = 'closing';
          const twiml = generateVoiceResponse(CLOSING_PROMPT, {
            action: '/webhook/twilio-voice',
            prompt: ''
          });
          return res.type('text/xml').send(twiml);
        }
      }
    }

    if (state.stage === 'closing') {
      if (speechResult) {
        const lower = speechResult.toLowerCase();
        const wantsMore = lower.includes('haan') || lower.includes('yes') ||
          lower.includes('message') || lower.includes('chhod') || lower.includes('bolta');
        if (wantsMore) {
          state.stage = 'recording';
          const twiml = generateRecordingResponse('/webhook/twilio-voice');
          return res.type('text/xml').send(twiml);
        }
      }
      const twiml = generateHangupResponse('Dhanyavaad. Sir ko aapka message pahuncha diya jayega. Namaste.');
      conversationState.delete(callSid);
      return res.type('text/xml').send(twiml);
    }

    if (state.stage === 'recording') {
      if (recordingUrl) {
        state.voiceMessageUrl = recordingUrl;
        await updateCall(callSid, { voice_message_url: recordingUrl });
        const twiml = generateHangupResponse(
          'Aapka message record ho gaya hai. Sir jaldi hi aapko call karenge. Dhanyavaad. Namaste.'
        );
        conversationState.delete(callSid);
        return res.type('text/xml').send(twiml);
      }
    }

    if (speechResult) {
      const langStyle = detectLanguageMix(speechResult);
      state.languageStyle = langStyle;

      state.history.push({ role: 'user', content: speechResult });

      const aiResponse = await generateAIResponse(state.history, langStyle);
      state.history.push({ role: 'assistant', content: aiResponse });

      if (state.history.length >= 4 && !state.messageOffered) {
        state.messageOffered = true;
        state.stage = 'awaiting_message_yn';
        const responseWithOffer = `${aiResponse} ${MESSAGE_PROMPT_MID}`;
        const twiml = generateVoiceResponse(responseWithOffer, {
          action: '/webhook/twilio-voice'
        });
        return res.type('text/xml').send(twiml);
      }

      const twiml = generateVoiceResponse(aiResponse, {
        action: '/webhook/twilio-voice',
        prompt: ''
      });
      return res.type('text/xml').send(twiml);
    }

    if (state.history.length === 0) {
      const twiml = generateVoiceResponse('', {
        action: '/webhook/twilio-voice',
        prompt: INITIAL_QUESTION
      });
      return res.type('text/xml').send(twiml);
    }

    if (!state.messageOffered) {
      state.messageOffered = true;
      state.stage = 'awaiting_message_yn';
      const twiml = generateVoiceResponse(MESSAGE_PROMPT_MID, {
        action: '/webhook/twilio-voice'
      });
      return res.type('text/xml').send(twiml);
    }

    const twiml = generateHangupResponse('Dhanyavaad aapke samay ke liye. Namaste.');
    conversationState.delete(callSid);
    res.type('text/xml').send(twiml);

  } catch (error) {
    console.error('Voice webhook error:', error);
    const twiml = generateHangupResponse(
      'Kshama karein, mujhe abhi thodi technical samasya aa rahi hai. Kripya thodi der baad dobara call karein.'
    );
    res.type('text/xml').send(twiml);
  }
});

router.post('/status', async (req, res) => {
  const { CallSid, CallStatus, CallDuration } = req.body;
  if (CallStatus === 'completed') {
    await updateCall(CallSid, {
      call_duration: parseInt(CallDuration) || 0,
      status: 'call_completed'
    });
    conversationState.delete(CallSid);
  }
  res.sendStatus(200);
});

export default router;