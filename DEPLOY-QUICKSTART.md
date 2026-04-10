# Deployment Quick Start — 3 Platforms

Deploy to **Azure (Production)**, **Netlify (Frontend Staging)**, and **Render (Backend Staging)** simultaneously.

---

## 🚀 30-Minute Setup

### Prerequisites
```bash
# Install tools
brew install azure-cli terraform  # macOS
# or apt-get on Linux / chocolatey on Windows

az login
terraform version
docker --version
```

---

## 1️⃣ Netlify (Easiest - 5 minutes)

### Step 1: Connect GitHub
1. Go to https://netlify.com/drop → Sign in
2. Click "New site from Git"
3. Select GitHub → Authorize → Select `EnterpriseRiskSystem`

### Step 2: Configure Build
- **Build command:** `cd frontend && npm run build`
- **Publish directory:** `frontend/dist`
- **Environment variable:**
  ```
  VITE_API_URL = https://staging-backend.onrender.com/api/v1
  ```

### Step 3: Deploy
✅ Auto-deploys on every push. Done!

**Your URL:** `https://your-site.netlify.app`

---

## 2️⃣ Render Backend (Easy - 10 minutes)

### Step 1: Create PostgreSQL Database
1. Go to https://render.com → Dashboard
2. **New** → **PostgreSQL**
3. Name: `finsurge-enrims-db`
4. Region: Singapore (closest to India)
5. Plan: **Free** (for now)
6. Click **Create** → Copy connection string

### Step 2: Create Backend Service
1. **New** → **Web Service**
2. Connect GitHub → Select repo
3. Configure:
   ```
   Name: finsurge-enrims-backend
   Root directory: backend
   Runtime: Python 3
   Build command: pip install -r requirements.txt
   Start command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
4. **Environment Variables:**
   ```
   DATABASE_URL=<from PostgreSQL above>
   SECRET_KEY=<generate 64-char random>
   PII_ENCRYPTION_KEY=<generate 64-char random>
   CORS_ORIGINS=https://your-site.netlify.app
   SEED_ON_STARTUP=true
   DEBUG=false
   ```

### Step 3: Deploy
✅ Auto-deploys from GitHub. Wait 5 minutes...

**Your URL:** `https://finsurge-enrims-backend.onrender.com`

---

## 3️⃣ Azure (Production - 20 minutes)

### Step 1: Create Azure Resources
```bash
# Login
az login

# Create resource group
az group create \
  --name finsurge-enrims-prod-rg \
  --location centralindia

# Create Container Registry
az acr create \
  --resource-group finsurge-enrims-prod-rg \
  --name finsurgeenrims \
  --sku Basic

# Create PostgreSQL
az postgres flexible-server create \
  --resource-group finsurge-enrims-prod-rg \
  --name finsurge-enrims-db \
  --location centralindia \
  --admin-user enrims_admin \
  --admin-password "YourSecurePassword123!"

# Create Redis
az redis create \
  --resource-group finsurge-enrims-prod-rg \
  --name finsurge-enrims-cache \
  --location centralindia \
  --sku basic --vm-size c0
```

### Step 2: Set Up GitHub Actions
1. Go to https://github.com/YOUR_ORG/EnterpriseRiskSystem/settings/secrets/actions
2. Add secrets:
   ```
   AZURE_CLIENT_ID=<from service principal>
   AZURE_TENANT_ID=<tenant ID>
   AZURE_SUBSCRIPTION_ID=<subscription ID>
   AZURE_STATIC_WEB_APPS_API_TOKEN=<from Azure portal>
   ```

### Step 3: Deploy
```bash
# Push to master triggers automatic deployment
git push origin master
```

Monitor: https://github.com/YOUR_ORG/EnterpriseRiskSystem/actions

---

## 🔗 Connect All Three

### Update Netlify
Go to Site settings → Build & deploy → Environment:
```
VITE_API_URL = https://finsurge-enrims-backend.onrender.com/api/v1
```

### Update Render Backend
Go to Environment → Add/Update:
```
CORS_ORIGINS = https://your-site.netlify.app
```

### Update Azure
Update app settings in Azure portal:
```
CORS_ORIGINS = https://finsurge.azurestaticapps.net
```

---

## ✅ Verification Checklist

### Netlify
- [ ] Build completed successfully
- [ ] Site loads at `https://your-site.netlify.app`
- [ ] Can login with admin/Demo@2026
- [ ] API calls reach backend

### Render
- [ ] Backend deployed and running
- [ ] Health check passing: `https://finsurge-enrims-backend.onrender.com/health`
- [ ] Database seeded (check for 150+ alerts)
- [ ] CORS headers correct

### Azure
- [ ] Container Apps revision running
- [ ] Static Web App deployed
- [ ] PostgreSQL accessible
- [ ] Redis connected

---

## 🔑 GitHub Secrets Needed

### For Netlify
```
NETLIFY_AUTH_TOKEN = <from netlify.com/account/applications>
NETLIFY_SITE_ID = <from netlify.toml>
```

### For Render
```
RENDER_SERVICE_ID = <from render.com/dashboard/web/..../settings>
RENDER_DEPLOY_KEY = <from render.com/account/api-keys>
RENDER_BACKEND_URL = finsurge-enrims-backend.onrender.com
```

### For Azure
```
AZURE_CLIENT_ID
AZURE_TENANT_ID
AZURE_SUBSCRIPTION_ID
AZURE_STATIC_WEB_APPS_API_TOKEN
```

---

## 📊 Deployment Status Dashboard

Create a simple monitoring setup:

```bash
# Check all endpoints
curl -s https://your-site.netlify.app -I
curl -s https://finsurge-enrims-backend.onrender.com/health
curl -s https://finsurge-enrims.azurestaticapps.net -I
```

Add to GitHub Actions as a cron job for daily verification.

---

## 💰 Cost Summary

| Platform | Service | Monthly | Notes |
|----------|---------|---------|-------|
| **Netlify** | Hosting | $20/mo | Includes bandwidth |
| **Render** | Web + PostgreSQL | ~$15/mo | Free tier for testing |
| **Azure** | App Services + DB | $200+/mo | Production-grade |
| **Total** | | ~$235+/mo | Parallel deployment |

---

## 🚨 Troubleshooting

### Netlify build fails
```bash
# Check build logs at netlify.com/sites/.../deploys
# Common issue: Node version mismatch
# Fix: Add to netlify.toml:
# NODE_VERSION = "20"
```

### Render health check fails
```bash
# SSH into Render and check logs
# Backend endpoint must return valid JSON at /health
# Check CORS_ORIGINS includes your frontend
```

### Azure deployment stuck
```bash
az containerapp logs show \
  --name finsurge-enrims-backend \
  --resource-group finsurge-enrims-prod-rg
```

---

## 📚 Full Documentation

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive guides.

---

## Next Steps

1. ✅ Deploy to Netlify (today)
2. ✅ Deploy to Render (today)
3. ⏰ Set up Azure (this week)
4. 🔄 Configure CI/CD workflows
5. 📡 Set up monitoring & alerts
6. 🧪 Load testing on all platforms

---

**Last Updated:** 2026-04-10  
**Time to Deploy:** ~30 minutes
