#!/bin/bash
set -e

echo "🚀 Starting Gram Sahayak NLU Microservice (Python FastAPI)..."
python3 -m uvicorn nlu_service.main:app --host 127.0.0.1 --port 8000 &

echo "⌛ Waiting for NLU service initialization..."
sleep 3

echo "🌐 Starting Gram Sahayak Web Server (Node.js) on PORT ${PORT:-3000}..."
exec node server.js
