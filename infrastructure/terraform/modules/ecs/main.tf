################################################################################
# Data Sources
################################################################################

data "aws_caller_identity" "current" {}

locals {
  account_id   = data.aws_caller_identity.current.account_id
  all_services = merge(var.http_services, var.worker_services)
}

################################################################################
# ECS Cluster
################################################################################

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-cluster"
  })
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

################################################################################
# Cloud Map Namespace (Service Discovery)
################################################################################

resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "sentinel.local"
  description = "Service discovery namespace for ${var.project_name}"
  vpc         = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-namespace"
  })
}

################################################################################
# CloudWatch Log Groups
################################################################################

resource "aws_cloudwatch_log_group" "services" {
  for_each = local.all_services

  name              = "/ecs/${var.project_name}-${each.key}"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Service = each.key
  })
}

################################################################################
# IAM — Task Execution Role (pulls images, writes logs)
################################################################################

resource "aws_iam_role" "task_execution" {
  name = "${var.project_name}-${var.environment}-task-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "task_execution_ecr_logs" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "task_execution_secrets" {
  name = "${var.project_name}-${var.environment}-execution-secrets"
  role = aws_iam_role.task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "ssm:GetParameters",
          "ssm:GetParameter",
        ]
        Resource = "arn:aws:secretsmanager:${var.region}:${local.account_id}:secret:${var.project_name}/*"
      }
    ]
  })
}

################################################################################
# IAM — Task Role (app-level permissions: SQS, SNS, S3)
################################################################################

resource "aws_iam_role" "task" {
  name = "${var.project_name}-${var.environment}-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "task_sqs_sns_s3" {
  name = "${var.project_name}-${var.environment}-task-permissions"
  role = aws_iam_role.task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
          "sqs:ChangeMessageVisibility",
        ]
        Resource = "arn:aws:sqs:${var.region}:${local.account_id}:sentinel-*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish",
          "sns:Subscribe",
        ]
        Resource = "arn:aws:sns:${var.region}:${local.account_id}:sentinel-*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket",
          "s3:DeleteObject",
        ]
        Resource = [
          "arn:aws:s3:::sentinel-*",
          "arn:aws:s3:::sentinel-*/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ]
        Resource = [
          "arn:aws:bedrock:*::foundation-model/anthropic.claude-*",
          "arn:aws:bedrock:*::foundation-model/amazon.titan-*",
        ]
      },
    ]
  })
}

################################################################################
# Service Discovery — HTTP Services
################################################################################

resource "aws_service_discovery_service" "http" {
  for_each = var.http_services

  name = each.key

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = merge(var.tags, {
    Service = each.key
  })
}

################################################################################
# Task Definitions — HTTP Services
################################################################################

resource "aws_ecs_task_definition" "http" {
  for_each = var.http_services

  family                   = "${var.project_name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = each.key
      image     = "${var.ecr_repository_urls[each.key]}:latest"
      essential = true

      portMappings = [
        {
          containerPort = each.value.port
          protocol      = "tcp"
        }
      ]

      environment = [
        for key, value in merge(var.service_environment, {
          SERVICE_NAME = each.key
          ENVIRONMENT  = var.environment
          PORT         = tostring(each.value.port)
        }) : {
          name  = key
          value = value
        }
      ]

      secrets = [
        for key, arn in var.secrets_arns : {
          name      = key
          valueFrom = arn
        }
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${each.value.port}${each.value.health_check_path} || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.services[each.key].name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = merge(var.tags, {
    Service = each.key
  })
}

################################################################################
# Task Definitions — Worker Services
################################################################################

resource "aws_ecs_task_definition" "worker" {
  for_each = var.worker_services

  family                   = "${var.project_name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = each.key
      image     = "${var.ecr_repository_urls[each.key]}:latest"
      essential = true

      environment = [
        for key, value in merge(var.service_environment, {
          SERVICE_NAME = each.key
          ENVIRONMENT  = var.environment
        }) : {
          name  = key
          value = value
        }
      ]

      secrets = [
        for key, arn in var.secrets_arns : {
          name      = key
          valueFrom = arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.services[each.key].name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = merge(var.tags, {
    Service = each.key
  })
}

################################################################################
# Task Definition — Database Migration (one-off task)
################################################################################

resource "aws_cloudwatch_log_group" "migrate" {
  name              = "/ecs/${var.project_name}-migrate"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_ecs_task_definition" "migrate" {
  family                   = "${var.project_name}-migrate-${var.environment}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "migrate"
      image     = "${var.ecr_repository_urls["auth-service"]}:latest"
      essential = true

      command = ["alembic", "upgrade", "head"]

      environment = [
        for key, value in merge(var.service_environment, {
          SERVICE_NAME = "migrate"
          ENVIRONMENT  = var.environment
        }) : {
          name  = key
          value = value
        }
      ]

      secrets = [
        for key, arn in var.secrets_arns : {
          name      = key
          valueFrom = arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.migrate.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = merge(var.tags, {
    Service = "migrate"
  })
}

################################################################################
# ECS Services — HTTP
################################################################################

resource "aws_ecs_service" "http" {
  for_each = var.http_services

  name            = each.key
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.http[each.key].arn
  desired_count   = each.value.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.http[each.key].arn
  }

  # Only api-gateway gets an ALB target group
  dynamic "load_balancer" {
    for_each = each.key == "api-gateway" ? [1] : []
    content {
      target_group_arn = var.alb_target_group_arn
      container_name   = each.key
      container_port   = each.value.port
    }
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100

  tags = merge(var.tags, {
    Service = each.key
  })

  lifecycle {
    ignore_changes = [task_definition]
  }
}

################################################################################
# ECS Services — Workers
################################################################################

resource "aws_ecs_service" "worker" {
  for_each = var.worker_services

  name            = each.key
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker[each.key].arn
  desired_count   = each.value.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  tags = merge(var.tags, {
    Service = each.key
  })

  lifecycle {
    ignore_changes = [task_definition]
  }
}

################################################################################
# Auto Scaling — Workers
################################################################################

resource "aws_appautoscaling_target" "workers" {
  for_each = var.worker_services

  max_capacity       = 10
  min_capacity       = each.value.desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.worker[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "workers_cpu" {
  for_each = var.worker_services

  name               = "${each.key}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.workers[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.workers[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.workers[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
