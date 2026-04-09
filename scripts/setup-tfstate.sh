#!/bin/bash
###############################################################################
# Create Azure Storage Account for Terraform state (run once)
###############################################################################
set -euo pipefail

RESOURCE_GROUP="finsurge-enrims-tfstate-rg"
STORAGE_ACCOUNT="finsurgeenrimstfstate"
CONTAINER="tfstate"
LOCATION="centralindia"

echo "Creating resource group: ${RESOURCE_GROUP}"
az group create \
  --name "${RESOURCE_GROUP}" \
  --location "${LOCATION}"

echo "Creating storage account: ${STORAGE_ACCOUNT}"
az storage account create \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${STORAGE_ACCOUNT}" \
  --sku Standard_LRS \
  --encryption-services blob \
  --min-tls-version TLS1_2 \
  --allow-blob-public-access false \
  --location "${LOCATION}"

echo "Creating blob container: ${CONTAINER}"
az storage container create \
  --name "${CONTAINER}" \
  --account-name "${STORAGE_ACCOUNT}" \
  --auth-mode login

echo "Enabling versioning for state history..."
az storage account blob-service-properties update \
  --resource-group "${RESOURCE_GROUP}" \
  --account-name "${STORAGE_ACCOUNT}" \
  --enable-versioning true

echo "Done! Terraform backend is ready."
echo ""
echo "Add this to your Terraform backend config:"
echo "  backend \"azurerm\" {"
echo "    resource_group_name  = \"${RESOURCE_GROUP}\""
echo "    storage_account_name = \"${STORAGE_ACCOUNT}\""
echo "    container_name       = \"${CONTAINER}\""
echo "    key                  = \"prod/terraform.tfstate\""
echo "  }"
