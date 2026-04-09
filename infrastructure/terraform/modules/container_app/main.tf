variable "project" { type = string }
variable "environment" { type = string }
variable "resource_group" { type = string }
variable "location" { type = string }
variable "app_subnet_id" { type = string }
variable "acr_login_server" { type = string }
variable "acr_admin_username" { type = string }
variable "acr_admin_password" { type = string; sensitive = true }
variable "backend_image" { type = string }
variable "cpu" { type = number }
variable "memory" { type = string }
variable "min_replicas" { type = number }
variable "max_replicas" { type = number }
variable "database_url" { type = string; sensitive = true }
variable "redis_url" { type = string; sensitive = true }
variable "key_vault_id" { type = string }
variable "log_analytics_id" { type = string }

# ── Container Apps Environment ──────────────────────────────────────────────

resource "azurerm_container_app_environment" "main" {
  name                       = "${var.project}-${var.environment}-env"
  resource_group_name        = var.resource_group
  location                   = var.location
  log_analytics_workspace_id = var.log_analytics_id
  infrastructure_subnet_id   = var.app_subnet_id

  tags = { Name = "${var.project}-container-env" }
}

# ── Container App ───────────────────────────────────────────────────────────

resource "azurerm_container_app" "backend" {
  name                         = "${var.project}-backend"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = var.resource_group
  revision_mode                = "Single"

  registry {
    server               = var.acr_login_server
    username             = var.acr_admin_username
    password_secret_name = "acr-password"
  }

  secret {
    name  = "acr-password"
    value = var.acr_admin_password
  }

  secret {
    name  = "database-url"
    value = var.database_url
  }

  secret {
    name  = "redis-url"
    value = var.redis_url
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    container {
      name   = "backend"
      image  = var.backend_image
      cpu    = var.cpu
      memory = var.memory

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }

      env {
        name        = "REDIS_URL"
        secret_name = "redis-url"
      }

      env {
        name  = "DEBUG"
        value = "false"
      }

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }

      env {
        name  = "SEED_ON_STARTUP"
        value = "false"
      }

      liveness_probe {
        transport = "HTTP"
        path      = "/health"
        port      = 8000
        initial_delay    = 30
        interval_seconds = 30
        timeout          = 5
        failure_count_threshold = 3
      }

      readiness_probe {
        transport = "HTTP"
        path      = "/health"
        port      = 8000
        interval_seconds = 10
        timeout          = 5
        failure_count_threshold = 3
      }
    }

    http_scale_rule {
      name                = "http-scaling"
      concurrent_requests = "100"
    }
  }

  ingress {
    external_enabled = true
    target_port      = 8000
    transport        = "http"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  tags = { Name = "${var.project}-backend" }
}

# ── Outputs ──────────────────────────────────────────────────────────────────

output "fqdn" { value = azurerm_container_app.backend.ingress[0].fqdn }
output "container_app_id" { value = azurerm_container_app.backend.id }
