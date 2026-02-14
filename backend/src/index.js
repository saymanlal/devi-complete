import express from 'express';
import twilio from 'twilio';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Store conversation state
const conversations = new Map();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Receive missed call notification from Android app
app.post('/webhook/missed-call', async (req, res) => {
  try {
    const { caller, timestamp } = req.body;
    
    console.log('Missed call from:', caller);

    // Initiate callback
    const call = await twilioClient.calls.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: caller,
      url: `${process.env.BASE_URL}/webhook/voice`,
      statusCallback: `${process.env.BASE_URL}/webhook/status`,
      statusCallbackEvent: ['completed'],
      record: true,
      recordingStatusCallback: `${process.env.BASE_URL}/webhook/recording`,
      recordingStatusCallbackEvent: ['completed']
    });

    console.log('Callback initiated:', call.sid);

    res.json({
      success: true,
      callSid: call.sid,
      message: 'DEVI callback initiated'
    });

  } catch (error) {
    console.error('Missed call error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle voice interaction
app.post('/webhook/voice', async (req, res) => {
  try {
    const { CallSid, SpeechResult, RecordingUrl } = req.body;
    
    console.log('Voice webhook:', { CallSid, SpeechResult });

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    // Initialize conversation if new
    if (!conversations.has(CallSid)) {
      conversations.set(CallSid, {
        messages: [],
        stage: 'greeting'
      });
    }

    const state = conversations.get(CallSid);

    // Greeting stage
    if (state.stage === 'greeting') {
      response.say({
        voice: 'Polly.Aditi',
        language: 'hi-IN'
      }, 'Namaskar, main DEVI hoon. Aap kyun call kiye the?');

      response.gather({
        input: 'speech',
        language: 'hi-IN',
        speechTimeout: 'auto',
        action: '/webhook/voice',
        method: 'POST'
      });

      state.stage = 'listening';
      res.type('text/xml').send(response.toString());
      return;
    }

    // Process speech
    if (SpeechResult && state.stage === 'listening') {
      state.messages.push({ role: 'user', content: SpeechResult });

      // Check if user wants to leave message
      const lower = SpeechResult.toLowerCase();
      if (lower.includes('message') || lower.includes('chhod') || state.messages.length >= 2) {
        response.say({
          voice: 'Polly.Aditi',
          language: 'hi-IN'
        }, 'Apna message record karne ke liye beep ke baad bolein.');

        response.record({
          maxLength: 120,
          playBeep: true,
          action: '/webhook/voice-end',
          method: 'POST'
        });

        state.stage = 'recording';
        res.type('text/xml').send(response.toString());
        return;
      }

      // Generate AI response
      try {
        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are DEVI, a Hindi-speaking AI assistant. Respond in 1-2 sentences only in Hindi. Be helpful and concise.'
            },
            ...state.messages
          ],
          temperature: 0.7,
          max_tokens: 100
        });

        const aiResponse = completion.choices[0].message.content;
        state.messages.push({ role: 'assistant', content: aiResponse });

        response.say({
          voice: 'Polly.Aditi',
          language: 'hi-IN'
        }, aiResponse);

        response.gather({
          input: 'speech',
          language: 'hi-IN',
          speechTimeout: 'auto',
          action: '/webhook/voice',
          method: 'POST'
        });

      } catch (error) {
        console.error('Groq error:', error);
        response.say({
          voice: 'Polly.Aditi',
          language: 'hi-IN'
        }, 'Maaf kijiye, thoda technical problem hai. Kya aap message chhod sakte hain?');

        response.record({
          maxLength: 120,
          playBeep: true,
          action: '/webhook/voice-end'
        });
      }

      res.type('text/xml').send(response.toString());
      return;
    }

    // Default: end call
    response.say({
      voice: 'Polly.Aditi',
      language: 'hi-IN'
    }, 'Dhanyavaad. Namaste.');
    response.hangup();

    res.type('text/xml').send(response.toString());

  } catch (error) {
    console.error('Voice webhook error:', error);
    
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say({ voice: 'Polly.Aditi', language: 'hi-IN' }, 'Technical error hai. Kripya baad mein call karein.');
    response.hangup();
    
    res.type('text/xml').send(response.toString());
  }
});

// Handle voice message end
app.post('/webhook/voice-end', (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();
  
  response.say({
    voice: 'Polly.Aditi',
    language: 'hi-IN'
  }, 'Aapka message record ho gaya hai. Dhanyavaad.');
  
  response.hangup();
  
  res.type('text/xml').send(response.toString());
});

// Handle recording completion
app.post('/webhook/recording', async (req, res) => {
  try {
    const { CallSid, RecordingUrl, RecordingSid, From } = req.body;
    
    console.log('Recording completed:', { CallSid, RecordingUrl });

    const recordingLink = `${RecordingUrl}.mp3`;
    
    // Transcribe using Groq Whisper
    let transcript = '';
    try {
      const audioResponse = await fetch(recordingLink, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`
        }
      });
      
      const audioBuffer = await audioResponse.arrayBuffer();
      const audioFile = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' });

      const transcription = await groq.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-large-v3',
        language: 'hi'
      });

      transcript = transcription.text;
    } catch (error) {
      console.error('Transcription error:', error);
      transcript = '[Transcription unavailable]';
    }

    // Send SMS with transcript and audio link
    const smsBody = `📞 DEVI AI Missed Call\n\nFrom: ${From}\n\nTranscript:\n${transcript}\n\nRecording: ${recordingLink}`;

    await twilioClient.messages.create({
      body: smsBody,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.USER_PHONE_NUMBER
    });

    console.log('SMS sent with transcript and recording link');

    res.sendStatus(200);

  } catch (error) {
    console.error('Recording webhook error:', error);
    res.sendStatus(500);
  }
});

// Handle call status
app.post('/webhook/status', (req, res) => {
  const { CallSid, CallStatus } = req.body;
  console.log('Call status:', { CallSid, CallStatus });
  
  if (CallStatus === 'completed') {
    conversations.delete(CallSid);
  }
  
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DEVI backend running on port ${PORT}`);
});