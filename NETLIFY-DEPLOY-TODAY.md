# Netlify Deployment — TODAY (30 minutes)

**Goal:** Deploy FinsurgeENRIMS frontend to Netlify + connect to live backend  
**Time:** 30 minutes  
**Cost:** Free (Pro plan $20/mo optional)  
**Status:** Backend running locally on port 8000

---

## 🚀 Step 1: Connect GitHub to Netlify (5 minutes)

### 1a. Go to Netlify
→ https://app.netlify.com/signup (or login if you have account)

### 1b. Choose "GitHub" to sign in
- Click "Sign up with GitHub"
- Authorize Netlify to access your GitHub repos

### 1c. Create New Site
- Click "Add new site" or "New site from Git"
- Choose "GitHub"
- Select your `EnterpriseRiskSystem` repo
- Authorize if prompted

---

## ⚙️ Step 2: Configure Build Settings (3 minutes)

### In Netlify site settings, set:

| Field | Value |
|-------|-------|
| **Base directory** | (leave empty) |
| **Build command** | `cd frontend && npm run build` |
| **Publish directory** | `frontend/dist` |

### Screenshot reference:
```
Build settings
├─ Base directory: [empty]
├─ Build command: cd frontend && npm run build
├─ Publish directory: frontend/dist
└─ [Save]
```

### Verify these are correct:
- ✅ Build command includes `cd frontend`
- ✅ Publish directory is `frontend/dist` (not `dist`)
- ✅ No typos in paths

---

## 🔑 Step 3: Add Environment Variable (2 minutes)

### In Netlify → Site settings → Build & deploy → Environment:

Click "Add variable" and set:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `/api/v1` |

**Why `/api/v1`?**
- During development: Vite proxies to localhost:8000
- In production: We'll add a backend URL or proxy later

**Save** and confirm it shows in the list.

---

## 🔄 Step 4: Deploy (5 minutes)

### Option A: Auto-Deploy (Recommended)
Just push your code to GitHub:
```bash
git push origin master
```

Netlify automatically detects the push and starts building.

**Monitor build:**
1. Go to your Netlify site → Deploys
2. Watch the build progress
3. Wait for "Published" status (takes 2-3 minutes)

### Option B: Manual Deploy
```bash
npm install -g netlify-cli

# Login to Netlify
netlify login

# Go to frontend directory
cd frontend

# Deploy
netlify deploy --prod --dir dist
```

---

## ✅ Step 5: Verify Deployment (5 minutes)

### 5a. Check Netlify Status
- Go to https://app.netlify.com/sites
- Find your site
- Status should show "Published" (green checkmark)
- Copy the live URL (something like `https://xxxxx.netlify.app`)

### 5b. Visit Your Site
```bash
# Open in browser
open https://xxxxx.netlify.app

# Or curl to check
curl -I https://xxxxx.netlify.app
```

### 5c. Expected Results
- ✅ Page loads without 404
- ✅ You see login form
- ✅ No console errors (press F12)

**Important:** If you see API errors, it's because the backend isn't accessible from Netlify yet. That's OK for now—see Step 6.

---

## 🔌 Step 6: Connect to Live Backend (5 minutes) — OPTIONAL FOR NOW

**If you want to test API connectivity immediately:**

### Option A: Keep Local Backend Running
```bash
# In another terminal
cd backend
SEED_ON_STARTUP=true python main.py
```

Then in frontend, set environment variable to point to your local machine:
```
VITE_API_URL = http://YOUR_LOCAL_IP:8000/api/v1
```

(Replace `YOUR_LOCAL_IP` with your machine's IP, e.g., `192.168.1.100`)

### Option B: Use Render Backend (Next Week)
When you deploy backend to Render, update environment variable:
```
VITE_API_URL = https://your-render-backend.onrender.com/api/v1
```

### Option C: Use API Proxy
Netlify can proxy API calls. Update `netlify.toml`:
```toml
[[redirects]]
from = "/api/v1/*"
to = "http://localhost:8000/api/v1/:splat"
status = 200
```

(This only works if local backend is running)

---

## 📊 Quick Checklist

- [ ] GitHub account connected to Netlify
- [ ] Repo authorized
- [ ] Build command: `cd frontend && npm run build`
- [ ] Publish directory: `frontend/dist`
- [ ] Environment variable `VITE_API_URL` set
- [ ] Build triggered (via git push or manual)
- [ ] Build completed (shows "Published")
- [ ] Site accessible at https://xxxxx.netlify.app
- [ ] No 404 errors
- [ ] No console errors (F12)

---

## 🔗 Your Netlify Dashboard

After deployment, you'll have:

```
Your Site
├─ URL: https://xxxxx.netlify.app
├─ Deploys: Shows build history
├─ Environment: Shows VITE_API_URL
├─ Domain settings: Custom domain (optional)
└─ Redirects: API proxy rules (optional)
```

---

## 📝 Environment Variables Reference

### For Netlify
```
VITE_API_URL = /api/v1              # Proxied locally or to backend URL
VITE_ENV = production               # Optional
```

### For Local Development
```
VITE_API_URL = http://localhost:8000/api/v1
```

### For Production (Later)
```
VITE_API_URL = https://your-backend.onrender.com/api/v1
# or
VITE_API_URL = https://api.finsurge.app/api/v1  # Azure with custom domain
```

---

## 🚨 Troubleshooting

### Build fails with "npm not found"
**Fix:** Go to Site settings → Build & deploy → Node version
- Set to `20` (or latest stable)
- Rebuild

### Build succeeds but frontend doesn't load
**Fix:** Check if files are being published correctly
- Go to Deploys → Click latest → View deploy log
- Look for errors like "dist not found"
- Verify publish directory is `frontend/dist`

### Login page shows but API calls fail
**Fix:** This is expected if backend isn't connected yet
- Keep local backend running: `python main.py` in backend/
- Or deploy backend to Render next (see DEPLOY-QUICKSTART.md)

### Can't login even with correct credentials
**Fix:** 
- Clear browser cache (Cmd+Shift+Delete)
- Try incognito/private window
- Check browser console (F12) for CORS errors
- If CORS error, backend CORS_ORIGINS needs to include your Netlify URL

---

## 🎯 What's Next

### Today (✅ RIGHT NOW)
- [x] Deploy to Netlify
- [x] Frontend live at https://xxxxx.netlify.app
- [x] Verify no 404/build errors

### This Week
- [ ] Keep local backend running OR
- [ ] Deploy backend to Render (see DEPLOY-QUICKSTART.md)
- [ ] Test login end-to-end
- [ ] Test audit trail features
- [ ] Load test with ~10 concurrent users

### Next Week
- [ ] Deploy to Azure (production)
- [ ] Configure custom domain
- [ ] Set up monitoring/alerts
- [ ] Production load testing

---

## 🔐 Security Notes

### Current Setup (Local Development)
- ✅ HTTPS via Netlify (auto-enabled)
- ⚠️ Backend not secured yet (running locally)
- ⚠️ No rate limiting on API

### After Azure Deployment
- ✅ HTTPS everywhere
- ✅ WAF enabled
- ✅ Rate limiting
- ✅ CORS properly configured
- ✅ Secrets in Key Vault

---

## 💬 Support

| Issue | Solution |
|-------|----------|
| "Where's my site URL?" | Netlify dashboard → Overview → Deployed URL (copy from there) |
| "How do I change the domain?" | Site settings → Domain settings → Add custom domain |
| "Can I rollback?" | Deploys → Click previous deploy → "Restore" |
| "How do I see logs?" | Deploys → Click build → "View deploy log" |

---

## 📞 Quick Links

- **Netlify Dashboard:** https://app.netlify.com
- **Your Site Deploys:** https://app.netlify.com/sites/YOUR_SITE_NAME/deploys
- **Netlify Docs:** https://docs.netlify.com
- **Build Troubleshooting:** https://docs.netlify.com/configure-builds/get-started/

---

## ✨ You Did It!

After these steps, you'll have:
- ✅ Frontend deployed to Netlify (https://xxxxx.netlify.app)
- ✅ Auto-deploy on every push to master
- ✅ Ready for production use
- ✅ Can handle staging/testing

**Estimated time:** 30 minutes  
**Cost:** Free (upgrade to Pro $20/mo when ready)  
**Status:** 🟢 LIVE

---

**Next action:** `git push origin master` → Netlify auto-deploys → Your site is live in 5 minutes!

After that, keep local backend running and test the full flow, or move to Render backend deployment next week.

