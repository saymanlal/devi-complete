#!/bin/bash

echo ""
echo "============================================="
echo "  DEVI AI - Test Full System"
echo "============================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

read -p "Enter your deployed URL (e.g. https://devi-missed-call-ai.onrender.com): " BASE_URL
read -p "Enter a test phone number (with country code, e.g. +919876543210): " TEST_NUMBER

BASE_URL="${BASE_URL%/}"

echo ""
echo "--- Test 1: Health Check ---"
HEALTH=$(curl -s "$BASE_URL/health" 2>/dev/null)
if echo "$HEALTH" | grep -q "healthy"; then
    echo "✓ Backend is healthy"
else
    echo "❌ Backend health check failed"
    echo "   Response: $HEALTH"
    echo "   Check Render logs for errors"
    exit 1
fi

echo ""
echo "--- Test 2: Missed Call Simulation ---"
echo "Sending test missed call from: $TEST_NUMBER"
RESPONSE=$(curl -s -X POST "$BASE_URL/webhook/missed-call" \
    -H "Content-Type: application/json" \
    -d "{\"caller\":\"$TEST_NUMBER\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}")

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q "success"; then
    echo "✓ Missed call webhook working!"
    echo ""
    echo "📞 Check if $TEST_NUMBER received a callback from DEVI"
    echo "   DEVI should say:"
    echo "   'Namaskar, main DEVI hoon, sir ki AI assistant. Aapse baat kar rahi hoon.'"
else
    echo "❌ Webhook failed"
    echo "   Check your Twilio credentials in Render environment variables"
fi

echo ""
echo "============================================="
echo "  Test Complete!"
echo "============================================="
echo ""
echo "If callback was received:"
echo "  ✓ Talk to DEVI in Hindi or Hinglish"
echo "  ✓ Check your WhatsApp for transcript"
echo "  ✓ Check your SMS if WhatsApp fails"
echo ""