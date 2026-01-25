# Package Lambda function
data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = var.lambda_source_dir
  output_path = "${path.module}/lambda-function.zip"
  excludes = [
    "node_modules",
    "dist",
    "*.zip",
    ".git",
    ".gitignore",
    "README.md"
  ]
}

# Lambda Function
resource "aws_lambda_function" "file_processor" {
  filename         = data.archive_file.lambda.output_path
  function_name    = var.lambda_function_name
  role            = aws_iam_role.lambda_exec.arn
  handler         = "src/handler.handler"
  source_code_hash = data.archive_file.lambda.output_base64sha256
  runtime         = "nodejs20.x"
  timeout         = var.lambda_timeout
  memory_size     = var.lambda_memory_size

  environment {
    variables = {
      AWS_ENDPOINT            = var.localstack_endpoint
      AWS_REGION             = var.aws_region
      S3_BUCKET_NAME         = aws_s3_bucket.file_uploads.id
      ELASTICSEARCH_NODE     = var.localstack_endpoint
      ELASTICSEARCH_INDEX    = var.opensearch_domain_name
      ELASTICSEARCH_USERNAME = "admin"
      ELASTICSEARCH_PASSWORD = "admin"
      OPENSEARCH_ENDPOINT    = aws_opensearch_domain.file_chunks.endpoint
      OPENSEARCH_DOMAIN      = aws_opensearch_domain.file_chunks.domain_name
      CHUNK_SIZE            = var.chunk_size
      CHUNK_OVERLAP         = var.chunk_overlap
      NODE_ENV              = var.environment
    }
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-lambda"
  })

  depends_on = [
    # aws_cloudwatch_log_group.lambda,  # Commented out - CloudWatch Logs not available in LocalStack
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy.lambda_custom,
    aws_opensearch_domain.file_chunks,
    null_resource.create_opensearch_index
  ]
}

# Lambda permission for SQS
resource "aws_lambda_permission" "allow_sqs" {
  statement_id  = "AllowExecutionFromSQS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.file_processor.function_name
  principal     = "sqs.amazonaws.com"
  source_arn    = aws_sqs_queue.file_processing.arn
}

# SQS Event Source Mapping
resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn                   = aws_sqs_queue.file_processing.arn
  function_name                      = aws_lambda_function.file_processor.arn
  enabled                           = true
  batch_size                        = var.lambda_batch_size
  maximum_batching_window_in_seconds = 10
  function_response_types           = ["ReportBatchItemFailures"]

  depends_on = [
    aws_lambda_permission.allow_sqs
  ]
}

# Lambda Function URL (optional - for direct invocation)
resource "aws_lambda_function_url" "file_processor" {
  function_name      = aws_lambda_function.file_processor.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = true
    allow_origins     = ["*"]
    allow_methods     = ["POST", "GET"]
    allow_headers     = ["*"]
    max_age          = 3600
  }
}
