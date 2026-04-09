variable "project" { type = string }
variable "environment" { type = string }
variable "resource_group" { type = string }
variable "location" { type = string }
variable "redis_subnet_id" { type = string }
variable "sku_name" { type = string }
variable "capacity" { type = number }

# ── Azure Cache for Redis ───────────────────────────────────────────────────

resource "azurerm_redis_cache" "main" {
  name                = "${var.project}-${var.environment}-redis"
  resource_group_name = var.resource_group
  location            = var.location
  capacity            = var.capacity
  family              = var.sku_name == "Premium" ? "P" : "C"
  sku_name            = var.sku_name
  enable_non_ssl_port = false
  minimum_tls_version = "1.2"
  subnet_id           = var.sku_name == "Premium" ? var.redis_subnet_id : null

  redis_configuration {
    maxmemory_policy = "allkeys-lru"
  }

  patch_schedule {
    day_of_week    = "Sunday"
    start_hour_utc = 5  # 10:30 AM IST
  }

  tags = { Name = "${var.project}-redis" }
}

# ── Outputs ──────────────────────────────────────────────────────────────────

output "hostname" { value = azurerm_redis_cache.main.hostname }
output "primary_access_key" { value = azurerm_redis_cache.main.primary_access_key; sensitive = true }
output "redis_cache_id" { value = azurerm_redis_cache.main.id }
