output "s3_bucket_name" {
  description = "Name of the S3 bucket for file uploads"
  value       = aws_s3_bucket.file_uploads.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.file_uploads.arn
}

output "sqs_queue_url" {
  description = "URL of the SQS queue"
  value       = aws_sqs_queue.file_processing.url
}

output "sqs_queue_arn" {
  description = "ARN of the SQS queue"
  value       = aws_sqs_queue.file_processing.arn
}

output "sqs_dlq_url" {
  description = "URL of the SQS dead letter queue"
  value       = aws_sqs_queue.file_processing_dlq.url
}

output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.file_processor.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.file_processor.arn
}

output "lambda_function_url" {
  description = "Function URL for direct Lambda invocation"
  value       = aws_lambda_function_url.file_processor.function_url
}

output "lambda_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_exec.arn
}

# CloudWatch Logs not available in LocalStack Community Edition
# output "cloudwatch_log_group" {
#   description = "CloudWatch log group for Lambda"
#   value       = aws_cloudwatch_log_group.lambda.name
# }

# OpenSearch outputs
output "opensearch_endpoint" {
  description = "OpenSearch domain endpoint"
  value       = aws_opensearch_domain.file_chunks.endpoint
}

output "opensearch_domain_name" {
  description = "OpenSearch domain name"
  value       = aws_opensearch_domain.file_chunks.domain_name
}

output "opensearch_arn" {
  description = "OpenSearch domain ARN"
  value       = aws_opensearch_domain.file_chunks.arn
}

output "opensearch_kibana_endpoint" {
  description = "OpenSearch Kibana endpoint"
  value       = aws_opensearch_domain.file_chunks.dashboard_endpoint
}

output "endpoints" {
  description = "Service endpoints for testing"
  value = {
    s3_endpoint     = var.localstack_endpoint
    sqs_endpoint    = var.localstack_endpoint
    lambda_endpoint = var.localstack_endpoint
  }
}
