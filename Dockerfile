# Multi-runtime Dockerfile for Gram Sahayak (Node.js + Python NLU Microservice)
# Compatible with Render, Railway, AWS App Runner, Fly.io, and Docker Hub

FROM node:20-bookworm-slim

# Install Python 3 and build packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Node & Python dependency manifests
COPY package*.json ./
COPY nlu_service/requirements.txt ./nlu_service/requirements.txt

# Install Node dependencies
RUN npm install

# Install Python ML & NLU dependencies
RUN pip3 install --no-cache-dir --break-system-packages -r nlu_service/requirements.txt

# Copy source code
COPY . .

# Build production Tailwind CSS
RUN npm run build:css

# Make startup script executable
RUN chmod +x start.sh

# Expose Web Port (Render binds dynamically to $PORT)
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["./start.sh"]
