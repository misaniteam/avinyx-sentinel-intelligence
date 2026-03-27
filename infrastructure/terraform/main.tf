################################################################################
# Terraform Configuration
################################################################################

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  backend "s3" {
    bucket         = "avinyx-sentinel-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "sentinel-terraform-locks"
    encrypt        = true
  }
}

################################################################################
# Provider
################################################################################

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      project     = var.project_name
      environment = var.environment
      managed_by  = "terraform"
    }
  }
}

################################################################################
# Common Tags
################################################################################

locals {
  common_tags = {
    project     = var.project_name
    environment = var.environment
  }
}

################################################################################
# VPC
################################################################################

module "vpc" {
  source = "./modules/vpc"

  project_name       = var.project_name
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  enable_ha_nat      = var.enable_ha_nat
  tags               = local.common_tags
}

################################################################################
# ECR
################################################################################

module "ecr" {
  source = "./modules/ecr"

  project_name = var.project_name
  environment  = var.environment
  tags         = local.common_tags
}

################################################################################
# S3
################################################################################

module "s3" {
  source = "./modules/s3"

  project_name = var.project_name
  environment  = var.environment
  tags         = local.common_tags
}

################################################################################
# SQS
################################################################################

module "sqs" {
  source = "./modules/sqs"

  project_name = var.project_name
  environment  = var.environment
  tags         = local.common_tags
}

################################################################################
# RDS
################################################################################

module "rds" {
  source = "./modules/rds"

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  rds_security_group_id = module.vpc.rds_security_group_id
  instance_class        = var.db_instance_class
  multi_az              = var.db_multi_az
  db_password           = var.db_password
  tags                  = local.common_tags
}

################################################################################
# ALB
################################################################################

module "alb" {
  source = "./modules/alb"

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  public_subnet_ids     = module.vpc.public_subnet_ids
  alb_security_group_id = module.vpc.alb_security_group_id
  acm_certificate_arn   = var.acm_certificate_arn
  tags                  = local.common_tags
}

################################################################################
# Secrets Manager — sensitive values for ECS tasks
################################################################################

resource "aws_secretsmanager_secret" "database_url" {
  name        = "${var.project_name}/${var.environment}/database-url"
  description = "Database connection string for ${var.project_name} ${var.environment}"
  tags        = local.common_tags
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = module.rds.database_url
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "${var.project_name}/${var.environment}/jwt-secret"
  description = "JWT signing secret for ${var.project_name} ${var.environment}"
  tags        = local.common_tags
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = var.jwt_secret
}

################################################################################
# ECS
################################################################################

module "ecs" {
  source = "./modules/ecs"

  project_name          = var.project_name
  environment           = var.environment
  region                = var.region
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  ecs_security_group_id = module.vpc.ecs_security_group_id
  ecr_repository_urls   = module.ecr.repository_urls
  alb_target_group_arn  = module.alb.target_group_arn
  tags                  = local.common_tags

  # Non-sensitive environment variables only
  service_environment = {
    SQS_INGESTION_JOBS_URL        = module.sqs.queue_urls["sentinel-ingestion-jobs"]
    SQS_AI_PIPELINE_URL           = module.sqs.queue_urls["sentinel-ai-pipeline"]
    SQS_NOTIFICATIONS_URL         = module.sqs.queue_urls["sentinel-notifications"]
    S3_REPORTS_BUCKET             = module.s3.reports_bucket_id
    FIREBASE_DATABASE_URL         = var.firebase_database_url
    AWS_DEFAULT_REGION            = var.region
    AUTH_SERVICE_URL              = "http://auth-service.sentinel.local:8001"
    TENANT_SERVICE_URL            = "http://tenant-service.sentinel.local:8002"
    INGESTION_SERVICE_URL         = "http://ingestion-service.sentinel.local:8003"
    ANALYTICS_SERVICE_URL         = "http://analytics-service.sentinel.local:8005"
    CAMPAIGN_SERVICE_URL          = "http://campaign-service.sentinel.local:8006"
    NOTIFICATION_SERVICE_URL      = "http://notification-service.sentinel.local:8007"
  }

  # Sensitive values injected via Secrets Manager
  secrets_arns = {
    DATABASE_URL = aws_secretsmanager_secret.database_url.arn
    JWT_SECRET   = aws_secretsmanager_secret.jwt_secret.arn
  }
}

################################################################################
# CloudFront
################################################################################

module "cloudfront" {
  source = "./modules/cloudfront"

  project_name                         = var.project_name
  environment                          = var.environment
  frontend_bucket_id                   = module.s3.frontend_bucket_id
  frontend_bucket_arn                  = module.s3.frontend_bucket_arn
  frontend_bucket_regional_domain_name = module.s3.frontend_bucket_regional_domain_name
  acm_certificate_arn                  = var.cloudfront_acm_certificate_arn
  domain_aliases                       = var.domain_aliases
  tags                                 = local.common_tags
}
