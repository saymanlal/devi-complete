#!/bin/bash
set -e

echo ""
echo "============================================="
echo "  DEVI AI - Install Backend Dependencies"
echo "============================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "[1/3] Navigating to backend..."
cd "$PROJECT_ROOT/backend"
echo "      ✓ In: $(pwd)"

echo "[2/3] Running npm install..."
npm install
echo "      ✓ Dependencies installed"

echo "[3/3] Setting up .env file..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "      ✓ .env file created from template"
    echo ""
    echo "  ⚠️  IMPORTANT: Edit backend/.env with your API keys!"
    echo "      Command: code backend/.env"
    echo ""
    echo "  Keys to fill in:"
    echo "  - TWILIO_ACCOUNT_SID"
    echo "  - TWILIO_AUTH_TOKEN"
    echo "  - TWILIO_PHONE_NUMBER"
    echo "  - USER_PHONE_NUMBER"
    echo "  - GROQ_API_KEY"
    echo "  - SUPABASE_URL"
    echo "  - SUPABASE_ANON_KEY"
    echo "  - WHATSAPP_PHONE_NUMBER_ID"
    echo "  - WHATSAPP_ACCESS_TOKEN"
    echo "  - WHATSAPP_RECIPIENT"
    echo "  - BASE_URL (set AFTER deploying to Render)"
else
    echo "      ✓ .env already exists"
fi

echo ""
echo "============================================="
echo "  ✅ Dependencies installed!"
echo "============================================="
echo ""
echo "NEXT: Fill in your API keys in backend/.env"
echo "Then run:"
echo "  bash scripts/03-test-local.sh"
echo ""