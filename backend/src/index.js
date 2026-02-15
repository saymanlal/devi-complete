import express from 'express';
import twilio from 'twilio';
import Groq from 'groq-sdk';
import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const { VoiceResponse } = twilio.twiml;

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const BASE_URL   = process.env.BASE_URL;
const PORT       = process.env.PORT || 3000;

// conversation history + metadata per CallSid
const conversations = new Map();

/* ─── HEALTH (Android uses this to wake Render) ─────────────────── */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/* ─── MISSED CALL → trigger Twilio outbound call ────────────────── */
app.post('/webhook/missed-call', async (req, res) => {
  try {
    const caller = req.body.caller || req.body.phone;
    if (!caller) return res.status(400).json({ error: 'No caller number' });

    console.log('Missed call from:', caller);

    const call = await twilioClient.calls.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to:   caller,
      url:  `${BASE_URL}/webhook/voice`,
      statusCallback:      `${BASE_URL}/webhook/status`,
      statusCallbackEvent: ['completed'],
      record: true,
      recordingStatusCallback:      `${BASE_URL}/webhook/recording`,
      recordingStatusCallbackEvent: ['completed'],
    });

    console.log('Call started:', call.sid, '→', caller);
    res.json({ success: true, callSid: call.sid });

  } catch (err) {
    console.error('Missed call error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ─── VOICE — greeting + real AI conversation ───────────────────── */
app.all('/webhook/voice', async (req, res) => {
  const { CallSid, SpeechResult, CallTo } = req.body;
  const response = new VoiceResponse();

  // Init conversation store
  if (!conversations.has(CallSid)) {
    conversations.set(CallSid, {
      to:       CallTo || '',
      history:  [],
      turns:    0,
    });
  }
  const state = conversations.get(CallSid);

  try {
    // ── First turn: greet ────────────────────────────────────────
    if (!SpeechResult) {
      const greeting =
        'Namaskaar! Main DEVI hoon. ' +
        'Aapka call aaya tha lekin hum receive nahi kar sake. ' +
        'Kripya bataaiye, aap kyun call kiye the aur kya kaam tha?';

      state.history.push({ role: 'assistant', content: greeting });

      response.say({ voice: 'Polly.Kajal', language: 'hi-IN' }, greeting);
      response.gather({
        input:         'speech',
        language:      'hi-IN',
        speechTimeout: 'auto',
        timeout:       10,
        action:        `${BASE_URL}/webhook/voice`,
        method:        'POST',
      });
      // If caller says nothing after 10s
      response.say(
        { voice: 'Polly.Kajal', language: 'hi-IN' },
        'Koi awaaz nahi mili. Hum baad mein call karenge. Dhanyawaad. Namaskaar.'
      );
      response.hangup();

      return res.type('text/xml').send(response.toString());
    }

    // ── Subsequent turns: AI processes speech ───────────────────
    state.history.push({ role: 'user', content: SpeechResult });
    state.turns++;

    const aiReply = await getAIReply(state.history, state.turns);
    state.history.push({ role: 'assistant', content: aiReply });

    const shouldEnd =
      state.turns >= 4 ||
      /dhanyawaad|namaskaar|alvida|theek hai bas|koi kaam nahi|goodbye/i.test(aiReply);

    response.say({ voice: 'Polly.Kajal', language: 'hi-IN' }, aiReply);

    if (shouldEnd) {
      response.hangup();
    } else {
      response.gather({
        input:         'speech',
        language:      'hi-IN',
        speechTimeout: 'auto',
        timeout:       8,
        action:        `${BASE_URL}/webhook/voice`,
        method:        'POST',
      });
      response.say(
        { voice: 'Polly.Kajal', language: 'hi-IN' },
        'Koi aur baat? Nahi toh hum baad mein call karenge. Dhanyawaad.'
      );
      response.hangup();
    }

  } catch (err) {
    console.error('Voice error:', err.message);
    response.say(
      { voice: 'Polly.Kajal', language: 'hi-IN' },
      'Thodi technical samasya aa gayi. Hum aapko jaldi call karenge. Dhanyawaad.'
    );
    response.hangup();
  }

  return res.type('text/xml').send(response.toString());
});

/* ─── AI reply using Groq ────────────────────────────────────────── */
async function getAIReply(history, turns) {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `Tu DEVI hai — Simon Sir ki Hindi AI phone assistant.
Tu SIRF shuddh Hindi mein bolti hai, Roman script mein likha hoga lekin PURE Hindi words.
Kabhi bhi English words mat bol — "okay", "yes", "no", "message", "call" bhi nahi.
In ki jagah bol: theek hai, haan, nahi, sandesh, vaarta.
Teri awaaz dost jaisi, warm aur professional hai.
Tera kaam: caller ki baat samajhna, clearly confirm karna, aur Simon Sir ko poora context dena.
Jawab mein sirf 1-2 sentences — chhoti, clear baat.
Agar caller ka kaam hua ho ya woh keh de "bas" ya "theek hai" toh politely vida karo.`,
      },
      ...history,
    ],
    max_tokens:  120,
    temperature: 0.6,
  });
  return completion.choices[0].message.content.trim();
}

/* ─── CALL STATUS (completed) → send SMS ────────────────────────── */
app.all('/webhook/status', async (req, res) => {
  const { CallSid, CallStatus, CallDuration, To } = req.body;
  console.log('Call status:', CallSid, CallStatus, CallDuration + 's');

  const state = conversations.get(CallSid);
  if (state) {
    state.duration = CallDuration || '0';
    state.to       = To || state.to;
    // Try to send SMS now; recording may update it later
    await trySendSms(CallSid);
  }

  res.sendStatus(200);
});

/* ─── RECORDING READY → transcribe + update SMS ─────────────────── */
app.all('/webhook/recording', async (req, res) => {
  const { CallSid, RecordingUrl, RecordingSid } = req.body;
  console.log('Recording ready:', RecordingSid);

  const state = conversations.get(CallSid);
  if (state) {
    state.recordingUrl = RecordingUrl + '.mp3';

    // Transcribe with Groq Whisper
    try {
      const audioBuffer = await downloadAudio(
        state.recordingUrl,
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      const formData = buildMultipart(audioBuffer, 'recording.mp3');
      const whisperRes = await callGroqWhisper(formData.body, formData.boundary);
      state.whisperTranscript = whisperRes;
      console.log('Whisper transcript:', whisperRes);
    } catch (err) {
      console.error('Whisper error:', err.message);
      state.whisperTranscript = null;
    }

    await trySendSms(CallSid);
  }

  res.sendStatus(200);
});

/* ─── Send SMS with FULL transcript + audio link ─────────────────── */
async function trySendSms(callSid) {
  const state = conversations.get(callSid);
  if (!state || state.smsSent) return;

  const to       = state.to;
  const duration = state.duration || '?';

  // Build conversation transcript from history
  let convTranscript = '';
  for (const msg of (state.history || [])) {
    if (msg.role === 'user')      convTranscript += `Caller: ${msg.content}\n`;
    else if (msg.role === 'assistant') convTranscript += `DEVI: ${msg.content}\n`;
  }

  // Only send SMS once we have enough info
  if (!to) return;

  let body =
    `📞 DEVI AI — Missed Call\n` +
    `From: ${to}\n` +
    `Duration: ${duration}s\n\n`;

  if (convTranscript) {
    body += `💬 Conversation:\n${convTranscript}\n`;
  }

  if (state.whisperTranscript) {
    body += `📝 Recording Transcript:\n${state.whisperTranscript}\n\n`;
  }

  if (state.recordingUrl) {
    body += `🎵 Recording:\n${state.recordingUrl}`;
  } else {
    body += `(Recording processing...)`;
  }

  try {
    await twilioClient.messages.create({
      body: body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to:   process.env.USER_PHONE_NUMBER,
    });
    console.log('SMS sent for:', callSid);
    state.smsSent = true;
  } catch (err) {
    console.error('SMS error:', err.message);
  }
}

/* ─── Download audio from Twilio URL ────────────────────────────── */
function downloadAudio(audioUrl, sid, token) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(sid + ':' + token).toString('base64');
    const urlObj = new URL(audioUrl);
    const options = {
      hostname: urlObj.hostname,
      path:     urlObj.pathname,
      method:   'GET',
      headers:  { Authorization: 'Basic ' + auth },
    };
    const req = https.request(options, (response) => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.end();
  });
}

/* ─── Build multipart/form-data for Groq Whisper ─────────────────── */
function buildMultipart(audioBuffer, filename) {
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
  const CRLF     = '\r\n';
  const header   =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
    `Content-Type: audio/mpeg${CRLF}${CRLF}`;
  const modelPart =
    `${CRLF}--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="model"${CRLF}${CRLF}` +
    `whisper-large-v3${CRLF}` +
    `--${boundary}--${CRLF}`;

  const body = Buffer.concat([
    Buffer.from(header),
    audioBuffer,
    Buffer.from(modelPart),
  ]);
  return { body, boundary };
}

/* ─── Call Groq Whisper API directly ─────────────────────────────── */
function callGroqWhisper(body, boundary) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.groq.com',
      path:     '/openai/v1/audio/transcriptions',
      method:   'POST',
      headers:  {
        Authorization:  `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };
    const req = https.request(options, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.text || '');
        } catch {
          resolve('');
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/* ─── START ──────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`DEVI backend running on port ${PORT}`);
});