import express from 'express';
import dotenv from 'dotenv';
import twilioVoiceRouter from './routes/twilioVoice.js';
import missedCallRouter from './routes/missedCall.js';
import recordingsRouter from './routes/recordings.js';

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* ── Health (Android pings this to wake Render from sleep) ── */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/* ── Routes ── */
app.post('/webhook/missed-call',   missedCallRouter);
app.all('/webhook/twilio-voice',   twilioVoiceRouter);
app.post('/webhook/recording/complete', recordingsRouter);

/* ── Fallback for unknown routes ── */
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`DEVI backend running on port ${PORT}`);
});