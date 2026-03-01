# =============================================================================
# LAMBDA PACKAGING
# =============================================================================
# Step 1: Run `terraform apply -target=null_resource.lambda_build` first
# Step 2: Then run `terraform apply` for the rest
# Or use: make setup (which does both automatically)

# Build and package Lambda function into a zip
resource "null_resource" "lambda_build" {
  provisioner "local-exec" {
    command     = <<-EOT
      set -e
      rm -rf ./lambda-build
      mkdir -p ./lambda-build

      # Copy only source code and package.json
      cp -r ${var.lambda_source_dir}/src ./lambda-build/src
      cp ${var.lambda_source_dir}/package.json ./lambda-build/package.json

      # Install production deps only
      cd ./lambda-build
      npm install --production --ignore-scripts 2>/dev/null

      # Remove heavy/unnecessary files to keep zip small
      find node_modules -type d \( -name "test" -o -name "tests" -o -name "__tests__" -o -name "docs" -o -name "example" -o -name "examples" \) -exec rm -rf {} + 2>/dev/null || true
      find node_modules -type f \( -name "*.md" -o -name "*.map" -o -name "*.ts" -o -name "LICENSE*" -o -name "CHANGELOG*" -o -name "*.d.ts" \) -delete 2>/dev/null || true
      rm -rf node_modules/onnxruntime-web 2>/dev/null || true
      rm -rf node_modules/onnxruntime-node 2>/dev/null || true
      rm -rf node_modules/sharp 2>/dev/null || true

      echo "=== Lambda build dir size ===" && du -sh .
    EOT
    interpreter = ["bash", "-c"]
  }

  triggers = {
    package_json = filemd5("${var.lambda_source_dir}/package.json")
    src_hash     = sha1(join("", [for f in fileset(var.lambda_source_dir, "src/**") : filemd5("${var.lambda_source_dir}/${f}")]))
  }
}

# Package Lambda from the clean build directory
data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda-build"
  output_path = "${path.module}/lambda-function.zip"

  depends_on = [null_resource.lambda_build]
}

# Upload Lambda zip to S3 (avoids OOM in 32-bit terraform provider
# when uploading large zip inline via CreateFunction API)
resource "aws_s3_object" "lambda_zip" {
  bucket = aws_s3_bucket.file_uploads.id
  key    = "lambda-packages/${var.lambda_function_name}.zip"
  source = data.archive_file.lambda.output_path
  etag   = data.archive_file.lambda.output_md5
}

# Lambda Function (deployed from S3 to avoid provider OOM)
resource "aws_lambda_function" "file_processor" {
  s3_bucket        = aws_s3_object.lambda_zip.bucket
  s3_key           = aws_s3_object.lambda_zip.key
  source_code_hash = data.archive_file.lambda.output_base64sha256
  function_name    = var.lambda_function_name
  role            = aws_iam_role.lambda_exec.arn
  handler         = "src/handler-markdown.handler"
  runtime         = "nodejs20.x"
  timeout         = var.lambda_timeout
  memory_size     = var.lambda_memory_size

  ephemeral_storage {
    size = var.lambda_ephemeral_storage
  }

  environment {
    variables = {
      AWS_ENDPOINT            = var.localstack_endpoint
      AWS_REGION             = var.aws_region
      AWS_ACCESS_KEY_ID      = var.aws_access_key
      AWS_SECRET_ACCESS_KEY  = var.aws_secret_key
      S3_BUCKET_NAME         = aws_s3_bucket.file_uploads.id
      ELASTICSEARCH_NODE     = var.elasticsearch_endpoint
      ELASTICSEARCH_INDEX    = var.opensearch_domain_name
      ELASTICSEARCH_USERNAME = "admin"
      ELASTICSEARCH_PASSWORD = "admin"
      OPENSEARCH_ENDPOINT    = aws_opensearch_domain.file_chunks.endpoint
      OPENSEARCH_DOMAIN      = aws_opensearch_domain.file_chunks.domain_name
      CHUNK_SIZE            = var.chunk_size
      CHUNK_OVERLAP         = var.chunk_overlap
      ENABLE_EMBEDDINGS     = var.enable_embeddings
      ENABLE_TMP_CACHE      = var.enable_tmp_cache
      TMP_CACHE_TTL         = var.tmp_cache_ttl
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
    null_resource.create_opensearch_index,
    aws_s3_object.lambda_zip
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
