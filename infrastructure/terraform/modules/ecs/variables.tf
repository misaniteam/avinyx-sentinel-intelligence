variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "Security group ID for ECS tasks"
  type        = string
}

variable "ecr_repository_urls" {
  description = "Map of service name to ECR repository URL"
  type        = map(string)
}

variable "alb_target_group_arn" {
  description = "ARN of the ALB target group for api-gateway"
  type        = string
}

variable "http_services" {
  description = "Configuration for HTTP-based ECS services"
  type = map(object({
    port          = number
    cpu           = number
    memory        = number
    desired_count = number
    health_check_path = optional(string, "/health")
  }))
  default = {
    "api-gateway" = {
      port          = 8000
      cpu           = 512
      memory        = 1024
      desired_count = 2
    }
    "auth-service" = {
      port          = 8001
      cpu           = 256
      memory        = 512
      desired_count = 1
    }
    "tenant-service" = {
      port          = 8002
      cpu           = 256
      memory        = 512
      desired_count = 1
    }
    "ingestion-service" = {
      port          = 8003
      cpu           = 256
      memory        = 512
      desired_count = 1
    }
    "analytics-service" = {
      port          = 8005
      cpu           = 512
      memory        = 1024
      desired_count = 1
    }
    "campaign-service" = {
      port          = 8006
      cpu           = 256
      memory        = 512
      desired_count = 1
    }
    "notification-service" = {
      port          = 8007
      cpu           = 256
      memory        = 512
      desired_count = 1
    }
    "logging-service" = {
      port          = 8008
      cpu           = 256
      memory        = 512
      desired_count = 1
    }
  }
}

variable "worker_services" {
  description = "Configuration for worker (non-HTTP) ECS services"
  type = map(object({
    cpu           = number
    memory        = number
    desired_count = number
  }))
  default = {
    "ingestion-worker" = {
      cpu           = 512
      memory        = 1024
      desired_count = 1
    }
    "ai-pipeline-service" = {
      cpu           = 1024
      memory        = 2048
      desired_count = 1
    }
    "voter-service" = {
      cpu           = 512
      memory        = 1024
      desired_count = 1
    }
  }
}

variable "service_environment" {
  description = "Non-sensitive environment variables to inject into all ECS tasks"
  type        = map(string)
  default     = {}
}

variable "secrets_arns" {
  description = "Map of secret name to Secrets Manager ARN for sensitive values injected into ECS tasks"
  type        = map(string)
  default     = {}
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
