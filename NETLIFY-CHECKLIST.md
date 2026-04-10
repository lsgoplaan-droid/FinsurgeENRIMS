# Netlify Deployment Checklist — TODAY

**Print this out or keep it open while deploying.**

---

## ✅ PRE-DEPLOYMENT (Do This First)

- [ ] Local backend running: `cd backend && python main.py`
  - Confirm it starts on port 8000
  - Test: `curl http://localhost:8000/` returns `{"app":"FinsurgeFRIMS"...}`

- [ ] Code committed: `git status` shows nothing to commit
  - If changes exist: `git add . && git commit -m "..."`

- [ ] GitHub account created and repo access confirmed

---

## ✅ STEP 1: CONNECT GITHUB TO NETLIFY (5 min)

**Location:** https://app.netlify.com

- [ ] Click "Sign up with GitHub" (or login)
- [ ] Authorize Netlify to access repositories
- [ ] Click "Add new site" → "Import from Git"
- [ ] Select GitHub as provider
- [ ] Select `EnterpriseRiskSystem` repo
- [ ] Authorize final permissions

---

## ✅ STEP 2: CONFIGURE BUILD SETTINGS (2 min)

**Location:** Netlify → Your Site → Build & Deploy

In the "Build settings" section:

- [ ] **Base directory:** (leave EMPTY)
- [ ] **Build command:** `cd frontend && npm run build`
- [ ] **Publish directory:** `frontend/dist`
- [ ] Click **Save** button

**Verify:** Settings display correctly in the list

---

## ✅ STEP 3: ADD ENVIRONMENT VARIABLE (1 min)

**Location:** Netlify → Site Settings → Build & Deploy → Environment

- [ ] Click "Add variable"
- [ ] **Key:** `VITE_API_URL`
- [ ] **Value:** `/api/v1`
- [ ] Click **Save**

**Verify:** Variable shows in the list as:
```
VITE_API_URL = /api/v1
```

---

## ✅ STEP 4: TRIGGER DEPLOYMENT (3 min)

**Option A: Automatic (Recommended)**
- [ ] Push code to GitHub:
  ```bash
  git push origin master
  ```
- [ ] Go to Netlify Deploys tab
- [ ] Watch for "Building" → "Published" (green checkmark)
- [ ] Takes 2-3 minutes

**Option B: Manual (If A doesn't work)**
- [ ] Install Netlify CLI: `npm install -g netlify-cli`
- [ ] Login: `netlify login`
- [ ] Deploy: `netlify deploy --prod --dir frontend/dist`

---

## ✅ STEP 5: VERIFY DEPLOYMENT (5 min)

**Location:** Netlify → Your Site

- [ ] Status shows "Published" (green checkmark)
- [ ] Copy your site URL (e.g., `https://mystuff.netlify.app`)
- [ ] Open URL in browser
- [ ] Page loads (you see login form)
- [ ] No 404 errors in address bar

**Test the site:**
- [ ] Open browser DevTools (F12)
- [ ] Go to Console tab
- [ ] Look for any red errors
- [ ] If no red errors: ✅ SUCCESS!

---

## 🎉 DONE! Your Site is Live

Your deployed frontend URL:
```
https://YOUR_SITE_NAME.netlify.app
```

**This URL is:**
- ✅ Live on the internet
- ✅ Auto-deploys when you push to master
- ✅ Served over HTTPS
- ✅ Globally cached (fast)

---

## 🔌 CONNECTING TO BACKEND (Optional Today)

### If you want to test API calls now:

**Option 1: Keep local backend running**
```bash
# In terminal #2
cd backend
python main.py
```

Then try login with:
- Username: `admin`
- Password: `Demo@2026`

**Option 2: Deploy backend later (next week)**
- Keep local backend running for testing
- Deploy to Render when ready (see DEPLOY-QUICKSTART.md)

---

## 📊 Status Check

| Item | Status |
|------|--------|
| Frontend deployed | ✅ |
| Site accessible | ✅ |
| Auto-deploy enabled | ✅ |
| Backend API | (Running locally) |
| Domain | (`your-site.netlify.app`) |
| HTTPS | ✅ (Auto) |

---

## 🚀 NEXT STEPS

### Today (Just Now)
- Follow this checklist
- Deploy to Netlify
- Verify site loads

### This Week
- Keep local backend running OR
- Deploy backend to Render (quick, free tier available)
- Test full login flow
- Load test with a few users

### Next Week
- Deploy to Azure (production)
- Set up custom domain
- Enable monitoring

---

## 🆘 QUICK TROUBLESHOOTING

| Problem | Fix |
|---------|-----|
| Build fails | Check build log in Netlify Deploys → View deploy log |
| 404 error | Verify publish directory is `frontend/dist` |
| Site won't load | Clear browser cache (Cmd+Shift+Delete) |
| Login fails | Backend might not be connected yet (normal) |
| CORS error | Update VITE_API_URL when backend is deployed |

---

## ⏱️ Time Estimate

| Step | Time |
|------|------|
| 1. GitHub Connect | 5 min |
| 2. Build Settings | 2 min |
| 3. Environment Var | 1 min |
| 4. Deployment | 3 min |
| 5. Verification | 5 min |
| **TOTAL** | **~16 min** |

Plus build time: 2-3 minutes on Netlify.

**Total end-to-end: 20 minutes**

---

## 📝 Save These URLs

After deployment, bookmark:
- **Your Site:** https://your-site.netlify.app
- **Netlify Dashboard:** https://app.netlify.com
- **Your Deploys:** https://app.netlify.com/sites/YOUR-SITE/deploys
- **Backend:** http://localhost:8000 (keep running)

---

## ✅ FINAL CHECKLIST

Before moving on:
- [ ] Netlify shows "Published" ✅
- [ ] Site URL works in browser
- [ ] No 404 errors
- [ ] DevTools console shows no red errors
- [ ] Commit this checklist to remember what you did

---

**Status: 🟢 READY TO DEPLOY**

You have everything needed. Follow the checklist and you'll be live in 20 minutes!

