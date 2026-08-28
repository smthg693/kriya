# 🚀 Render Deployment Guide for Gram Sahayak

Gram Sahayak is packaged as a single multi-runtime Docker container containing both the **Node.js Web App** and the **Python NLU Microservice**.

---

## ✅ Pre-Deployment Checklist

Before deploying, confirm these are done:

- [ ] **Rotate MongoDB password** — Go to [MongoDB Atlas](https://cloud.mongodb.com) → Database Access → Edit user → Reset password, then update your local `.env`
- [ ] GitHub repo is up to date (`git push` done)
- [ ] `.env` is listed in `.gitignore` (credentials never committed ✅)

---

## 📋 Step-by-Step Render Deployment

### Step 1: Push Code to GitHub
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
In the Render **Environment** settings, add **all** of the following:

| Key | Value | Notes |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.../gram_sahayak` | Your Atlas connection string |
| `MONGODB_DB` | `gram_sahayak` | Database name |
| `NODE_ENV` | `production` | Enables production mode |
| `SEED_CITIZEN_PASSWORD` | *(strong password)* | Default citizen login password |
| `SEED_ADMIN_PASSWORD` | *(strong password)* | Default admin login password |
| `CLIENT_ORIGIN` | `https://your-app.onrender.com` | Locks CORS to your domain only |

> **Tip:** Render automatically provides `$PORT` — your `start.sh` already handles this.

---

### Step 4: Click Deploy! 🎯
Render will automatically:
1. Build the Docker image
2. Run CSS minification (`npm run build:css`)
3. Start the Python NLU microservice internally on port 8000
4. Launch the Node.js server on the public HTTPS port

---

## ⚡ Verifying Deployment
Once deployed, Render will issue your HTTPS URL (e.g. `https://gram-sahayak.onrender.com`).
- **Citizen Portal**: `https://gram-sahayak.onrender.com`
- **Admin Portal**: `https://gram-sahayak.onrender.com/admin.html`

Test by logging in with your admin credentials, then check the Admin Dashboard loads data correctly.
