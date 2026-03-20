variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "queues" {
  description = "Map of queue configurations"
  type = map(object({
    visibility_timeout_seconds = optional(number, 300)
    message_retention_seconds  = optional(number, 1209600) # 14 days
    max_receive_count          = optional(number, 3)
    enable_dlq                 = optional(bool, true)
  }))
  default = {
    "sentinel-ingestion-jobs" = {
      enable_dlq = true
    }
    "sentinel-ai-pipeline" = {
      enable_dlq = true
    }
    "sentinel-notifications" = {
      enable_dlq = false
    }
  }
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
