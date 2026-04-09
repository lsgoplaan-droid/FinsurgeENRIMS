variable "project" { type = string }
variable "environment" { type = string }
variable "resource_group" { type = string }
variable "location" { type = string }
variable "db_subnet_id" { type = string }
variable "private_dns_zone_id" { type = string }
variable "db_name" { type = string }
variable "db_username" { type = string }
variable "sku_name" { type = string }

# ── Random password ─────────────────────────────────────────────────────────

resource "random_password" "db" {
  length  = 32
  special = false
}

# ── PostgreSQL Flexible Server ──────────────────────────────────────────────

resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "${var.project}-${var.environment}-pg"
  resource_group_name    = var.resource_group
  location               = var.location
  version                = "15"
  delegated_subnet_id    = var.db_subnet_id
  private_dns_zone_id    = var.private_dns_zone_id
  administrator_login    = var.db_username
  administrator_password = random_password.db.result
  zone                   = "1"
  sku_name               = var.sku_name

  storage_mb = 65536  # 64 GB

  high_availability {
    mode                      = "ZoneRedundant"
    standby_availability_zone = "2"
  }

  backup_retention_days        = 35  # RBI mandate: 5 weeks
  geo_redundant_backup_enabled = false  # India-only per data localization

  tags = { Name = "${var.project}-postgresql" }
}

# ── Server Configuration ────────────────────────────────────────────────────

resource "azurerm_postgresql_flexible_server_configuration" "log_slow_queries" {
  name      = "log_min_duration_statement"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "1000"  # Log queries > 1s
}

resource "azurerm_postgresql_flexible_server_configuration" "pg_stat_statements" {
  name      = "shared_preload_libraries"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "pg_stat_statements"
}

resource "azurerm_postgresql_flexible_server_configuration" "ssl_enforce" {
  name      = "require_secure_transport"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "on"
}

# ── Database ────────────────────────────────────────────────────────────────

resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = var.db_name
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# ── Diagnostics ─────────────────────────────────────────────────────────────

resource "azurerm_monitor_diagnostic_setting" "postgresql" {
  name                       = "${var.project}-pg-diagnostics"
  target_resource_id         = azurerm_postgresql_flexible_server.main.id
  log_analytics_workspace_id = null  # Passed from monitoring module if needed

  metric {
    category = "AllMetrics"
    enabled  = true
  }

  lifecycle {
    ignore_changes = [log_analytics_workspace_id]
  }
}

# ── Outputs ──────────────────────────────────────────────────────────────────

output "db_fqdn" { value = azurerm_postgresql_flexible_server.main.fqdn }
output "db_password" { value = random_password.db.result; sensitive = true }
output "server_id" { value = azurerm_postgresql_flexible_server.main.id }
