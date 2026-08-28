# 🚀 Render Deployment Guide for Gram Sahayak

Gram Sahayak is packaged as a single multi-runtime Docker container containing both the **Node.js Web App** and the **Python NLU Microservice**.

---

## 📋 Step-by-Step Render Deployment

### Step 1: Push Code to GitHub / GitLab
Make sure your repository contains:
- `Dockerfile`
- `start.sh`
- `package.json`
- `server.js`
- `nlu_service/`

---

### Step 2: Create a New Web Service on Render
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** ➔ **Web Service**.
3. Connect your GitHub repository.
4. Select **Docker** as the Runtime environment.

---

### Step 3: Configure Environment Variables on Render
In the Render **Environment** settings, add the following variables:

| Key | Value | Notes |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://...` | MongoDB Cloud Connection String |
| `MONGODB_DB` | `gram_sahayak` | Database name |
| `NODE_ENV` | `production` | Production mode |

*(Note: Render automatically sets `$PORT` dynamically, which our `start.sh` automatically binds to).*

---

### Step 4: Click Deploy! 🎯
Render will automatically build the Docker image, run CSS minification, start the Python NLU microservice internally on port 8000, and launch the Node.js server publicly!

---

## ⚡ Verifying Deployment
Once deployed, Render will issue your HTTPS URL (e.g. `https://gram-sahayak.onrender.com`).
- **Citizen Portal**: `https://gram-sahayak.onrender.com`
- **Admin Portal**: `https://gram-sahayak.onrender.com/admin.html`
