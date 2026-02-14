#!/bin/bash
set -e

echo ""
echo "============================================="
echo "  DEVI AI - Update Android Backend URL"
echo "============================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

read -p "Enter your Render URL (e.g. https://devi-missed-call-ai.onrender.com): " RENDER_URL

if [ -z "$RENDER_URL" ]; then
    echo "❌ URL cannot be empty"
    exit 1
fi

if [[ ! "$RENDER_URL" =~ ^https:// ]]; then
    echo "❌ URL must start with https://"
    exit 1
fi

TRAILING_STRIPPED="${RENDER_URL%/}"

JAVA_FILE="$PROJECT_ROOT/android/app/src/main/java/com/missedcallai/CallMonitorService.java"

sed -i "s|https://your-service.onrender.com|$TRAILING_STRIPPED|g" "$JAVA_FILE"

echo "✓ Android URL updated to: $TRAILING_STRIPPED"

ENV_FILE="$PROJECT_ROOT/backend/.env"
if [ -f "$ENV_FILE" ]; then
    if grep -q "BASE_URL=" "$ENV_FILE"; then
        sed -i "s|BASE_URL=.*|BASE_URL=$TRAILING_STRIPPED|g" "$ENV_FILE"
    else
        echo "BASE_URL=$TRAILING_STRIPPED" >> "$ENV_FILE"
    fi
    echo "✓ backend/.env BASE_URL updated"
fi

echo ""
echo "============================================="
echo "  ✅ URL Updated!"
echo "============================================="
echo ""
echo "NEXT: Build your APK"
echo "  bash scripts/07-build-apk.sh"
echo ""