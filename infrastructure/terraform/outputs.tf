output "resource_group" {
  value = azurerm_resource_group.main.name
}

output "container_app_fqdn" {
  description = "Backend API endpoint"
  value       = module.container_app.fqdn
}

output "front_door_endpoint" {
  description = "Frontend CDN endpoint"
  value       = module.cdn.front_door_endpoint
}

output "acr_login_server" {
  description = "ACR login server for backend docker images"
  value       = azurerm_container_registry.main.login_server
}

output "postgresql_fqdn" {
  description = "PostgreSQL Flexible Server FQDN"
  value       = module.postgresql.db_fqdn
  sensitive   = true
}

output "redis_hostname" {
  description = "Azure Cache for Redis hostname"
  value       = module.redis.hostname
  sensitive   = true
}

output "key_vault_uri" {
  value     = azurerm_key_vault.main.vault_uri
  sensitive = true
}

output "reports_storage_account" {
  value = azurerm_storage_account.reports.name
}
