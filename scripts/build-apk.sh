#!/bin/bash

set -e

echo "=== Building Android APK ==="

cd android

echo "Cleaning previous builds..."
./gradlew clean

echo "Building release APK..."
./gradlew assembleRelease

APK_PATH="app/build/outputs/apk/release/app-release-unsigned.apk"

if [ -f "$APK_PATH" ]; then
    echo "=== APK Built Successfully ==="
    echo "Location: $APK_PATH"
    echo ""
    echo "To install on device:"
    echo "1. Enable Developer Options on your Android device"
    echo "2. Enable USB Debugging"
    echo "3. Connect device via USB"
    echo "4. Run: adb install $APK_PATH"
    echo ""
    echo "Or transfer the APK to your device and install manually"
else
    echo "Error: APK build failed"
    exit 1
fi