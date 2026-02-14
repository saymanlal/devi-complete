#!/bin/bash
set -e

echo "Building DEVI Android App..."

cd "$(dirname "$0")/../android"

if [ ! -f gradlew ]; then
    gradle wrapper
    chmod +x gradlew
fi

./gradlew clean assembleDebug

APK="app/build/outputs/apk/debug/app-debug.apk"

if [ -f "$APK" ]; then
    echo ""
    echo "✅ BUILD SUCCESS"
    echo "APK: $APK"
    echo "Size: $(du -h "$APK" | cut -f1)"
    echo ""
    echo "Install: adb install -r $APK"
else
    echo ""
    echo "❌ BUILD FAILED - APK not found"
    exit 1
fi
