#!/bin/bash
###############################################################################
# FinsurgeENRIMS — Manual deploy to Azure (use CI/CD in production)
# Usage: ./scripts/deploy.sh [staging|prod]
###############################################################################
set -euo pipefail

ENV="${1:-prod}"
AZURE_REGION="centralindia"
ACR_NAME="finsurgeenrims"
ACR_REGISTRY="${ACR_NAME}.azurecr.io"
RESOURCE_GROUP="finsurge-enrims-${ENV}-rg"
CONTAINER_APP_NAME="finsurge-enrims-backend"
STATIC_WEB_APP_NAME="finsurge-enrims-frontend"
IMAGE_TAG="$(git rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"

echo "=== Deploying FinsurgeENRIMS to ${ENV} (Azure Central India) ==="
echo "Image tag: ${IMAGE_TAG}"
echo ""

# ── 1. Login to ACR ─────────────────────────────────────────────────────────
echo "[1/5] Logging into Azure Container Registry..."
az acr login --name "${ACR_NAME}"

# ── 2. Build backend Docker image ───────────────────────────────────────────
echo "[2/5] Building backend image..."
cd backend
docker build -t "${ACR_REGISTRY}/finsurge-enrims-backend:${IMAGE_TAG}" \
             -t "${ACR_REGISTRY}/finsurge-enrims-backend:latest" .
cd ..

# ── 3. Push to ACR ──────────────────────────────────────────────────────────
echo "[3/5] Pushing to ACR..."
docker push "${ACR_REGISTRY}/finsurge-enrims-backend:${IMAGE_TAG}"
docker push "${ACR_REGISTRY}/finsurge-enrims-backend:latest"

# ── 4. Update Container App ─────────────────────────────────────────────────
echo "[4/5] Updating Azure Container App..."
az containerapp update \
  --name "${CONTAINER_APP_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --image "${ACR_REGISTRY}/finsurge-enrims-backend:${IMAGE_TAG}"

echo "Waiting for revision to stabilize..."
for i in {1..10}; do
  STATUS=$(az containerapp revision list \
    --name "${CONTAINER_APP_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --query "[0].properties.runningState" -o tsv)
  echo "  Revision status: ${STATUS}"
  if [ "${STATUS}" = "Running" ]; then break; fi
  sleep 10
done

# ── 5. Build & deploy frontend ──────────────────────────────────────────────
echo "[5/5] Building frontend..."
cd frontend
VITE_API_URL="/api/v1" npm run build

echo "Deploying to Azure Static Web Apps..."
npx @azure/static-web-apps-cli deploy dist \
  --deployment-token "${SWA_DEPLOYMENT_TOKEN:-}" \
  --app-name "${STATIC_WEB_APP_NAME}" \
  --env "${ENV}" 2>/dev/null || echo "SWA CLI deploy skipped (set SWA_DEPLOYMENT_TOKEN)"
cd ..

echo ""
echo "=== Deployment complete! ==="
echo "Backend: Container App '${CONTAINER_APP_NAME}' updated with image ${IMAGE_TAG}"
echo "Frontend: Azure Static Web App '${STATIC_WEB_APP_NAME}'"
