output "queue_urls" {
  description = "Map of queue name to URL"
  value       = { for name, queue in aws_sqs_queue.main : name => queue.url }
}

output "queue_arns" {
  description = "Map of queue name to ARN"
  value       = { for name, queue in aws_sqs_queue.main : name => queue.arn }
}

output "dlq_urls" {
  description = "Map of DLQ name to URL"
  value       = { for name, queue in aws_sqs_queue.dlq : name => queue.url }
}

output "dlq_arns" {
  description = "Map of DLQ name to ARN"
  value       = { for name, queue in aws_sqs_queue.dlq : name => queue.arn }
}
