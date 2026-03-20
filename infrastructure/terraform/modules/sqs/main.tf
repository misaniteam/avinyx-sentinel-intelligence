################################################################################
# Dead Letter Queues
################################################################################

resource "aws_sqs_queue" "dlq" {
  for_each = { for name, cfg in var.queues : name => cfg if cfg.enable_dlq }

  name                      = "${each.key}-dlq"
  message_retention_seconds = 1209600 # 14 days
  sqs_managed_sse_enabled   = true

  tags = merge(var.tags, {
    Name = "${each.key}-dlq"
    Type = "dlq"
  })
}

################################################################################
# Main Queues
################################################################################

resource "aws_sqs_queue" "main" {
  for_each = var.queues

  name                       = each.key
  visibility_timeout_seconds = each.value.visibility_timeout_seconds
  message_retention_seconds  = each.value.message_retention_seconds
  sqs_managed_sse_enabled    = true

  redrive_policy = each.value.enable_dlq ? jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq[each.key].arn
    maxReceiveCount     = each.value.max_receive_count
  }) : null

  tags = merge(var.tags, {
    Name = each.key
    Type = "main"
  })
}

################################################################################
# DLQ Redrive Allow Policy
################################################################################

resource "aws_sqs_queue_redrive_allow_policy" "dlq" {
  for_each = { for name, cfg in var.queues : name => cfg if cfg.enable_dlq }

  queue_url = aws_sqs_queue.dlq[each.key].id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.main[each.key].arn]
  })
}
