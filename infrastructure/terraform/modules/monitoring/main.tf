variable "project" { type = string }
variable "environment" { type = string }
variable "resource_group" { type = string }
variable "location" { type = string }
variable "container_app_id" { type = string }
variable "postgresql_server_id" { type = string }
variable "redis_cache_id" { type = string }
variable "alert_email" { type = string }

# ── Log Analytics Workspace ─────────────────────────────────────────────────

resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.project}-${var.environment}-logs"
  resource_group_name = var.resource_group
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = 365  # 1 year — RBI compliance
}

# ── Action Group (email alerts) ─────────────────────────────────────────────

resource "azurerm_monitor_action_group" "main" {
  name                = "${var.project}-${var.environment}-alerts"
  resource_group_name = var.resource_group
  short_name          = "enrims-alert"

  email_receiver {
    name          = "ops-email"
    email_address = var.alert_email
  }
}

# ── Container App CPU Alert ─────────────────────────────────────────────────

resource "azurerm_monitor_metric_alert" "container_cpu_high" {
  name                = "${var.project}-container-cpu-high"
  resource_group_name = var.resource_group
  scopes              = [var.container_app_id]
  severity            = 2
  frequency           = "PT1M"
  window_size         = "PT5M"

  criteria {
    metric_namespace = "Microsoft.App/containerApps"
    metric_name      = "UsageNanoCores"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 800000000  # 80% of 1 core
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }
}

# ── Container App Memory Alert ──────────────────────────────────────────────

resource "azurerm_monitor_metric_alert" "container_memory_high" {
  name                = "${var.project}-container-memory-high"
  resource_group_name = var.resource_group
  scopes              = [var.container_app_id]
  severity            = 2
  frequency           = "PT1M"
  window_size         = "PT5M"

  criteria {
    metric_namespace = "Microsoft.App/containerApps"
    metric_name      = "WorkingSetBytes"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 1717986918  # ~1.6 GB (85% of 2 Gi)
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }
}

# ── PostgreSQL CPU Alert ────────────────────────────────────────────────────

resource "azurerm_monitor_metric_alert" "postgresql_cpu_high" {
  name                = "${var.project}-pg-cpu-high"
  resource_group_name = var.resource_group
  scopes              = [var.postgresql_server_id]
  severity            = 2
  frequency           = "PT1M"
  window_size         = "PT5M"

  criteria {
    metric_namespace = "Microsoft.DBforPostgreSQL/flexibleServers"
    metric_name      = "cpu_percent"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }
}

# ── PostgreSQL Connections Alert ────────────────────────────────────────────

resource "azurerm_monitor_metric_alert" "postgresql_connections_high" {
  name                = "${var.project}-pg-connections-high"
  resource_group_name = var.resource_group
  scopes              = [var.postgresql_server_id]
  severity            = 2
  frequency           = "PT1M"
  window_size         = "PT5M"

  criteria {
    metric_namespace = "Microsoft.DBforPostgreSQL/flexibleServers"
    metric_name      = "active_connections"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }
}

# ── PostgreSQL Storage Alert ────────────────────────────────────────────────

resource "azurerm_monitor_metric_alert" "postgresql_storage_high" {
  name                = "${var.project}-pg-storage-high"
  resource_group_name = var.resource_group
  scopes              = [var.postgresql_server_id]
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "Microsoft.DBforPostgreSQL/flexibleServers"
    metric_name      = "storage_percent"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 85
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }
}

# ── Redis Memory Alert ──────────────────────────────────────────────────────

resource "azurerm_monitor_metric_alert" "redis_memory_high" {
  name                = "${var.project}-redis-memory-high"
  resource_group_name = var.resource_group
  scopes              = [var.redis_cache_id]
  severity            = 2
  frequency           = "PT1M"
  window_size         = "PT5M"

  criteria {
    metric_namespace = "Microsoft.Cache/redis"
    metric_name      = "usedmemorypercentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 85
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }
}

# ── Azure Dashboard ─────────────────────────────────────────────────────────

resource "azurerm_portal_dashboard" "main" {
  name                = "${var.project}-${var.environment}-dashboard"
  resource_group_name = var.resource_group
  location            = var.location
  dashboard_properties = jsonencode({
    lenses = {
      "0" = {
        order = 0
        parts = {
          "0" = {
            position = { x = 0, y = 0, rowSpan = 4, colSpan = 6 }
            metadata = {
              type = "Extension/HubsExtension/PartType/MonitorChartPart"
              inputs = [{
                name  = "options"
                value = {
                  chart = {
                    title = "Container App CPU & Memory"
                    metrics = [
                      { resourceMetadata = { id = var.container_app_id }, name = "UsageNanoCores", aggregationType = 4 },
                      { resourceMetadata = { id = var.container_app_id }, name = "WorkingSetBytes", aggregationType = 4 },
                    ]
                  }
                }
              }]
            }
          }
          "1" = {
            position = { x = 6, y = 0, rowSpan = 4, colSpan = 6 }
            metadata = {
              type = "Extension/HubsExtension/PartType/MonitorChartPart"
              inputs = [{
                name  = "options"
                value = {
                  chart = {
                    title = "PostgreSQL Performance"
                    metrics = [
                      { resourceMetadata = { id = var.postgresql_server_id }, name = "cpu_percent", aggregationType = 4 },
                      { resourceMetadata = { id = var.postgresql_server_id }, name = "active_connections", aggregationType = 4 },
                    ]
                  }
                }
              }]
            }
          }
        }
      }
    }
  })

  tags = { Name = "${var.project}-dashboard" }
}

# ── Outputs ──────────────────────────────────────────────────────────────────

output "log_analytics_workspace_id" { value = azurerm_log_analytics_workspace.main.id }
output "action_group_id" { value = azurerm_monitor_action_group.main.id }
