variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_access_key" {
  description = "AWS access key (use 'test' for LocalStack)"
  type        = string
  default     = "test"
}

variable "aws_secret_key" {
  description = "AWS secret key (use 'test' for LocalStack)"
  type        = string
  default     = "test"
  sensitive   = true
}

variable "localstack_endpoint" {
  description = "LocalStack endpoint URL"
  type        = string
  default     = "http://localhost:4566"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "file-processor"
}

variable "s3_bucket_name" {
  description = "S3 bucket name for file uploads"
  type        = string
  default     = "file-uploads"
}

variable "sqs_queue_name" {
  description = "SQS queue name for file processing"
  type        = string
  default     = "file-processing-queue"
}

variable "opensearch_domain_name" {
  description = "OpenSearch domain name"
  type        = string
  default     = "file-chunks"
}

variable "lambda_function_name" {
  description = "Lambda function name"
  type        = string
  default     = "file-processor-worker"
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 300
}

variable "lambda_memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 512
}

variable "lambda_batch_size" {
  description = "SQS batch size for Lambda trigger"
  type        = number
  default     = 5
}

variable "chunk_size" {
  description = "File chunk size in bytes"
  type        = number
  default     = 5242880 # 5MB
}

variable "chunk_overlap" {
  description = "Chunk overlap in bytes"
  type        = number
  default     = 100
}

variable "max_file_size" {
  description = "Maximum file upload size in bytes"
  type        = number
  default     = 524288000 # 500MB
}

variable "lambda_source_dir" {
  description = "Path to Lambda source code directory"
  type        = string
  default     = "../../file-processor-lambda"
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project     = "file-processor"
    ManagedBy   = "Terraform"
    Environment = "dev"
  }
}
