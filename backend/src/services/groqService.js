import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import { SYSTEM_PROMPT, FALLBACK_RESPONSES } from '../config/prompts.js';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function transcribeAudio(audioUrl) {
  try {
    const response = await fetch(audioUrl);
    const audioBuffer = await response.arrayBuffer();
    const audioFile = new File([audioBuffer], 'audio.wav', { type: 'audio/wav' });

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3',
      language: 'hi',
      response_format: 'json'
    });

    return transcription.text;
  } catch (error) {
    console.error('Groq transcription error:', error);
    return null;
  }
}

export async function generateAIResponse(conversationHistory, languageHint = 'hindi') {
  try {
    const systemWithHint = languageHint === 'hinglish'
      ? SYSTEM_PROMPT + '\n\n[CONTEXT: Caller is speaking Hinglish. Mirror their style - use same English words they used but keep Hindi as base language. Do NOT switch fully to English.]'
      : SYSTEM_PROMPT;

    const messages = [
      { role: 'system', content: systemWithHint },
      ...conversationHistory
    ];

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: messages,
      temperature: 0.7,
      max_tokens: 150,
      top_p: 0.9
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Groq AI response error:', error);
    if (error.status === 429) {
      return FALLBACK_RESPONSES.TECHNICAL_ERROR;
    }
    return 'Maaf kijiye, mujhe thoda technical problem aa rahi hai. Kya aap dobara bol sakti hain?';
  }
}

export function detectLanguageMix(text) {
  if (!text) return 'hindi';
  const englishWords = text.match(/[a-zA-Z]{3,}/g) || [];
  const totalWords = text.split(/\s+/).length;
  const ratio = englishWords.length / totalWords;
  if (ratio > 0.5) return 'mostly-english';
  if (ratio > 0.15) return 'hinglish';
  return 'hindi';
}