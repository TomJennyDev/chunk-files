terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Configure AWS Provider for LocalStack
provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    sqs = "http://localhost:4566"
    kms = "http://localhost:4566"
    sns = "http://localhost:4566"
    iam = "http://localhost:4566"
  }
}

# Test 1: Basic Standard Queue
module "basic_queue" {
  source = "../../../modules/sqs"

  queue_name                 = "test-basic-queue"
  visibility_timeout_seconds = 30
  receive_wait_time_seconds  = 20

  tags = {
    Environment = "localstack"
    Lab         = "sqs"
    Test        = "basic"
  }
}

# Test 2: FIFO Queue with DLQ
module "fifo_queue" {
  source = "../../../modules/sqs"

  queue_name                  = "test-fifo-queue.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  
  create_dlq                    = true
  dlq_message_retention_seconds = 1209600

  visibility_timeout_seconds = 60
  message_retention_seconds  = 345600

  tags = {
    Environment = "localstack"
    Lab         = "sqs"
    Test        = "fifo"
  }
}

# Test 3: Queue with Custom Configuration
module "custom_queue" {
  source = "../../../modules/sqs"

  queue_name    = "test-custom-queue"
  delay_seconds = 10

  max_message_size           = 262144
  message_retention_seconds  = 86400
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 120

  tags = {
    Environment = "localstack"
    Lab         = "sqs"
    Test        = "custom-config"
  }
}

# Test 4: Queue with SNS Integration
resource "aws_sns_topic" "test_topic" {
  name = "test-sqs-topic"
}

module "sns_integration_queue" {
  source = "../../../modules/sqs"

  queue_name = "test-sns-queue"
  
  queue_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "sns.amazonaws.com"
      }
      Action = "sqs:SendMessage"
      Resource = "*"
      Condition = {
        ArnEquals = {
          "aws:SourceArn" = aws_sns_topic.test_topic.arn
        }
      }
    }]
  })

  tags = {
    Environment = "localstack"
    Lab         = "sqs"
    Test        = "sns-integration"
  }
}

resource "aws_sns_topic_subscription" "test_subscription" {
  topic_arn = aws_sns_topic.test_topic.arn
  protocol  = "sqs"
  endpoint  = module.sns_integration_queue.queue_arn
}

# Test 5: Queue with External DLQ
module "main_queue_with_external_dlq" {
  source = "../../../modules/sqs"

  queue_name = "test-main-queue"
  
  redrive_policy = {
    dead_letter_target_arn = module.external_dlq.queue_arn
    max_receive_count      = 3
  }

  visibility_timeout_seconds = 30

  tags = {
    Environment = "localstack"
    Lab         = "sqs"
    Test        = "external-dlq"
  }
}

module "external_dlq" {
  source = "../../../modules/sqs"

  queue_name                = "test-external-dlq"
  message_retention_seconds = 1209600

  tags = {
    Environment = "localstack"
    Lab         = "sqs"
    Test        = "dlq"
    Type        = "dead-letter-queue"
  }
}
