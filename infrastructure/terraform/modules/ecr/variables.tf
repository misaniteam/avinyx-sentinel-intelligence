variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "service_names" {
  description = "List of service names to create ECR repositories for"
  type        = list(string)
  default = [
    "api-gateway",
    "auth-service",
    "tenant-service",
    "ingestion-service",
    "ingestion-worker",
    "ai-pipeline-service",
    "analytics-service",
    "campaign-service",
    "notification-service",
    "logging-service",
    "voter-service",
    "frontend",
  ]
}

variable "image_retention_count" {
  description = "Number of images to retain per repository"
  type        = number
  default     = 10
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
