################################################################################
# VPC
################################################################################

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

################################################################################
# ALB
################################################################################

output "alb_dns_name" {
  description = "ALB DNS name (API endpoint)"
  value       = module.alb.alb_dns_name
}

################################################################################
# CloudFront
################################################################################

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name (frontend)"
  value       = module.cloudfront.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.cloudfront.distribution_id
}

################################################################################
# RDS
################################################################################

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.endpoint
}

output "rds_password_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the DB password"
  value       = module.rds.password_secret_arn
}

################################################################################
# ECR
################################################################################

output "ecr_repository_urls" {
  description = "Map of service name to ECR repository URL"
  value       = module.ecr.repository_urls
}

################################################################################
# ECS
################################################################################

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

################################################################################
# SQS
################################################################################

output "sqs_queue_urls" {
  description = "SQS queue URLs"
  value       = module.sqs.queue_urls
}

################################################################################
# S3
################################################################################

output "reports_bucket_id" {
  description = "Reports S3 bucket ID"
  value       = module.s3.reports_bucket_id
}

output "frontend_bucket_id" {
  description = "Frontend S3 bucket ID"
  value       = module.s3.frontend_bucket_id
}
