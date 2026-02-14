#!/bin/bash

set -e

echo "=== Deploying to Fly.io ==="

cd backend

if [ ! -f ".env" ]; then
    echo "Error: .env file not found"
    echo "Copy .env.example to .env and fill in your credentials"
    exit 1
fi

echo "Installing flyctl if not present..."
if ! command -v flyctl &> /dev/null; then
    curl -L https://fly.io/install.sh | sh
fi

echo "Logging into Fly.io..."
flyctl auth login

echo "Creating Fly app (if not exists)..."
if ! flyctl apps list | grep -q "missed-call-ai-assistant"; then
    flyctl apps create missed-call-ai-assistant --org personal
fi

echo "Setting secrets..."
flyctl secrets set \
    TWILIO_ACCOUNT_SID="$(grep TWILIO_ACCOUNT_SID .env | cut -d '=' -f2)" \
    TWILIO_AUTH_TOKEN="$(grep TWILIO_AUTH_TOKEN .env | cut -d '=' -f2)" \
    TWILIO_PHONE_NUMBER="$(grep TWILIO_PHONE_NUMBER .env | cut -d '=' -f2)" \
    USER_PHONE_NUMBER="$(grep USER_PHONE_NUMBER .env | cut -d '=' -f2)" \
    GROQ_API_KEY="$(grep GROQ_API_KEY .env | cut -d '=' -f2)" \
    SUPABASE_URL="$(grep SUPABASE_URL .env | cut -d '=' -f2)" \
    SUPABASE_ANON_KEY="$(grep SUPABASE_ANON_KEY .env | cut -d '=' -f2)" \
    WHATSAPP_PHONE_NUMBER_ID="$(grep WHATSAPP_PHONE_NUMBER_ID .env | cut -d '=' -f2)" \
    WHATSAPP_BUSINESS_ACCOUNT_ID="$(grep WHATSAPP_BUSINESS_ACCOUNT_ID .env | cut -d '=' -f2)" \
    WHATSAPP_ACCESS_TOKEN="$(grep WHATSAPP_ACCESS_TOKEN .env | cut -d '=' -f2)" \
    WHATSAPP_RECIPIENT="$(grep WHATSAPP_RECIPIENT .env | cut -d '=' -f2)"

echo "Deploying application..."
flyctl deploy

echo "Getting app URL..."
APP_URL=$(flyctl info --json | grep -o '"Hostname":"[^"]*"' | cut -d'"' -f4)
echo "App deployed at: https://$APP_URL"

echo "Updating BASE_URL secret..."
flyctl secrets set BASE_URL="https://$APP_URL"

echo "=== Deployment Complete ==="
echo "Your backend is live at: https://$APP_URL"
echo "Update this URL in your Android app settings"