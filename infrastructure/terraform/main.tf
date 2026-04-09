###############################################################################
# FinsurgeENRIMS — Azure Infrastructure (Terraform)
# Architecture: VNet → Application Gateway + WAF → Container Apps → PostgreSQL Flexible Server + Redis Cache
#               Azure Front Door → Static Web App (frontend)
#               Key Vault, Monitor, ACR
###############################################################################

terraform {
  required_version = ">= 1.5"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.90"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "azurerm" {
    resource_group_name  = "finsurge-enrims-tfstate-rg"
    storage_account_name = "finsurgeenrimstfstate"
    container_name       = "tfstate"
    key                  = "prod/terraform.tfstate"
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = false
    }
  }
}

# ── Data Sources ─────────────────────────────────────────────────────────────

data "azurerm_client_config" "current" {}

# ── Resource Group ───────────────────────────────────────────────────────────

resource "azurerm_resource_group" "main" {
  name     = "${var.project}-${var.environment}-rg"
  location = var.azure_region

  tags = {
    Project     = "FinsurgeENRIMS"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ── Modules ──────────────────────────────────────────────────────────────────

module "vnet" {
  source = "./modules/vnet"

  project            = var.project
  environment        = var.environment
  resource_group     = azurerm_resource_group.main.name
  location           = azurerm_resource_group.main.location
  vnet_address_space = var.vnet_address_space
}

module "appgw" {
  source = "./modules/appgw"

  project          = var.project
  environment      = var.environment
  resource_group   = azurerm_resource_group.main.name
  location         = azurerm_resource_group.main.location
  vnet_id          = module.vnet.vnet_id
  appgw_subnet_id  = module.vnet.appgw_subnet_id
  backend_fqdn     = module.container_app.fqdn
}

module "waf" {
  source = "./modules/waf"

  project        = var.project
  environment    = var.environment
  resource_group = azurerm_resource_group.main.name
  location       = azurerm_resource_group.main.location
  appgw_id       = module.appgw.appgw_id
}

module "postgresql" {
  source = "./modules/postgresql"

  project              = var.project
  environment          = var.environment
  resource_group       = azurerm_resource_group.main.name
  location             = azurerm_resource_group.main.location
  db_subnet_id         = module.vnet.db_subnet_id
  private_dns_zone_id  = module.vnet.postgres_dns_zone_id
  db_name              = var.db_name
  db_username          = var.db_username
  sku_name             = var.db_sku_name
}

module "redis" {
  source = "./modules/redis"

  project          = var.project
  environment      = var.environment
  resource_group   = azurerm_resource_group.main.name
  location         = azurerm_resource_group.main.location
  redis_subnet_id  = module.vnet.redis_subnet_id
  sku_name         = var.redis_sku_name
  capacity         = var.redis_capacity
}

module "container_app" {
  source = "./modules/container_app"

  project          = var.project
  environment      = var.environment
  resource_group   = azurerm_resource_group.main.name
  location         = azurerm_resource_group.main.location
  app_subnet_id    = module.vnet.app_subnet_id

  acr_login_server = azurerm_container_registry.main.login_server
  acr_admin_username = azurerm_container_registry.main.admin_username
  acr_admin_password = azurerm_container_registry.main.admin_password
  backend_image    = "${azurerm_container_registry.main.login_server}/finsurge-enrims-backend:latest"
  cpu              = var.container_cpu
  memory           = var.container_memory
  min_replicas     = var.container_min_replicas
  max_replicas     = var.container_max_replicas

  database_url     = "postgresql://${var.db_username}:${module.postgresql.db_password}@${module.postgresql.db_fqdn}:5432/${var.db_name}?sslmode=require"
  redis_url        = "rediss://:${module.redis.primary_access_key}@${module.redis.hostname}:6380/0"
  key_vault_id     = azurerm_key_vault.main.id
  log_analytics_id = module.monitoring.log_analytics_workspace_id

  depends_on = [azurerm_key_vault_secret.secret_key, azurerm_key_vault_secret.pii_key]
}

module "cdn" {
  source = "./modules/cdn"

  project        = var.project
  environment    = var.environment
  resource_group = azurerm_resource_group.main.name
  location       = azurerm_resource_group.main.location
  api_fqdn       = module.container_app.fqdn
  frontend_domain = var.frontend_domain
}

module "monitoring" {
  source = "./modules/monitoring"

  project                = var.project
  environment            = var.environment
  resource_group         = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  container_app_id       = module.container_app.container_app_id
  postgresql_server_id   = module.postgresql.server_id
  redis_cache_id         = module.redis.redis_cache_id
  alert_email            = var.alert_email
}

# ── Azure Container Registry ────────────────────────────────────────────────

resource "azurerm_container_registry" "main" {
  name                = "${replace(var.project, "-", "")}acr"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Standard"
  admin_enabled       = true

  tags = { Project = "FinsurgeENRIMS", Environment = var.environment }
}

# ── Azure Key Vault ─────────────────────────────────────────────────────────

resource "azurerm_key_vault" "main" {
  name                       = "${var.project}-${var.environment}-kv"
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 90
  purge_protection_enabled   = true

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = ["Get", "List", "Set", "Delete", "Recover", "Backup", "Restore"]
  }

  tags = { Project = "FinsurgeENRIMS", Environment = var.environment }
}

resource "azurerm_key_vault_secret" "secret_key" {
  name         = "secret-key"
  value        = var.secret_key
  key_vault_id = azurerm_key_vault.main.id
}

resource "azurerm_key_vault_secret" "pii_key" {
  name         = "pii-encryption-key"
  value        = var.pii_encryption_key
  key_vault_id = azurerm_key_vault.main.id
}

# ── Storage Account (reports) ───────────────────────────────────────────────

resource "azurerm_storage_account" "reports" {
  name                     = "${replace(var.project, "-", "")}reports"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"

  blob_properties {
    versioning_enabled = true

    delete_retention_policy {
      days = 365
    }
  }

  tags = { Project = "FinsurgeENRIMS", Environment = var.environment }
}

resource "azurerm_storage_container" "reports" {
  name                  = "reports"
  storage_account_name  = azurerm_storage_account.reports.name
  container_access_type = "private"
}

resource "azurerm_storage_management_policy" "reports" {
  storage_account_id = azurerm_storage_account.reports.id

  rule {
    name    = "archive-old-reports"
    enabled = true
    filters {
      prefix_match = ["reports/"]
      blob_types   = ["blockBlob"]
    }
    actions {
      base_blob {
        tier_to_cool_after_days_since_modification_greater_than    = 90
        tier_to_archive_after_days_since_modification_greater_than = 365
        delete_after_days_since_modification_greater_than          = 3650  # 10 years per RBI mandate
      }
    }
  }
}
