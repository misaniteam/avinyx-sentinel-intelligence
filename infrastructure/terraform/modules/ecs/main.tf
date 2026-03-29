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

  capacity_providers = concat(
    ["FARGATE", "FARGATE_SPOT"],
    var.enable_gpu ? [aws_ecs_capacity_provider.gpu[0].name] : []
  )

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

################################################################################
# EC2 GPU Capacity Provider (for voter-service OCR)
################################################################################

# AMI lookup — ECS-optimized Amazon Linux 2 with GPU/NVIDIA support
data "aws_ssm_parameter" "ecs_gpu_ami" {
  count = var.enable_gpu ? 1 : 0
  name  = "/aws/service/ecs/optimized-ami/amazon-linux-2/gpu/recommended/image_id"
}

# IAM role for EC2 instances to join ECS cluster
resource "aws_iam_role" "ecs_gpu_instance" {
  count = var.enable_gpu ? 1 : 0
  name  = "${var.project_name}-${var.environment}-gpu-instance"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "gpu_instance_ecs" {
  count      = var.enable_gpu ? 1 : 0
  role       = aws_iam_role.ecs_gpu_instance[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_role_policy_attachment" "gpu_instance_ssm" {
  count      = var.enable_gpu ? 1 : 0
  role       = aws_iam_role.ecs_gpu_instance[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ecs_gpu" {
  count = var.enable_gpu ? 1 : 0
  name  = "${var.project_name}-${var.environment}-gpu-instance-profile"
  role  = aws_iam_role.ecs_gpu_instance[0].name
  tags  = var.tags
}

# Launch template for GPU instances
resource "aws_launch_template" "gpu" {
  count = var.enable_gpu ? 1 : 0

  name_prefix   = "${var.project_name}-${var.environment}-gpu-"
  image_id      = data.aws_ssm_parameter.ecs_gpu_ami[0].value
  instance_type = var.gpu_instance_type

  iam_instance_profile {
    arn = aws_iam_instance_profile.ecs_gpu[0].arn
  }

  vpc_security_group_ids = [var.ecs_security_group_id]

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = 50
      volume_type           = "gp3"
      delete_on_termination = true
      encrypted             = true
    }
  }

  user_data = base64encode(<<-EOF
    #!/bin/bash
    echo "ECS_CLUSTER=${aws_ecs_cluster.main.name}" >> /etc/ecs/ecs.config
    echo "ECS_ENABLE_GPU_SUPPORT=true" >> /etc/ecs/ecs.config
    echo "ECS_AVAILABLE_LOGGING_DRIVERS=[\"json-file\",\"awslogs\"]" >> /etc/ecs/ecs.config
  EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = merge(var.tags, {
      Name = "${var.project_name}-${var.environment}-gpu-worker"
    })
  }

  tags = var.tags
}

# Auto Scaling Group — scales 0→1 when ECS places a GPU task
resource "aws_autoscaling_group" "gpu" {
  count = var.enable_gpu ? 1 : 0

  name_prefix      = "${var.project_name}-${var.environment}-gpu-"
  min_size         = 0
  max_size         = 1
  desired_capacity = 0

  vpc_zone_identifier = var.private_subnet_ids

  launch_template {
    id      = aws_launch_template.gpu[0].id
    version = "$Latest"
  }

  tag {
    key                 = "AmazonECSManaged"
    value               = true
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ECS Capacity Provider backed by the GPU ASG
resource "aws_ecs_capacity_provider" "gpu" {
  count = var.enable_gpu ? 1 : 0
  name  = "${var.project_name}-${var.environment}-gpu"

  auto_scaling_group_provider {
    auto_scaling_group_arn         = aws_autoscaling_group.gpu[0].arn
    managed_termination_protection = "DISABLED"

    managed_scaling {
      maximum_scaling_step_size = 1
      minimum_scaling_step_size = 1
      status                    = "ENABLED"
      target_capacity           = 100
    }
  }

  tags = var.tags
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
          "arn:aws:s3:::avinyx-sentinel-*",
          "arn:aws:s3:::avinyx-sentinel-*/*",
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
          "arn:aws:bedrock:*:*:inference-profile/apac.anthropic.*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "textract:DetectDocumentText",
        ]
        Resource = "*"
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
# Task Definitions — Worker Services (Fargate)
################################################################################

resource "aws_ecs_task_definition" "worker" {
  for_each = {
    for name, config in var.worker_services : name => config
    if config.launch_type == "FARGATE"
  }

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
# Task Definitions — Worker Services (EC2 GPU)
################################################################################

resource "aws_ecs_task_definition" "worker_gpu" {
  for_each = {
    for name, config in var.worker_services : name => config
    if config.launch_type == "EC2" && var.enable_gpu
  }

  family                   = "${var.project_name}-${each.key}"
  requires_compatibilities = ["EC2"]
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

      resourceRequirements = each.value.gpu > 0 ? [
        {
          type  = "GPU"
          value = tostring(each.value.gpu)
        }
      ] : []

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

  # api-gateway and frontend get ALB target groups
  dynamic "load_balancer" {
    for_each = each.key == "api-gateway" ? [var.alb_target_group_arn] : each.key == "frontend" ? [var.frontend_target_group_arn] : []
    content {
      target_group_arn = load_balancer.value
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
# ECS Services — Workers (Fargate)
################################################################################

resource "aws_ecs_service" "worker" {
  for_each = {
    for name, config in var.worker_services : name => config
    if config.launch_type == "FARGATE"
  }

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
# ECS Services — Workers (EC2 GPU)
################################################################################

resource "aws_ecs_service" "worker_gpu" {
  for_each = {
    for name, config in var.worker_services : name => config
    if config.launch_type == "EC2" && var.enable_gpu
  }

  name            = each.key
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker_gpu[each.key].arn
  desired_count   = each.value.desired_count

  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.gpu[0].name
    weight            = 1
    base              = 1
  }

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
# Auto Scaling — Workers (Fargate)
################################################################################

locals {
  fargate_workers = {
    for name, config in var.worker_services : name => config
    if config.launch_type == "FARGATE"
  }
  gpu_workers = {
    for name, config in var.worker_services : name => config
    if config.launch_type == "EC2" && var.enable_gpu
  }
}

resource "aws_appautoscaling_target" "workers" {
  for_each = local.fargate_workers

  max_capacity       = 10
  min_capacity       = each.value.desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.worker[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "workers_cpu" {
  for_each = local.fargate_workers

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

################################################################################
# Auto Scaling — Workers (EC2 GPU)
################################################################################

resource "aws_appautoscaling_target" "workers_gpu" {
  for_each = local.gpu_workers

  max_capacity       = 2
  min_capacity       = each.value.desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.worker_gpu[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "workers_gpu_cpu" {
  for_each = local.gpu_workers

  name               = "${each.key}-gpu-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.workers_gpu[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.workers_gpu[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.workers_gpu[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
