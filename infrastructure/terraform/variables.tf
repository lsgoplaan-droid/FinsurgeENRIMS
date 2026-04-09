variable "project" {
  description = "Project name used for resource naming"
  type        = string
  default     = "finsurge-enrims"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
}

variable "azure_region" {
  description = "Azure region — Central India for RBI data localization"
  type        = string
  default     = "centralindia"
}

# ── Network ──────────────────────────────────────────────────────────────────

variable "vnet_address_space" {
  description = "Address space for the Virtual Network"
  type        = string
  default     = "10.0.0.0/16"
}

# ── Database ─────────────────────────────────────────────────────────────────

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "finsurge_enrims"
}

variable "db_username" {
  description = "PostgreSQL administrator username"
  type        = string
  default     = "finsurge_admin"
}

variable "db_sku_name" {
  description = "PostgreSQL Flexible Server SKU"
  type        = string
  default     = "GP_Standard_D2s_v3"
}

# ── Redis ────────────────────────────────────────────────────────────────────

variable "redis_sku_name" {
  description = "Azure Cache for Redis SKU"
  type        = string
  default     = "Standard"
}

variable "redis_capacity" {
  description = "Azure Cache for Redis capacity (0-6 for Basic/Standard)"
  type        = number
  default     = 1
}

# ── Container Apps ───────────────────────────────────────────────────────────

variable "container_cpu" {
  description = "Container App CPU cores"
  type        = number
  default     = 1.0
}

variable "container_memory" {
  description = "Container App memory in Gi"
  type        = string
  default     = "2Gi"
}

variable "container_min_replicas" {
  description = "Minimum number of container replicas"
  type        = number
  default     = 2
}

variable "container_max_replicas" {
  description = "Maximum number of container replicas"
  type        = number
  default     = 6
}

# ── Domains ──────────────────────────────────────────────────────────────────

variable "api_domain" {
  description = "API domain (e.g., api.finsurge.example.com)"
  type        = string
}

variable "frontend_domain" {
  description = "Frontend domain (e.g., app.finsurge.example.com)"
  type        = string
}

# ── Secrets (pass via TF_VAR_ or tfvars file — NEVER commit) ────────────────

variable "secret_key" {
  description = "JWT signing key (256-bit hex)"
  type        = string
  sensitive   = true
}

variable "pii_encryption_key" {
  description = "PII AES encryption key (256-bit hex)"
  type        = string
  sensitive   = true
}

# ── Monitoring ───────────────────────────────────────────────────────────────

variable "alert_email" {
  description = "Email for Azure Monitor alert notifications"
  type        = string
}
