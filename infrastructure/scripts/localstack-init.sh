#!/bin/bash
set -euo pipefail

echo "Initializing LocalStack resources..."

# SQS: Ingestion queue with DLQ
awslocal sqs create-queue --queue-name sentinel-ingestion-jobs-dlq
awslocal sqs create-queue --queue-name sentinel-ingestion-jobs --attributes '{"RedrivePolicy":"{\"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:000000000000:sentinel-ingestion-jobs-dlq\",\"maxReceiveCount\":\"3\"}"}'

# SQS: AI pipeline queue with DLQ
awslocal sqs create-queue --queue-name sentinel-ai-pipeline-dlq
awslocal sqs create-queue --queue-name sentinel-ai-pipeline --attributes '{"RedrivePolicy":"{\"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:000000000000:sentinel-ai-pipeline-dlq\",\"maxReceiveCount\":\"3\"}"}'

# SQS: Notifications queue
awslocal sqs create-queue --queue-name sentinel-notifications

# SQS: Voter list processing queue with DLQ
awslocal sqs create-queue --queue-name sentinel-voter-list-jobs-dlq
awslocal sqs create-queue --queue-name sentinel-voter-list-jobs --attributes '{"RedrivePolicy":"{\"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:000000000000:sentinel-voter-list-jobs-dlq\",\"maxReceiveCount\":\"3\"}"}'

# SNS: Tenant events topic
awslocal sns create-topic --name sentinel-tenant-events

# S3: Reports bucket
awslocal s3 mb s3://sentinel-reports

# S3: Uploads bucket (file upload ingestion)
awslocal s3 mb s3://sentinel-uploads

# S3: Voter docs bucket (voter list PDFs)
awslocal s3 mb s3://voter-docs

echo "LocalStack initialization complete."
