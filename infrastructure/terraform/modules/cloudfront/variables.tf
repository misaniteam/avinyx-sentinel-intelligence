variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "frontend_bucket_id" {
  description = "S3 bucket ID for frontend assets"
  type        = string
}

variable "frontend_bucket_arn" {
  description = "S3 bucket ARN for frontend assets"
  type        = string
}

variable "frontend_bucket_regional_domain_name" {
  description = "S3 bucket regional domain name"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate in ap-south-1 for CloudFront"
  type        = string
  default     = ""
}

variable "domain_aliases" {
  description = "Custom domain aliases for CloudFront"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
