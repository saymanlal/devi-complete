#!/usr/bin/env bash
set -e

echo ""
echo "============================================="
echo "  DEVI AI - Linux Setup Script"
echo "  Installs: Node.js 20, Java 17,"
echo "  Android SDK, Gradle"
echo "============================================="
echo ""

sudo apt update

# ----------------------------------------
echo "[1/5] Ensuring Node.js 20..."
if ! node -v 2>/dev/null | grep -q "v20"; then
    echo "Installing Node 20..."
    sudo apt remove -y nodejs || true
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
NODE_VERSION=$(node -v)
echo "      ✓ Node.js $NODE_VERSION active"
echo "$NODE_VERSION" | grep -q "v20" || { echo "❌ ERROR: Node 20 not active"; exit 1; }

# ----------------------------------------
echo "[2/5] Ensuring Java 17..."

# Auto-detect system-installed Java 17
JAVA_BIN=$(readlink -f $(which java))
JAVA_HOME=$(dirname $(dirname "$JAVA_BIN"))
export JAVA_HOME
export PATH=$JAVA_HOME/bin:$PATH

if ! java -version 2>&1 | grep -q "17"; then
    sudo apt install -y openjdk-17-jdk-headless
    JAVA_BIN=$(readlink -f $(which java))
    JAVA_HOME=$(dirname $(dirname "$JAVA_BIN"))
    export JAVA_HOME
    export PATH=$JAVA_HOME/bin:$PATH
fi

echo "      ✓ Java installed at $JAVA_HOME"
java -version
javac -version

# ----------------------------------------
echo "[3/5] Installing Android SDK Command Line Tools..."
ANDROID_HOME="$HOME/android-sdk"
mkdir -p "$ANDROID_HOME/cmdline-tools"
cd "$ANDROID_HOME/cmdline-tools"

if [ ! -d "latest" ]; then
    wget https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip
    unzip -q commandlinetools-linux-9477386_latest.zip
    mv cmdline-tools latest
    rm commandlinetools-linux-9477386_latest.zip
fi

echo "      ✓ Android SDK tools installed"

# ----------------------------------------
echo "[4/5] Installing Android SDK packages..."
export ANDROID_HOME="$HOME/android-sdk"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin"

yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
echo "      ✓ Android SDK packages installed"

# ----------------------------------------
echo "[5/5] Installing Gradle 8.0..."
if ! command -v gradle &> /dev/null; then
    cd /tmp
    wget https://services.gradle.org/distributions/gradle-8.0-bin.zip
    sudo unzip -q -d /opt/gradle gradle-8.0-bin.zip
    rm gradle-8.0-bin.zip
    sudo ln -sf /opt/gradle/gradle-8.0/bin/gradle /usr/local/bin/gradle
fi
echo "      ✓ Gradle installed"

echo ""
echo "============================================="
echo "  ✅ Setup Complete!"
echo "============================================="
echo ""
echo "Verify with:"
echo "  node -v"
echo "  java -version"
echo "  sdkmanager --version"
echo "  gradle -v"
echo ""
