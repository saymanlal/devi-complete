import express from 'express';
import twilio from 'twilio';
import {
  generateAIResponse,
  detectLanguageMix,
  initCallMemory,
  updateCallMemory,
  getCallSummary,
} from '../services/groqService.js';
import { sendSMS, buildSmsBody, twilioClient } from '../services/smsService.js';
import { processRecording } from '../services/transcriptionService.js';
import {
  GREETING_TEXT,
  INITIAL_QUESTION,
  MESSAGE_PROMPT_MID,
  CLOSING_PROMPT,
} from '../config/prompts.js';
import { saveCall, updateCall } from '../db/supabase.js';

const router = express.Router();
const { VoiceResponse } = twilio.twiml;

// Voice = 'Polly.Kajal' — AWS Neural Hindi, best Indian accent on Twilio
const VOICE    = 'Polly.Kajal';
const LANGUAGE = 'hi-IN';

const conversationState = new Map();

// ── Helper: build TwiML with gather ─────────────────────────────────
function sayAndGather(response, text, actionUrl) {
  response.say({ voice: VOICE, language: LANGUAGE }, text);
  response.gather({
    input:         'speech',
    language:      LANGUAGE,
    speechTimeout: 'auto',
    timeout:       10,
    action:        actionUrl,
    method:        'POST',
  });
}

// ── Helper: hangup with final message ───────────────────────────────
function sayAndHangup(response, text) {
  response.say({ voice: VOICE, language: LANGUAGE }, text);
  response.hangup();
}

// ── Main voice handler ───────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    CallSid,
    SpeechResult,
    RecordingUrl,
    From,
    CallStatus,
    CallDuration,
  } = req.body;

  const ACTION = `${process.env.BASE_URL}/webhook/twilio-voice`;
  const response = new VoiceResponse();

  // ── Call completed status callback ──────────────────────────────
  if (CallStatus === 'completed') {
    await updateCall(CallSid, {
      call_duration: parseInt(CallDuration) || 0,
      status: 'call_completed',
    }).catch(() => {});
    conversationState.delete(CallSid);
    return res.sendStatus(200);
  }

  // ── Init state ───────────────────────────────────────────────────
  if (!conversationState.has(CallSid)) {
    conversationState.set(CallSid, {
      history:        [],
      stage:          'greeting',
      messageOffered: false,
      languageStyle:  'hindi',
      voiceMessageUrl: null,
      callerNumber:   From || '',
    });
    initCallMemory(CallSid, From || '');
  }

  const state = conversationState.get(CallSid);

  try {

    // ── GREETING (first contact) ──────────────────────────────────
    if (state.stage === 'greeting') {
      state.stage = 'conversation';
      const opening = `${GREETING_TEXT} ${INITIAL_QUESTION}`;
      state.history.push({ role: 'assistant', content: opening });
      sayAndGather(response, opening, ACTION);
      return res.type('text/xml').send(response.toString());
    }

    // ── RECORDING stage: recording URL has arrived ────────────────
    if (state.stage === 'recording' && RecordingUrl) {
      state.voiceMessageUrl = RecordingUrl + '.mp3';
      await updateCall(CallSid, { voice_message_url: state.voiceMessageUrl }).catch(() => {});
      sayAndHangup(
        response,
        'Aapka sandesh record ho gaya hai. Simon Sir jaise hi available honge, sun lenge. Dhanyawaad. Namaste.'
      );
      conversationState.delete(CallSid);
      return res.type('text/xml').send(response.toString());
    }

    // ── AWAITING YES/NO for voice message ────────────────────────
    if (state.stage === 'awaiting_message_yn') {
      if (SpeechResult) {
        const lower = SpeechResult.toLowerCase();
        const agreed =
          /haan|yes|ha |zaroor|bilkul|okay|thik|sure|chhod|bolta|record|message/.test(lower);

        if (agreed) {
          state.stage = 'recording';
          response.say(
            { voice: VOICE, language: LANGUAGE },
            'Bilkul. Beep ke baad apna sandesh boliye. Jab khatam ho jaye toh line kaatiye.'
          );
          response.record({
            maxLength:   120,
            playBeep:    true,
            action:      ACTION,
            method:      'POST',
            timeout:     5,
            finishOnKey: '#',
          });
          return res.type('text/xml').send(response.toString());
        } else {
          state.stage = 'closing';
          sayAndGather(response, CLOSING_PROMPT, ACTION);
          return res.type('text/xml').send(response.toString());
        }
      }
    }

    // ── CLOSING stage ────────────────────────────────────────────
    if (state.stage === 'closing') {
      if (SpeechResult) {
        const lower = SpeechResult.toLowerCase();
        const wantsMore =
          /haan|yes|message|chhod|bolta|aur|kuch|batana/.test(lower);

        if (wantsMore) {
          state.stage = 'recording';
          response.say(
            { voice: VOICE, language: LANGUAGE },
            'Zaroor. Beep ke baad boliye.'
          );
          response.record({
            maxLength:   120,
            playBeep:    true,
            action:      ACTION,
            method:      'POST',
            timeout:     5,
            finishOnKey: '#',
          });
          return res.type('text/xml').send(response.toString());
        }
      }

      sayAndHangup(
        response,
        'Theek hai. Aapka kaam main Simon Sir ko bata dungi. Dhanyawaad. Namaste.'
      );
      conversationState.delete(CallSid);
      return res.type('text/xml').send(response.toString());
    }

    // ── MAIN CONVERSATION ─────────────────────────────────────────
    if (SpeechResult) {
      const langStyle = detectLanguageMix(SpeechResult);
      state.languageStyle = langStyle;

      state.history.push({ role: 'user', content: SpeechResult });
      updateCallMemory(CallSid, SpeechResult, '');

      const aiResponse = await generateAIResponse(state.history, langStyle);
      state.history.push({ role: 'assistant', content: aiResponse });

      // After 3 user turns, offer voice message
      const userTurns = state.history.filter(m => m.role === 'user').length;
      if (userTurns >= 3 && !state.messageOffered) {
        state.messageOffered = true;
        state.stage = 'awaiting_message_yn';
        const withOffer = `${aiResponse} ${MESSAGE_PROMPT_MID}`;
        sayAndGather(response, withOffer, ACTION);
        return res.type('text/xml').send(response.toString());
      }

      sayAndGather(response, aiResponse, ACTION);
      return res.type('text/xml').send(response.toString());
    }

    // ── No speech detected ───────────────────────────────────────
    if (!state.messageOffered) {
      state.messageOffered = true;
      state.stage = 'awaiting_message_yn';
      sayAndGather(response, MESSAGE_PROMPT_MID, ACTION);
      return res.type('text/xml').send(response.toString());
    }

    sayAndHangup(
      response,
      'Koi baat nahi. Aapka kaam pahuncha diya jayega. Dhanyawaad. Namaste.'
    );
    conversationState.delete(CallSid);
    return res.type('text/xml').send(response.toString());

  } catch (error) {
    console.error('Voice webhook error:', error.message);
    sayAndHangup(
      response,
      'Kshama karein, thodi technical samasya aa gayi. Simon Sir jaldi aapko call karenge. Namaste.'
    );
    return res.type('text/xml').send(response.toString());
  }
});

export default router;