#!/bin/bash

echo ""
echo "============================================="
echo "  DEVI AI - Test Backend Locally"
echo "============================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT/backend"

if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "   Run: bash scripts/02-install-dependencies.sh"
    exit 1
fi

echo "Starting DEVI backend on port 3000..."
echo ""
echo "In a SECOND terminal, test with:"
echo "  curl http://localhost:3000/health"
echo ""
echo "Press Ctrl+C to stop"
echo ""
npm run dev