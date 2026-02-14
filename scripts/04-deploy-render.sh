#!/bin/bash
set -e

echo ""
echo "============================================="
echo "  DEVI AI - Deploy to Render (FREE)"
echo "============================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

if [ ! -f "backend/.env" ]; then
    echo "❌ backend/.env not found!"
    echo "   Run: bash scripts/02-install-dependencies.sh"
    exit 1
fi

echo "Checking git setup..."
if [ ! -d ".git" ]; then
    git init
    git add .
    git commit -m "Initial DEVI AI Assistant commit"
    echo "✓ Git repo initialized"
else
    git add .
    git commit -m "Update DEVI AI project" 2>/dev/null || echo "Nothing new to commit"
    echo "✓ Git repo updated"
fi

echo ""
echo "============================================="
echo "  MANUAL STEPS FOR RENDER DEPLOYMENT"
echo "============================================="
echo ""
echo "Render doesn't have a CLI for free deployments."
echo "Follow these steps in your browser:"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "STEP 1: Push code to GitHub"
echo "───────────────────────────"
echo "  1. Go to https://github.com/new"
echo "  2. Create repo named: devi-missed-call-ai"
echo "  3. Run these commands:"
echo ""
echo "     git remote add origin https://github.com/YOUR_USERNAME/devi-missed-call-ai.git"
echo "     git branch -M main"
echo "     git push -u origin main"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "STEP 2: Create Render Web Service"
echo "──────────────────────────────────"
echo "  1. Go to https://render.com → Sign Up (free)"
echo "  2. Click: New + → Web Service"
echo "  3. Connect your GitHub repo"
echo "  4. Configure:"
echo ""
echo "     Name:            devi-missed-call-ai"
echo "     Region:          Singapore (closest to India)"
echo "     Branch:          main"
echo "     Root Directory:  backend"
echo "     Runtime:         Node"
echo "     Build Command:   npm install"
echo "     Start Command:   npm start"
echo "     Plan:            FREE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "STEP 3: Add Environment Variables in Render"
echo "────────────────────────────────────────────"
echo "  In Render dashboard → Environment → Add vars:"
echo ""

if [ -f "backend/.env" ]; then
    echo "  Copy these values from your backend/.env:"
    echo ""
    grep -v '^#' backend/.env | grep -v '^$' | grep -v 'BASE_URL' | while IFS= read -r line; do
        KEY=$(echo "$line" | cut -d'=' -f1)
        echo "     $KEY"
    done
fi

echo ""
echo "  ⚠️  Leave BASE_URL empty for now!"
echo "      You'll fill it in after first deploy."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "STEP 4: Get your Render URL"
echo "────────────────────────────"
echo "  After deploy completes (2-3 min):"
echo "  Your URL will be:"
echo "  https://devi-missed-call-ai.onrender.com"
echo ""
echo "  Test it:"
echo "  curl https://devi-missed-call-ai.onrender.com/health"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "STEP 5: Update BASE_URL"
echo "────────────────────────"
echo "  1. In Render → Environment → Add:"
echo "     BASE_URL = https://devi-missed-call-ai.onrender.com"
echo ""
echo "  2. Update backend/.env:"
echo "     BASE_URL=https://devi-missed-call-ai.onrender.com"
echo ""
echo "  3. Run to update Android URL:"
echo "     bash scripts/05-update-android-url.sh"
echo ""
echo "STEP 6: Configure Supabase Database"
echo "─────────────────────────────────────"
echo "  Run: bash scripts/06-setup-supabase.sh"
echo "  (shows the SQL to create your tables)"
echo ""
echo "============================================="
echo "  ✅ Follow steps above in browser!"
echo "============================================="