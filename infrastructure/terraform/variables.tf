################################################################################
# General
################################################################################

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "sentinel"
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, production)"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"
}

################################################################################
# VPC
################################################################################

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b"]
}

variable "enable_ha_nat" {
  description = "Enable HA NAT Gateways (one per AZ)"
  type        = bool
  default     = false
}

################################################################################
# RDS
################################################################################

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_multi_az" {
  description = "Enable RDS Multi-AZ"
  type        = bool
  default     = true
}

variable "db_password" {
  description = "RDS master password (leave empty to auto-generate)"
  type        = string
  default     = ""
  sensitive   = true
}

################################################################################
# ALB / SSL
################################################################################

variable "acm_certificate_arn" {
  description = "ARN of ACM certificate for ALB HTTPS listener"
  type        = string
  default     = ""
}

################################################################################
# CloudFront
################################################################################

variable "cloudfront_acm_certificate_arn" {
  description = "ARN of ACM certificate in us-east-1 for CloudFront"
  type        = string
  default     = ""
}

variable "domain_aliases" {
  description = "Custom domain aliases for CloudFront"
  type        = list(string)
  default     = []
}

################################################################################
# Application
################################################################################

variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

variable "firebase_database_url" {
  description = "Firebase RTDB URL"
  type        = string
  default     = ""
}
