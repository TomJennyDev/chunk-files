# S3 Bucket for file uploads
resource "aws_s3_bucket" "file_uploads" {
  bucket = var.s3_bucket_name

  tags = merge(var.tags, {
    Name = "${var.project_name}-uploads"
  })
}

resource "aws_s3_bucket_versioning" "file_uploads" {
  bucket = aws_s3_bucket.file_uploads.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "file_uploads" {
  bucket = aws_s3_bucket.file_uploads.id

  rule {
    id     = "cleanup-old-versions"
    status = "Enabled"

    filter {
      prefix = ""
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  rule {
    id     = "expire-large-files"
    status = "Enabled"

    filter {
      prefix = "uploads/"
    }

    expiration {
      days = 90
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "file_uploads" {
  bucket = aws_s3_bucket.file_uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# SQS Queue for file processing
resource "aws_sqs_queue" "file_processing" {
  name                       = var.sqs_queue_name
  visibility_timeout_seconds = var.lambda_timeout * 6
  message_retention_seconds  = 1209600 # 14 days
  max_message_size           = 262144  # 256 KB
  delay_seconds              = 0
  receive_wait_time_seconds  = 20 # Long polling

  tags = merge(var.tags, {
    Name = "${var.project_name}-queue"
  })
}

# SQS Dead Letter Queue
resource "aws_sqs_queue" "file_processing_dlq" {
  name                      = "${var.sqs_queue_name}-dlq"
  message_retention_seconds = 1209600 # 14 days

  tags = merge(var.tags, {
    Name = "${var.project_name}-dlq"
  })
}

# Redrive policy for main queue
resource "aws_sqs_queue_redrive_policy" "file_processing" {
  queue_url = aws_sqs_queue.file_processing.id

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.file_processing_dlq.arn
    maxReceiveCount     = 3
  })
}

# CloudWatch Log Group for Lambda
# Note: CloudWatch Logs service is not available in LocalStack Community Edition
# Commented out for LocalStack compatibility
# resource "aws_cloudwatch_log_group" "lambda" {
#   name              = "/aws/lambda/${var.lambda_function_name}"
#   retention_in_days = 7
#
#   tags = merge(var.tags, {
#     Name = "${var.project_name}-lambda-logs"
#   })
# }
