#!/bin/bash

echo ""
echo "============================================="
echo "  DEVI AI - Supabase Database Setup"
echo "============================================="
echo ""
echo "1. Go to https://supabase.com → New Project"
echo "2. Project name: devi-ai"
echo "3. Set a strong database password"
echo "4. Region: Southeast Asia (Singapore)"
echo "5. Click 'Create new project'"
echo ""
echo "6. After project is created:"
echo "   Settings → API → Copy:"
echo "   - Project URL  → SUPABASE_URL in .env"
echo "   - anon key     → SUPABASE_ANON_KEY in .env"
echo ""
echo "7. Go to SQL Editor and run this SQL:"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat << 'SQLEOF'

-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS calls (
  id SERIAL PRIMARY KEY,
  caller_number VARCHAR(20) NOT NULL,
  twilio_call_sid VARCHAR(100) UNIQUE,
  missed_at TIMESTAMP DEFAULT NOW(),
  callback_initiated_at TIMESTAMP,
  call_duration INTEGER,
  recording_url TEXT,
  transcript TEXT,
  voice_message_url TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_number);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_sid ON calls(twilio_call_sid);

SQLEOF
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "8. After running SQL, update backend/.env:"
echo "   SUPABASE_URL=https://xxxxx.supabase.co"
echo "   SUPABASE_ANON_KEY=eyJxxxxxxxx"
echo ""
echo "9. Also update these in Render dashboard"
echo "   (Environment Variables section)"
echo ""
echo "============================================="
echo "  ✅ Copy the SQL above and run it in Supabase"
echo "============================================="