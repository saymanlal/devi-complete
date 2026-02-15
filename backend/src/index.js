import express from 'express';
import dotenv from 'dotenv';
import twilioVoiceRouter from './routes/twilioVoice.js';
import missedCallRouter from './routes/missedCall.js';
import recordingsRouter from './routes/recordings.js';
import { initDatabase } from './db/supabase.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/webhook/missed-call', missedCallRouter);
app.use('/webhook/twilio-voice', twilioVoiceRouter);
app.use('/webhook/recording', recordingsRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

app.listen(PORT, async () => {
  console.log(`DEVI backend running on port ${PORT}`);
  await initDatabase();
});