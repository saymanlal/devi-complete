import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import {
  SYSTEM_PROMPT,
  FALLBACK_RESPONSES,
  ABOUT_DEVI_RESPONSE
} from '../config/prompts.js';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// In-memory call context — acts as short-term memory per call
const callMemory = new Map();

export function initCallMemory(callSid, callerNumber) {
  callMemory.set(callSid, {
    callerNumber,
    startTime: new Date().toISOString(),
    topics: [],       // what the caller talked about
    intent: null,     // appointment / info / complaint / other
    keyPoints: [],    // important things said
  });
}

export function updateCallMemory(callSid, userText, aiText) {
  const mem = callMemory.get(callSid);
  if (!mem) return;

  // Simple intent detection
  const lower = userText.toLowerCase();
  if (!mem.intent) {
    if (/appointment|milna|booking|schedule|time/.test(lower)) mem.intent = 'appointment';
    else if (/complaint|problem|issue|problem|shikayat/.test(lower)) mem.intent = 'complaint';
    else if (/information|info|jaankari|batao|kya hai/.test(lower)) mem.intent = 'information';
    else if (/payment|paisa|amount|bill|invoice/.test(lower)) mem.intent = 'payment';
    else mem.intent = 'general';
  }

  // Store key points (first 100 chars of each user message)
  if (userText.length > 3) {
    mem.keyPoints.push(userText.substring(0, 120));
  }
}

export function getCallSummary(callSid) {
  const mem = callMemory.get(callSid);
  if (!mem) return null;
  return {
    callerNumber: mem.callerNumber,
    intent:       mem.intent || 'general',
    keyPoints:    mem.keyPoints,
    startTime:    mem.startTime,
    duration:     Math.round((Date.now() - new Date(mem.startTime)) / 1000),
  };
}

export function clearCallMemory(callSid) {
  callMemory.delete(callSid);
}

export async function transcribeAudio(audioUrl) {
  try {
    const authHeader = 'Basic ' + Buffer.from(
      process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN
    ).toString('base64');

    const audioRes = await fetch(audioUrl, {
      headers: { Authorization: authHeader }
    });

    if (!audioRes.ok) throw new Error('Audio download failed: ' + audioRes.status);

    const audioBuffer = await audioRes.arrayBuffer();
    const audioFile = new File([audioBuffer], 'recording.mp3', { type: 'audio/mpeg' });

    const transcription = await groq.audio.transcriptions.create({
      file:            audioFile,
      model:           'whisper-large-v3',
      language:        'hi',
      response_format: 'json',
    });

    return transcription.text || null;
  } catch (error) {
    console.error('Groq transcription error:', error.message);
    return null;
  }
}

export async function generateAIResponse(conversationHistory, languageHint = 'hindi') {
  try {
    // Handle "what/who are you" questions locally — no API call needed
    const lastUser = conversationHistory.filter(m => m.role === 'user').slice(-1)[0];
    if (lastUser) {
      const q = lastUser.content.toLowerCase();
      if (/kaun ho|kya ho|who are you|what are you|tumhara naam|aapka naam|introduce/.test(q)) {
        return ABOUT_DEVI_RESPONSE;
      }
    }

    const systemWithHint = languageHint === 'hinglish'
      ? SYSTEM_PROMPT + '\n\n[NOTE: Caller baat Hinglish mein kar raha/rahi hai. Unhi ke style mein jawab do.]'
      : languageHint === 'mostly-english'
      ? SYSTEM_PROMPT + '\n\n[NOTE: Caller mostly English mein bol raha/rahi hai. Hindi mein jawab do lekin unke English words naturally include karo.]'
      : SYSTEM_PROMPT;

    const completion = await groq.chat.completions.create({
      model:       'llama-3.3-70b-versatile',
      messages:    [{ role: 'system', content: systemWithHint }, ...conversationHistory],
      temperature: 0.65,
      max_tokens:  140,
      top_p:       0.9,
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('Groq AI error:', error.message);
    if (error.status === 429) return FALLBACK_RESPONSES.TECHNICAL_ERROR;
    return FALLBACK_RESPONSES.CLARIFICATION;
  }
}

export function detectLanguageMix(text) {
  if (!text) return 'hindi';
  const englishWords = (text.match(/\b[a-zA-Z]{3,}\b/g) || []).length;
  const totalWords   = text.trim().split(/\s+/).length;
  const ratio        = englishWords / totalWords;
  if (ratio > 0.55) return 'mostly-english';
  if (ratio > 0.18) return 'hinglish';
  return 'hindi';
}