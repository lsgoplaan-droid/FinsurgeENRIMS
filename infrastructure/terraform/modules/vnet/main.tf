variable "project" { type = string }
variable "environment" { type = string }
variable "resource_group" { type = string }
variable "location" { type = string }
variable "vnet_address_space" { type = string }

# ── Virtual Network ─────────────────────────────────────────────────────────

resource "azurerm_virtual_network" "main" {
  name                = "${var.project}-${var.environment}-vnet"
  resource_group_name = var.resource_group
  location            = var.location
  address_space       = [var.vnet_address_space]

  tags = { Name = "${var.project}-vnet" }
}

# ── Subnets ─────────────────────────────────────────────────────────────────

resource "azurerm_subnet" "appgw" {
  name                 = "appgw-subnet"
  resource_group_name  = var.resource_group
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [cidrsubnet(var.vnet_address_space, 8, 0)]
}

resource "azurerm_subnet" "app" {
  name                 = "app-subnet"
  resource_group_name  = var.resource_group
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [cidrsubnet(var.vnet_address_space, 8, 1)]

  delegation {
    name = "container-apps"
    service_delegation {
      name    = "Microsoft.App/environments"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "db" {
  name                 = "db-subnet"
  resource_group_name  = var.resource_group
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [cidrsubnet(var.vnet_address_space, 8, 10)]

  delegation {
    name = "postgresql"
    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "redis" {
  name                 = "redis-subnet"
  resource_group_name  = var.resource_group
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [cidrsubnet(var.vnet_address_space, 8, 11)]
}

# ── NSGs ────────────────────────────────────────────────────────────────────

resource "azurerm_network_security_group" "app" {
  name                = "${var.project}-app-nsg"
  resource_group_name = var.resource_group
  location            = var.location

  security_rule {
    name                       = "allow-appgw"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "8000"
    source_address_prefix      = cidrsubnet(var.vnet_address_space, 8, 0)
    destination_address_prefix = "*"
  }
}

resource "azurerm_subnet_network_security_group_association" "app" {
  subnet_id                 = azurerm_subnet.app.id
  network_security_group_id = azurerm_network_security_group.app.id
}

resource "azurerm_network_security_group" "db" {
  name                = "${var.project}-db-nsg"
  resource_group_name = var.resource_group
  location            = var.location

  security_rule {
    name                       = "allow-app-to-postgres"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "5432"
    source_address_prefix      = cidrsubnet(var.vnet_address_space, 8, 1)
    destination_address_prefix = "*"
  }
}

resource "azurerm_subnet_network_security_group_association" "db" {
  subnet_id                 = azurerm_subnet.db.id
  network_security_group_id = azurerm_network_security_group.db.id
}

# ── Private DNS Zone for PostgreSQL ─────────────────────────────────────────

resource "azurerm_private_dns_zone" "postgres" {
  name                = "${var.project}.postgres.database.azure.com"
  resource_group_name = var.resource_group
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres" {
  name                  = "${var.project}-pg-link"
  resource_group_name   = var.resource_group
  private_dns_zone_name = azurerm_private_dns_zone.postgres.name
  virtual_network_id    = azurerm_virtual_network.main.id
}

# ── VNet Flow Logs (compliance) ─────────────────────────────────────────────

resource "azurerm_log_analytics_workspace" "flow_logs" {
  name                = "${var.project}-flow-logs"
  resource_group_name = var.resource_group
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = 365
}

# ── Outputs ──────────────────────────────────────────────────────────────────

output "vnet_id" { value = azurerm_virtual_network.main.id }
output "appgw_subnet_id" { value = azurerm_subnet.appgw.id }
output "app_subnet_id" { value = azurerm_subnet.app.id }
output "db_subnet_id" { value = azurerm_subnet.db.id }
output "redis_subnet_id" { value = azurerm_subnet.redis.id }
output "postgres_dns_zone_id" { value = azurerm_private_dns_zone.postgres.id }
