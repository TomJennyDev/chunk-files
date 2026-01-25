# File Processor Infrastructure - Terraform

Infrastructure as Code for File Processor application using Terraform and LocalStack.

## 📋 Prerequisites

- [Terraform](https://www.terraform.io/downloads.html) >= 1.0
- [AWS CLI](https://aws.amazon.com/cli/)
- [awscli-local](https://github.com/localstack/awscli-local) (recommended)
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)
- [jq](https://stedolan.github.io/jq/) (for JSON parsing)
- [Make](https://www.gnu.org/software/make/) (optional, for convenience)

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   NestJS    │────▶│   S3 Bucket │     │   Lambda     │
│   API       │     │  (uploads)  │     │   Worker     │
└─────────────┘     └─────────────┘     └──────────────┘
       │                                        ▲
       │                                        │
       ▼                                        │
┌─────────────┐                          ┌─────┴────────┐
│  SQS Queue  │─────────────────────────▶│ SQS Trigger  │
│  (messages) │                          └──────────────┘
└─────────────┘                                 │
       │                                        │
       ▼                                        ▼
┌─────────────┐                          ┌──────────────┐
│  SQS DLQ    │                          │  OpenSearch  │
│  (failed)   │                          │   (index)    │
└─────────────┘                          └──────────────┘
```

## 📁 Project Structure

```
terraform/file-processor/
├── providers.tf           # Provider configuration (LocalStack)
├── variables.tf          # Input variables
├── terraform.tfvars      # Variable values
├── main.tf              # S3, SQS, CloudWatch resources
├── iam.tf               # IAM roles and policies
├── lambda.tf            # Lambda function and triggers
├── outputs.tf           # Output values
├── Makefile            # Convenience commands
├── .gitignore          # Git ignore patterns
└── README.md           # This file
```

## 🚀 Quick Start

### 1. Start LocalStack

```bash
# From localstack root directory
cd ../..
docker-compose up -d localstack

# Verify it's running
curl http://localhost:4566/_localstack/health
```

### 2. Initialize Terraform

```bash
# Using Make
make init

# Or directly
terraform init
```

### 3. Review Plan

```bash
make plan
# or
terraform plan
```

### 4. Apply Infrastructure

```bash
make apply
# or
terraform apply -auto-approve
```

### 5. Verify Resources

```bash
make status
# or manually:
awslocal s3 ls
awslocal sqs list-queues
awslocal lambda list-functions
```

## 🛠️ Make Commands

```bash
# Setup
make help              # Show all available commands
make init             # Initialize Terraform
make plan             # Create execution plan
make apply            # Apply changes
make destroy          # Destroy all resources

# Testing
make test-s3          # Test S3 bucket
make test-sqs         # Test SQS queue
make test-lambda      # Test Lambda function
make test-all         # Run all tests

# Lambda Operations
make lambda-invoke    # Invoke Lambda function
make lambda-logs      # View Lambda logs
make lambda-package   # Package Lambda manually

# SQS Operations
make sqs-send         # Send test message
make sqs-receive      # Receive messages
make sqs-purge        # Purge queue

# Monitoring
make status           # Show resource status
make logs             # View logs
make output           # Show Terraform outputs

# Complete Workflows
make setup            # LocalStack + Terraform setup
make teardown         # Complete teardown
```

## 📝 Resources Created

### S3 Bucket
- **Name**: `file-uploads`
- **Features**:
  - Versioning enabled
  - Lifecycle rules (cleanup old versions, expire after 90 days)
  - CORS configuration
  - Used for storing uploaded files

### SQS Queues
1. **Main Queue**: `file-processing-queue`
   - Long polling (20s)
   - Message retention: 14 days
   - Visibility timeout: 1800s (30 min)
   - Dead letter queue configured

2. **Dead Letter Queue**: `file-processing-queue-dlq`
   - Receives failed messages after 3 retries
   - Message retention: 14 days

### Lambda Function
- **Name**: `file-processor-worker`
- **Runtime**: Node.js 20.x
- **Memory**: 512 MB
- **Timeout**: 300 seconds (5 min)
- **Trigger**: SQS (batch size: 5)
- **Features**:
  - Partial batch failure reporting
  - CloudWatch Logs integration
  - Function URL for direct invocation

### IAM Role & Policies
- **Role**: `file-processor-worker-execution-role`
- **Permissions**:
  - S3: Read/Write to uploads bucket
  - SQS: Receive/Delete messages
  - CloudWatch: Write logs
  - OpenSearch: Full access for indexing

### CloudWatch Logs
- **Log Group**: `/aws/lambda/file-processor-worker`
- **Retention**: 7 days

## 🔧 Configuration

### Variables (terraform.tfvars)

Key variables you can customize:

```hcl
# Environment
environment = "dev"
project_name = "file-processor"

# Lambda
lambda_timeout = 300        # seconds
lambda_memory_size = 512    # MB
lambda_batch_size = 5       # messages

# File Processing
chunk_size = 5242880        # 5MB
chunk_overlap = 100         # bytes
max_file_size = 524288000   # 500MB

# Paths
lambda_source_dir = "../../file-processor-lambda"
```

### Environment Variables (Lambda)

Automatically configured:
- `AWS_ENDPOINT`: LocalStack endpoint
- `S3_BUCKET_NAME`: S3 bucket name
- `ELASTICSEARCH_NODE`: OpenSearch endpoint
- `CHUNK_SIZE`: File chunk size
- `CHUNK_OVERLAP`: Overlap between chunks

## 🧪 Testing

### Test S3 Bucket

```bash
# List bucket
awslocal s3 ls s3://file-uploads

# Upload test file
echo "test content" > test.txt
awslocal s3 cp test.txt s3://file-uploads/test.txt

# Download file
awslocal s3 cp s3://file-uploads/test.txt downloaded.txt
```

### Test SQS Queue

```bash
# Send message
awslocal sqs send-message \
  --queue-url http://localhost:4566/000000000000/file-processing-queue \
  --message-body '{"fileId":"test-123","s3Key":"test.txt","fileName":"test.txt","fileSize":100,"contentType":"text/plain"}'

# Receive messages
awslocal sqs receive-message \
  --queue-url http://localhost:4566/000000000000/file-processing-queue

# Get queue attributes
awslocal sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/file-processing-queue \
  --attribute-names All
```

### Test Lambda Function

```bash
# Invoke directly
awslocal lambda invoke \
  --function-name file-processor-worker \
  --payload '{"Records":[{"messageId":"test","body":"{\"fileId\":\"test-123\",\"s3Key\":\"test.txt\",\"fileName\":\"test.txt\",\"fileSize\":1000,\"contentType\":\"text/plain\"}"}]}' \
  response.json

# View logs
awslocal logs tail /aws/lambda/file-processor-worker --follow

# Check function configuration
awslocal lambda get-function-configuration \
  --function-name file-processor-worker
```

### Test End-to-End

```bash
# 1. Start API
cd ../../file-processor
pnpm run start:dev

# 2. Upload file (in another terminal)
curl -X POST http://localhost:3000/files/upload \
  -F "file=@test.txt"

# 3. Check SQS queue
awslocal sqs receive-message \
  --queue-url http://localhost:4566/000000000000/file-processing-queue

# 4. Lambda should auto-trigger and process
# View logs to verify
awslocal logs tail /aws/lambda/file-processor-worker
```

## 📊 Outputs

After `terraform apply`, outputs include:

```bash
terraform output

# Key outputs:
s3_bucket_name          # file-uploads
sqs_queue_url          # http://localhost:4566/000000000000/file-processing-queue
lambda_function_name   # file-processor-worker
lambda_function_url    # Direct invocation URL
cloudwatch_log_group   # /aws/lambda/file-processor-worker
```

## 🔄 Updates

### Update Lambda Code

```bash
# Terraform will detect code changes
make plan
make apply

# Or manually update
cd ../../file-processor-lambda
npm install
cd ../../terraform/file-processor
make apply
```

### Update Configuration

```bash
# Edit terraform.tfvars
vim terraform.tfvars

# Apply changes
make plan
make apply
```

## 🗑️ Cleanup

### Destroy Resources

```bash
make destroy
# or
terraform destroy -auto-approve
```

### Complete Teardown

```bash
# Destroy Terraform resources + stop LocalStack
make teardown
```

## 🐛 Troubleshooting

### Terraform init fails
```bash
# Clean and reinitialize
make clean
make init
```

### Lambda not triggering
```bash
# Check event source mapping
awslocal lambda list-event-source-mappings \
  --function-name file-processor-worker

# Check SQS permissions
awslocal sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/file-processing-queue \
  --attribute-names Policy
```

### Lambda fails with permissions
```bash
# Check IAM role
awslocal iam get-role \
  --role-name file-processor-worker-execution-role

# Check attached policies
awslocal iam list-attached-role-policies \
  --role-name file-processor-worker-execution-role
```

### Can't find resources
```bash
# List all resources in state
terraform state list

# Refresh state
terraform refresh
```

## 🚀 Production Deployment

For AWS (not LocalStack):

1. **Remove LocalStack endpoints** in `providers.tf`:
```hcl
provider "aws" {
  region = var.aws_region
  # Remove all endpoints block
}
```

2. **Update variables**:
```hcl
localstack_endpoint = ""  # Empty for AWS
aws_access_key = "YOUR_KEY"
aws_secret_key = "YOUR_SECRET"
```

3. **Add S3 backend** for state:
```hcl
terraform {
  backend "s3" {
    bucket = "terraform-state-bucket"
    key    = "file-processor/terraform.tfstate"
    region = "us-east-1"
  }
}
```

4. **Apply**:
```bash
terraform init -reconfigure
terraform plan
terraform apply
```

## 📚 References

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [LocalStack Documentation](https://docs.localstack.cloud/)
- [AWS Lambda with SQS](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)

## 🤝 Contributing

1. Make changes in feature branch
2. Test with `make test-all`
3. Format code with `make fmt`
4. Validate with `make validate`
5. Submit PR

## 📄 License

MIT
