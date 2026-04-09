variable "project" { type = string }
variable "environment" { type = string }
variable "resource_group" { type = string }
variable "location" { type = string }
variable "appgw_id" { type = string }

# ── WAF Policy ──────────────────────────────────────────────────────────────
# Note: When using WAF_v2 Application Gateway, WAF is configured via policy.
# The Application Gateway module uses WAF_v2 SKU. This module provides the
# WAF policy with OWASP rules and custom rate limiting.

resource "azurerm_web_application_firewall_policy" "main" {
  name                = "${var.project}-${var.environment}-waf-policy"
  resource_group_name = var.resource_group
  location            = var.location

  # ── OWASP Managed Rules ─────────────────────────────────────────────────
  managed_rules {
    managed_rule_set {
      type    = "OWASP"
      version = "3.2"

      rule_group_override {
        rule_group_name = "REQUEST-942-APPLICATION-ATTACK-SQLI"
      }

      rule_group_override {
        rule_group_name = "REQUEST-941-APPLICATION-ATTACK-XSS"
      }

      rule_group_override {
        rule_group_name = "REQUEST-931-APPLICATION-ATTACK-RFI"
      }
    }

    managed_rule_set {
      type    = "Microsoft_BotManagerRuleSet"
      version = "1.0"
    }
  }

  # ── Rate Limiting — Global API ──────────────────────────────────────────
  custom_rules {
    name      = "RateLimitGlobalAPI"
    priority  = 1
    rule_type = "RateLimitRule"
    action    = "Block"

    rate_limit_duration_in_minutes = 1
    rate_limit_threshold           = 200

    match_conditions {
      match_variables {
        variable_name = "RequestUri"
      }
      operator           = "Contains"
      match_values       = ["/api/"]
      negation_condition = false
    }
  }

  # ── Rate Limiting — Login ───────────────────────────────────────────────
  custom_rules {
    name      = "RateLimitLogin"
    priority  = 2
    rule_type = "RateLimitRule"
    action    = "Block"

    rate_limit_duration_in_minutes = 1
    rate_limit_threshold           = 10

    match_conditions {
      match_variables {
        variable_name = "RequestUri"
      }
      operator           = "Contains"
      match_values       = ["/api/v1/auth/login"]
      negation_condition = false
    }
  }

  # ── Block known bad IPs ─────────────────────────────────────────────────
  custom_rules {
    name      = "BlockBadUserAgents"
    priority  = 3
    rule_type = "MatchRule"
    action    = "Block"

    match_conditions {
      match_variables {
        variable_name = "RequestHeaders"
        selector      = "User-Agent"
      }
      operator           = "Contains"
      match_values       = ["sqlmap", "nikto", "nmap", "masscan"]
      negation_condition = false
      transforms         = ["Lowercase"]
    }
  }

  policy_settings {
    enabled                     = true
    mode                        = "Prevention"
    request_body_check          = true
    max_request_body_size_in_kb = 128
    file_upload_limit_in_mb     = 10
  }

  tags = { Name = "${var.project}-waf-policy" }
}

# ── Log Analytics for WAF ───────────────────────────────────────────────────

resource "azurerm_log_analytics_workspace" "waf" {
  name                = "${var.project}-waf-logs"
  resource_group_name = var.resource_group
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = 90
}
