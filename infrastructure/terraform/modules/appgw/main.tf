variable "project" { type = string }
variable "environment" { type = string }
variable "resource_group" { type = string }
variable "location" { type = string }
variable "vnet_id" { type = string }
variable "appgw_subnet_id" { type = string }
variable "backend_fqdn" { type = string }

# ── Public IP ───────────────────────────────────────────────────────────────

resource "azurerm_public_ip" "appgw" {
  name                = "${var.project}-appgw-pip"
  resource_group_name = var.resource_group
  location            = var.location
  allocation_method   = "Static"
  sku                 = "Standard"

  tags = { Name = "${var.project}-appgw-pip" }
}

# ── Application Gateway ─────────────────────────────────────────────────────

resource "azurerm_application_gateway" "main" {
  name                = "${var.project}-${var.environment}-appgw"
  resource_group_name = var.resource_group
  location            = var.location

  sku {
    name     = "WAF_v2"
    tier     = "WAF_v2"
    capacity = 2
  }

  gateway_ip_configuration {
    name      = "gateway-ip"
    subnet_id = var.appgw_subnet_id
  }

  frontend_ip_configuration {
    name                 = "frontend-ip"
    public_ip_address_id = azurerm_public_ip.appgw.id
  }

  frontend_port {
    name = "https-port"
    port = 443
  }

  frontend_port {
    name = "http-port"
    port = 80
  }

  backend_address_pool {
    name  = "backend-pool"
    fqdns = [var.backend_fqdn]
  }

  backend_http_settings {
    name                  = "backend-https-settings"
    cookie_based_affinity = "Disabled"
    port                  = 443
    protocol              = "Https"
    request_timeout       = 60
    pick_host_name_from_backend_address = true

    probe_name = "health-probe"
  }

  probe {
    name                                      = "health-probe"
    protocol                                  = "Https"
    path                                      = "/health"
    interval                                  = 30
    timeout                                   = 5
    unhealthy_threshold                       = 3
    pick_host_name_from_backend_http_settings = true
  }

  # HTTP listener (redirect to HTTPS)
  http_listener {
    name                           = "http-listener"
    frontend_ip_configuration_name = "frontend-ip"
    frontend_port_name             = "http-port"
    protocol                       = "Http"
  }

  # HTTPS listener
  http_listener {
    name                           = "https-listener"
    frontend_ip_configuration_name = "frontend-ip"
    frontend_port_name             = "https-port"
    protocol                       = "Https"
    ssl_certificate_name           = "appgw-cert"
  }

  # HTTP → HTTPS redirect
  redirect_configuration {
    name                 = "http-to-https"
    redirect_type        = "Permanent"
    target_listener_name = "https-listener"
    include_path         = true
    include_query_string = true
  }

  request_routing_rule {
    name                        = "http-redirect-rule"
    priority                    = 100
    rule_type                   = "Basic"
    http_listener_name          = "http-listener"
    redirect_configuration_name = "http-to-https"
  }

  request_routing_rule {
    name                       = "https-routing-rule"
    priority                   = 200
    rule_type                  = "Basic"
    http_listener_name         = "https-listener"
    backend_address_pool_name  = "backend-pool"
    backend_http_settings_name = "backend-https-settings"
  }

  ssl_policy {
    policy_type = "Predefined"
    policy_name = "AppGwSslPolicy20220101S"  # TLS 1.2+ only
  }

  tags = { Name = "${var.project}-appgw" }

  lifecycle {
    ignore_changes = [ssl_certificate]
  }
}

# ── Outputs ──────────────────────────────────────────────────────────────────

output "appgw_id" { value = azurerm_application_gateway.main.id }
output "appgw_public_ip" { value = azurerm_public_ip.appgw.ip_address }
