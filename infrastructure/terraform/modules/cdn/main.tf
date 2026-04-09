variable "project" { type = string }
variable "environment" { type = string }
variable "resource_group" { type = string }
variable "location" { type = string }
variable "api_fqdn" { type = string }
variable "frontend_domain" { type = string }

# ── Azure Front Door ────────────────────────────────────────────────────────
# Serves frontend (Static Web App) + proxies /api/* to Container App

resource "azurerm_cdn_frontdoor_profile" "main" {
  name                = "${var.project}-${var.environment}-fd"
  resource_group_name = var.resource_group
  sku_name            = "Standard_AzureFrontDoor"

  tags = { Name = "${var.project}-frontdoor" }
}

resource "azurerm_cdn_frontdoor_endpoint" "main" {
  name                     = "${var.project}-${var.environment}"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.main.id
}

# ── Origin Groups ───────────────────────────────────────────────────────────

resource "azurerm_cdn_frontdoor_origin_group" "api" {
  name                     = "api-origin-group"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.main.id

  load_balancing {
    sample_size                 = 4
    successful_samples_required = 3
  }

  health_probe {
    path                = "/health"
    protocol            = "Https"
    interval_in_seconds = 30
  }
}

resource "azurerm_cdn_frontdoor_origin" "api" {
  name                          = "api-origin"
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.api.id

  enabled                        = true
  host_name                      = var.api_fqdn
  http_port                      = 80
  https_port                     = 443
  origin_host_header             = var.api_fqdn
  certificate_name_check_enabled = true
}

# ── Routes ──────────────────────────────────────────────────────────────────

resource "azurerm_cdn_frontdoor_route" "api" {
  name                          = "api-route"
  cdn_frontdoor_endpoint_id     = azurerm_cdn_frontdoor_endpoint.main.id
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.api.id

  patterns_to_match = ["/api/*", "/health"]
  supported_protocols = ["Https"]
  https_redirect_enabled = true
  forwarding_protocol    = "HttpsOnly"

  cache {
    query_string_caching_behavior = "IgnoreQueryString"
  }
}

# ── Outputs ──────────────────────────────────────────────────────────────────

output "front_door_endpoint" { value = azurerm_cdn_frontdoor_endpoint.main.host_name }
output "front_door_profile_id" { value = azurerm_cdn_frontdoor_profile.main.id }
