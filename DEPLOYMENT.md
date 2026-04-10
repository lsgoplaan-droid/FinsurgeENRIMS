# FinsurgeENRIMS — Deployment Guide

Parallel deployment to **Azure (Production)** and **Netlify/Render (Staging)**.

---

## Option 1: Azure Deployment (Production-Grade) ☁️

### Prerequisites
- Azure subscription with appropriate permissions
- `az` CLI installed: https://learn.microsoft.com/cli/azure/install-azure-cli
- Terraform >= 1.5
- Docker installed for building container images
- GitHub account with repo access

### Architecture
```
User → Azure Front Door (CDN)
        ├── Static Web Apps (Frontend)
        └── Application Gateway + WAF
            └── Container Apps (Backend)
                ├── PostgreSQL Flexible Server
                ├── Redis Cache
                └── Key Vault (Secrets)
```

### Step 1: Set Up Azure Infrastructure

#### 1a. Create resource group for Terraform state
```bash
az group create \
  --name finsurge-enrims-tfstate-rg \
  --location centralindia

az storage account create \
  --name finsurgeenrimstfstate \
  --resource-group finsurge-enrims-tfstate-rg \
  --location centralindia \
  --sku Standard_LRS

az storage container create \
  --name tfstate \
  --account-name finsurgeenrimstfstate
```

#### 1b. Create service principal for GitHub Actions (OIDC)
```bash
# Create service principal
az ad app create --display-name "FinsurgeENRIMS-GitHub-Deploy"

# Get object ID
OBJECT_ID=$(az ad app list --filter "displayName eq 'FinsurgeENRIMS-GitHub-Deploy'" --query "[0].id" -o tsv)

# Get subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Assign Owner role (or Contributor)
az role assignment create \
  --role "Contributor" \
  --assignee-object-id "$OBJECT_ID" \
  --scope "/subscriptions/$SUBSCRIPTION_ID"

# Get credentials
TENANT_ID=$(az account show --query tenantId -o tsv)
CLIENT_ID=$(az ad app list --filter "displayName eq 'FinsurgeENRIMS-GitHub-Deploy'" --query "[0].appId" -o tsv)

# Create federated credential for GitHub
az ad app federated-credential create \
  --id "$OBJECT_ID" \
  --parameters '{"name":"GitHub","issuer":"https://token.actions.githubusercontent.com","subject":"repo:YOUR_GITHUB_ORG/EnterpriseRiskSystem:ref:refs/heads/master","audiences":["api://AzureADTokenExchange"]}'
```

#### 1c. Add GitHub Secrets
In your GitHub repo → Settings → Secrets and variables → Actions, add:
```
AZURE_CLIENT_ID=<CLIENT_ID from step 1b>
AZURE_TENANT_ID=<TENANT_ID from step 1b>
AZURE_SUBSCRIPTION_ID=<SUBSCRIPTION_ID from step 1b>
AZURE_STATIC_WEB_APPS_API_TOKEN=<token from Azure portal>
```

#### 1d. Initialize Terraform
```bash
cd infrastructure/terraform

# Copy example vars
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars

# Initialize (connects to Azure storage backend)
terraform init

# Plan deployment
terraform plan -out=tfplan

# Apply
terraform apply tfplan
```

### Step 2: Set Up Azure Container Registry (ACR)
```bash
az acr create \
  --resource-group finsurge-enrims-prod-rg \
  --name finsurgeenrims \
  --sku Basic \
  --location centralindia

# Enable admin user for CI/CD
az acr update \
  --name finsurgeenrims \
  --admin-enabled true
```

### Step 3: Deploy via GitHub Actions
Push to `master` branch:
```bash
git push origin master
```

GitHub Actions will:
1. Run tests (pytest)
2. Build backend Docker image → push to ACR
3. Deploy to Azure Container Apps
4. Build & deploy frontend to Static Web Apps

Monitor: https://github.com/YOUR_ORG/EnterpriseRiskSystem/actions

---

## Option 2: Netlify Frontend (Staging) 🚀

### Prerequisites
- Netlify account: https://netlify.com
- GitHub connected to Netlify
- Node.js 20+

### Step 1: Create `netlify.toml`
Already created at `/netlify.toml`. Configure:
- Build command: `npm run build`
- Output directory: `dist/`
- Env vars for API URL (staging backend)

### Step 2: Connect to Netlify
1. Go to https://app.netlify.com/sites
2. New site → Import from Git → Select repo
3. Configure build settings:
   - Build command: `cd frontend && npm run build`
   - Publish directory: `frontend/dist`
4. Add environment variable:
   ```
   VITE_API_URL=https://staging-backend.example.com/api/v1
   ```

### Step 3: Deploy
Auto-deploys on every push to `master`. Manual deploy:
```bash
npm install -g netlify-cli
netlify deploy --prod --dir frontend/dist
```

---

## Option 3: Render Backend (Staging) 🎬

### Prerequisites
- Render account: https://render.com
- GitHub connected to Render
- PostgreSQL database (Render offers free tier for testing)

### Step 1: Create `render.yaml`
Configuration file for Render deployment (already created).

### Step 2: Create PostgreSQL on Render
1. Dashboard → New → PostgreSQL
2. Name: `finsurge-enrims-staging-db`
3. Region: India (ap-south-1) if available
4. Plan: Starter (free, for staging)
5. Copy connection string: `postgresql://...`

### Step 3: Create Web Service on Render
1. Dashboard → New → Web Service
2. Connect GitHub repo
3. Configure:
   - Root directory: `backend`
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Environment variables:
     ```
     DATABASE_URL=postgresql://...
     SECRET_KEY=<generate 256-bit key>
     PII_ENCRYPTION_KEY=<generate 256-bit key>
     SEED_ON_STARTUP=true
     DEBUG=false
     CORS_ORIGINS=https://staging-frontend.netlify.app,http://localhost:5173
     ```

### Step 4: Deploy
Auto-deploys on every push to `master`.

---

## Parallel Deployment Strategy

### Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Master Branch                         │
└─────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
        ┌──────────────┐        ┌──────────────┐
        │ Azure Deploy │        │ Netlify/     │
        │ (Production) │        │ Render Deploy│
        │              │        │ (Staging)    │
        │ - Backend    │        │              │
        │ - Frontend   │        │ - Frontend   │
        │ - DB         │        │ - Backend    │
        │ - Redis      │        │ - DB         │
        │ - WAF        │        └──────────────┘
        │ - CDN        │
        └──────────────┘
```

### GitHub Actions Workflows

#### `.github/workflows/deploy-azure.yml` (Existing)
- Triggers: push to `master` or manual dispatch
- Tests → Backend build/push → Deploy to Azure → Frontend deploy
- Status: ✅ Production-ready

#### `.github/workflows/deploy-netlify.yml` (To Create)
- Triggers: push to `master`
- Build frontend → Deploy to Netlify
- Uses Netlify CLI with API token

#### `.github/workflows/deploy-render.yml` (To Create)
- Triggers: push to `master`
- Render auto-detects from `render.yaml`
- Manual: Use Render dashboard or API

---

## Environment Variables by Platform

### Azure (Production)
| Variable | Source | Example |
|----------|--------|---------|
| `DATABASE_URL` | Key Vault | `postgresql://user:pass@host:5432/finsurge` |
| `SECRET_KEY` | Key Vault | 64-char hex string |
| `PII_ENCRYPTION_KEY` | Key Vault | 64-char hex string |
| `REDIS_URL` | Key Vault | `redis://host:6379` |
| `CORS_ORIGINS` | App Settings | `https://finsurge.azurestaticapps.net` |
| `DEBUG` | App Settings | `false` |

### Netlify (Frontend Staging)
| Variable | Example |
|----------|---------|
| `VITE_API_URL` | `https://staging-backend.onrender.com/api/v1` |
| `VITE_ENV` | `staging` |

### Render (Backend Staging)
| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `postgresql://...` |
| `SECRET_KEY` | 64-char hex |
| `CORS_ORIGINS` | `https://staging-frontend.netlify.app` |
| `SEED_ON_STARTUP` | `true` |

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing locally: `pytest tests/ -v`
- [ ] Frontend builds locally: `npm run build`
- [ ] Environment variables defined in each platform
- [ ] Database migrations applied
- [ ] Secrets rotated (if production)
- [ ] Security headers configured
- [ ] CORS origins whitelisted

### Azure Deployment
- [ ] Terraform state backend configured
- [ ] Service principal created with OIDC
- [ ] GitHub secrets set (CLIENT_ID, TENANT_ID, SUBSCRIPTION_ID)
- [ ] ACR created and authenticated
- [ ] PostgreSQL admin password set
- [ ] Key Vault secrets created
- [ ] Application Gateway configured
- [ ] WAF rules enabled
- [ ] Static Web Apps deployment token obtained

### Netlify Deployment
- [ ] GitHub repo connected
- [ ] Build command: `cd frontend && npm run build`
- [ ] Publish directory: `frontend/dist`
- [ ] Environment variables set
- [ ] Custom domain configured (optional)
- [ ] SSL certificate auto-renewed

### Render Deployment
- [ ] PostgreSQL database created
- [ ] `render.yaml` in repo root
- [ ] GitHub connected
- [ ] Environment variables set
- [ ] Health check endpoint configured (`/health`)

### Post-Deployment
- [ ] Test login endpoint
- [ ] Verify database connectivity
- [ ] Check audit trail logging
- [ ] Monitor error rates (first 24h)
- [ ] Verify SSL certificates
- [ ] Confirm backup schedules

---

## Monitoring & Rollback

### Azure
```bash
# View logs
az containerapp logs show --name finsurge-enrims-backend \
  --resource-group finsurge-enrims-prod-rg

# Rollback to previous revision
az containerapp update --name finsurge-enrims-backend \
  --resource-group finsurge-enrims-prod-rg \
  --image <previous-image-sha>
```

### Netlify
- Dashboard → Deploys → Rollback to previous deploy
- Or: `netlify deploy --prod --dir frontend/dist`

### Render
- Dashboard → Deployment History → Redeploy previous version

---

## Cost Estimates

| Platform | Component | Monthly Cost | Notes |
|----------|-----------|--------------|-------|
| **Azure** | Container Apps | $50-150 | Billed per vCore-hour |
| | PostgreSQL | $100-300 | Zone-redundant flexible |
| | Redis | $20-50 | Basic tier |
| | Application Gateway | $50-100 | With WAF v2 |
| | Static Web Apps | $10-20 | CDN included |
| **Netlify** | Pro plan | $20-45 | Includes build minutes |
| **Render** | Web service | $7/month | Auto-sleep if inactive |
| | PostgreSQL | Free (staging) | Limited to 1 connection |

**Recommendation:** Use Azure for production, Render for staging during development.

---

## Troubleshooting

### Azure Container Apps fails to deploy
```bash
# Check recent logs
az containerapp logs show --name finsurge-enrims-backend \
  --resource-group finsurge-enrims-prod-rg --tail 50

# Verify Container Apps environment
az containerapp env show --name finsurge-enrims-prod-env \
  --resource-group finsurge-enrims-prod-rg
```

### Database connection failed
```bash
# Verify PostgreSQL is accessible
psql "postgresql://user:pass@host:5432/finsurge" -c "SELECT 1"

# Check firewall rules on Azure
az postgres flexible-server firewall-rule list \
  --server-name finsurge-enrims-db \
  --resource-group finsurge-enrims-prod-rg
```

### Frontend not loading API responses
- Check CORS_ORIGINS includes frontend URL
- Verify VITE_API_URL points to correct backend
- Inspect browser console for CORS errors

---

## Next Steps

1. **Immediate:** Set up GitHub Actions secrets for Azure
2. **Week 1:** Deploy to Azure staging environment
3. **Week 2:** Set up Netlify + Render for parallel staging
4. **Week 3:** Load testing on all platforms
5. **Week 4:** Cutover to production with 24/7 monitoring

---

## Support & Documentation

- **Terraform Docs:** https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs
- **Azure CLI:** https://learn.microsoft.com/cli/azure/
- **Netlify:** https://docs.netlify.com/
- **Render:** https://render.com/docs/
- **GitHub Actions:** https://docs.github.com/actions/

---

**Last Updated:** 2026-04-10
**Status:** Ready for deployment
