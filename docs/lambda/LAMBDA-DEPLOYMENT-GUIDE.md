# AWS Lambda - Deployment & CI/CD Guide

Hướng dẫn chi tiết về cách triển khai và deploy Lambda functions từ development đến production.

## 📚 Mục Lục

1. [Deployment Methods](#deployment-methods)
2. [Versioning & Aliases](#versioning--aliases)
3. [CI/CD Pipelines](#cicd-pipelines)
4. [Deployment Strategies](#deployment-strategies)
5. [Infrastructure as Code](#infrastructure-as-code)
6. [Testing & Validation](#testing--validation)
7. [Rollback Strategies](#rollback-strategies)
8. [Best Practices](#best-practices)

---

## 🚀 Deployment Methods

### 1. AWS Console (Manual Deployment)

**Use case**: Development, testing, quick fixes

**Steps**:
```
1. Open Lambda Console → Functions → Your function
2. Code tab → Upload from:
   • .zip file (< 50MB)
   • Amazon S3 (for larger packages)
   • Container image
3. Click "Deploy"
4. Test with test events
```

**Pros**:
- ✅ Quick and easy for testing
- ✅ No CLI/tools needed
- ✅ Good for learning

**Cons**:
- ❌ Not reproducible
- ❌ Manual process (error-prone)
- ❌ No version control
- ❌ Not suitable for production

---

### 2. AWS CLI

**Use case**: Scripted deployments, automation

**Create Function**:
```bash
# Package code
zip -r function.zip handler.js node_modules/

# Create function
aws lambda create-function \
  --function-name my-function \
  --runtime nodejs20.x \
  --handler handler.handler \
  --role arn:aws:iam::123456789012:role/lambda-role \
  --zip-file fileb://function.zip \
  --memory-size 512 \
  --timeout 30 \
  --environment Variables="{NODE_ENV=production,LOG_LEVEL=info}"
```

**Update Function Code**:
```bash
# Update code only
aws lambda update-function-code \
  --function-name my-function \
  --zip-file fileb://function.zip

# Wait for update to complete
aws lambda wait function-updated \
  --function-name my-function

# Verify deployment
aws lambda get-function \
  --function-name my-function \
  --query 'Configuration.LastModified'
```

**Update Configuration**:
```bash
# Update memory/timeout
aws lambda update-function-configuration \
  --function-name my-function \
  --memory-size 1024 \
  --timeout 60 \
  --environment Variables="{NODE_ENV=production,DB_HOST=prod-db.example.com}"
```

**Pros**:
- ✅ Scriptable
- ✅ Fast updates
- ✅ Good for CI/CD

**Cons**:
- ❌ Manual resource management
- ❌ No dependency tracking
- ❌ Requires separate IAM setup

---

### 3. AWS SAM (Serverless Application Model)

**Use case**: Serverless applications, local testing

**Project Structure**:
```
my-app/
├── template.yaml          # SAM template
├── src/
│   └── handlers/
│       ├── api.js
│       └── processor.js
├── tests/
├── package.json
└── samconfig.toml
```

**SAM Template** (`template.yaml`):
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: File Processing Application

Globals:
  Function:
    Runtime: nodejs20.x
    Timeout: 30
    MemorySize: 512
    Environment:
      Variables:
        NODE_ENV: production

Resources:
  # Lambda Function
  FileProcessorFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: file-processor
      CodeUri: src/handlers/
      Handler: processor.handler
      Description: Process files from S3
      MemorySize: 1024
      Timeout: 300
      
      # Ephemeral storage
      EphemeralStorage:
        Size: 2048
      
      # IAM permissions
      Policies:
        - S3ReadPolicy:
            BucketName: !Ref FileBucket
        - SQSPollerPolicy:
            QueueName: !GetAtt FileQueue.QueueName
      
      # Event source
      Events:
        SQSEvent:
          Type: SQS
          Properties:
            Queue: !GetAtt FileQueue.Arn
            BatchSize: 10
      
      # Environment variables
      Environment:
        Variables:
          BUCKET_NAME: !Ref FileBucket
          ELASTICSEARCH_NODE: !GetAtt ESDomain.DomainEndpoint

  # API Function
  ApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: file-api
      CodeUri: src/handlers/
      Handler: api.handler
      Events:
        ApiEvent:
          Type: Api
          Properties:
            Path: /files
            Method: post
            Auth:
              ApiKeyRequired: true

  # S3 Bucket
  FileBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub '${AWS::StackName}-files'
      VersioningConfiguration:
        Status: Enabled

  # SQS Queue
  FileQueue:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: file-processing-queue
      VisibilityTimeout: 360
      MessageRetentionPeriod: 345600

Outputs:
  ApiUrl:
    Description: API Gateway URL
    Value: !Sub 'https://${ServerlessRestApi}.execute-api.${AWS::Region}.amazonaws.com/Prod/'
  
  FunctionArn:
    Description: Lambda Function ARN
    Value: !GetAtt FileProcessorFunction.Arn
```

**Deployment Commands**:
```bash
# Build (download dependencies)
sam build

# Local testing
sam local invoke FileProcessorFunction -e events/test-event.json
sam local start-api  # Test API locally

# Validate template
sam validate

# Deploy to AWS
sam deploy \
  --stack-name file-processor-app \
  --capabilities CAPABILITY_IAM \
  --region us-east-1 \
  --confirm-changeset

# Or use guided deploy
sam deploy --guided
```

**Pros**:
- ✅ Local testing with `sam local`
- ✅ Automatic IAM role creation
- ✅ Event source mapping
- ✅ CloudFormation integration
- ✅ Built-in best practices

**Cons**:
- ⚠️ Learning curve
- ⚠️ CloudFormation limitations
- ⚠️ Slower than direct deploy

---

### 4. Terraform

**Use case**: Multi-cloud, existing Terraform infrastructure

**Project Structure**:
```
terraform/
├── main.tf
├── lambda.tf
├── iam.tf
├── s3.tf
├── variables.tf
├── outputs.tf
└── modules/
    └── lambda/
        ├── main.tf
        ├── variables.tf
        └── outputs.tf
```

**Lambda Configuration** (`lambda.tf`):
```hcl
# Package Lambda code
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../src"
  output_path = "${path.module}/builds/function.zip"
  
  excludes = [
    "node_modules",
    "tests",
    "*.test.js"
  ]
}

# Lambda Function
resource "aws_lambda_function" "processor" {
  function_name = "file-processor"
  description   = "Process files from S3 and index to Elasticsearch"
  
  # Code
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  
  # Runtime
  runtime = "nodejs20.x"
  handler = "handlers/processor.handler"
  
  # Execution role
  role = aws_iam_role.lambda_role.arn
  
  # Resources
  memory_size = 1024
  timeout     = 300
  
  # Ephemeral storage
  ephemeral_storage {
    size = 2048  # 2GB
  }
  
  # Environment
  environment {
    variables = {
      NODE_ENV           = var.environment
      BUCKET_NAME        = aws_s3_bucket.files.id
      ELASTICSEARCH_NODE = aws_elasticsearch_domain.main.endpoint
      LOG_LEVEL          = "info"
      ENABLE_TMP_CACHE   = "true"
      TMP_CACHE_TTL      = "3600"
    }
  }
  
  # VPC configuration (if needed)
  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda_sg.id]
  }
  
  # Reserved concurrency (optional)
  reserved_concurrent_executions = 100
  
  # Dead letter queue
  dead_letter_config {
    target_arn = aws_sqs_queue.dlq.arn
  }
  
  # Tracing
  tracing_config {
    mode = "Active"  # X-Ray
  }
  
  # Tags
  tags = {
    Name        = "file-processor"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
  
  # Lifecycle
  lifecycle {
    create_before_destroy = true
  }
}

# Lambda Layer (for heavy dependencies)
resource "aws_lambda_layer_version" "dependencies" {
  layer_name          = "file-processor-deps"
  filename            = "${path.module}/builds/layer.zip"
  source_code_hash    = filebase64sha256("${path.module}/builds/layer.zip")
  compatible_runtimes = ["nodejs20.x", "nodejs18.x"]
  
  description = "Heavy dependencies: pdf-parse, sharp"
}

# Event Source Mapping - SQS
resource "aws_lambda_event_source_mapping" "sqs" {
  event_source_arn = aws_sqs_queue.files.arn
  function_name    = aws_lambda_function.processor.arn
  
  batch_size                         = 10
  maximum_batching_window_in_seconds = 5
  
  # Error handling
  function_response_types = ["ReportBatchItemFailures"]
  
  # Scaling
  scaling_config {
    maximum_concurrency = 100
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.processor.function_name}"
  retention_in_days = 7
  
  tags = {
    Name = "file-processor-logs"
  }
}

# Lambda Permission for S3
resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowExecutionFromS3"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.processor.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.files.arn
}
```

**IAM Role** (`iam.tf`):
```hcl
# Lambda execution role
resource "aws_iam_role" "lambda_role" {
  name = "file-processor-lambda-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# Attach policies
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Custom policy
resource "aws_iam_role_policy" "lambda_policy" {
  name = "file-processor-policy"
  role = aws_iam_role.lambda_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.files.arn,
          "${aws_s3_bucket.files.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.files.arn
      },
      {
        Effect = "Allow"
        Action = [
          "es:ESHttpPost",
          "es:ESHttpPut"
        ]
        Resource = "${aws_elasticsearch_domain.main.arn}/*"
      }
    ]
  })
}
```

**Deployment**:
```bash
# Initialize
terraform init

# Plan changes
terraform plan -out=tfplan

# Apply changes
terraform apply tfplan

# Destroy (cleanup)
terraform destroy
```

**Pros**:
- ✅ Infrastructure as Code
- ✅ State management
- ✅ Multi-cloud support
- ✅ Modular & reusable
- ✅ Dependency management

**Cons**:
- ⚠️ Requires state management
- ⚠️ No local testing
- ⚠️ More verbose than SAM

---

### 5. Container Image Deployment

**Use case**: Large dependencies (>250MB), custom runtimes

**Dockerfile**:
```dockerfile
# Use AWS Lambda base image
FROM public.ecr.aws/lambda/nodejs:20

# Install system dependencies (if needed)
RUN yum install -y \
    cairo-devel \
    pango-devel \
    && yum clean all

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy function code
COPY src/ ./src/
COPY handler.js ./

# Set the CMD to handler
CMD [ "handler.handler" ]
```

**Build & Push**:
```bash
# Build image
docker build -t file-processor:latest .

# Tag for ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

docker tag file-processor:latest \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/file-processor:latest

# Push to ECR
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/file-processor:latest

# Create/Update Lambda function
aws lambda create-function \
  --function-name file-processor \
  --package-type Image \
  --code ImageUri=123456789012.dkr.ecr.us-east-1.amazonaws.com/file-processor:latest \
  --role arn:aws:iam::123456789012:role/lambda-role
```

**Pros**:
- ✅ Support large packages (10GB)
- ✅ Custom OS libraries
- ✅ Consistent with container workflows
- ✅ Version control via image tags

**Cons**:
- ⚠️ Slower cold starts
- ⚠️ ECR storage costs
- ⚠️ More complex build process

---

## 🏷️ Versioning & Aliases

### Lambda Versions

**Concept**: Mỗi lần publish tạo ra version **immutable** mới.

**Publish Version**:
```bash
# Publish new version
aws lambda publish-version \
  --function-name file-processor \
  --description "Added caching layer"

# Output: Version 5 (ARN includes version)
# arn:aws:lambda:us-east-1:123456789012:function:file-processor:5
```

**Version Characteristics**:
- Immutable (không thể thay đổi code/config)
- `$LATEST` = unpublished version (mutable)
- Numbered versions: 1, 2, 3... (immutable)
- Each version has unique ARN

### Lambda Aliases

**Concept**: Pointer có thể update được, trỏ đến specific version.

**Create Alias**:
```bash
# Create "prod" alias pointing to version 5
aws lambda create-alias \
  --function-name file-processor \
  --name prod \
  --function-version 5 \
  --description "Production environment"

# Create "staging" alias
aws lambda create-alias \
  --function-name file-processor \
  --name staging \
  --function-version 4
```

**Update Alias** (for deployment):
```bash
# Update prod to version 6
aws lambda update-alias \
  --function-name file-processor \
  --name prod \
  --function-version 6
```

**Weighted Aliases** (Traffic Shifting):
```bash
# Route 90% to v5, 10% to v6 (canary)
aws lambda update-alias \
  --function-name file-processor \
  --name prod \
  --function-version 6 \
  --routing-config AdditionalVersionWeights={5=0.9}
```

### Version Management Strategy

```
Development Flow:
┌──────────────────────────────────────────────────────┐
│ 1. Dev → Update $LATEST                             │
│ 2. Test → Run integration tests                     │
│ 3. Publish → Create version N                       │
│ 4. Update "dev" alias → version N                   │
│ 5. QA Testing on "dev" alias                        │
│ 6. Update "staging" alias → version N               │
│ 7. Staging validation                                │
│ 8. Update "prod" alias → version N (with weights)   │
│ 9. Monitor metrics                                   │
│10. Shift 100% traffic or rollback                   │
└──────────────────────────────────────────────────────┘
```

**Terraform Example**:
```hcl
# Publish version after code change
resource "aws_lambda_function" "main" {
  # ... function config
  
  publish = true  # Auto-publish version on update
}

# Aliases
resource "aws_lambda_alias" "prod" {
  name             = "prod"
  function_name    = aws_lambda_function.main.function_name
  function_version = aws_lambda_function.main.version
  
  # Traffic shifting
  routing_config {
    additional_version_weights = {
      "${aws_lambda_function.main.version - 1}" = 0.1  # 10% to old version
    }
  }
}

resource "aws_lambda_alias" "staging" {
  name             = "staging"
  function_name    = aws_lambda_function.main.function_name
  function_version = "$LATEST"
}
```

---

## 🔄 CI/CD Pipelines

### GitHub Actions

**Workflow** (`.github/workflows/deploy.yml`):
```yaml
name: Deploy Lambda Function

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'package*.json'
  pull_request:
    branches: [main]

env:
  AWS_REGION: us-east-1
  FUNCTION_NAME: file-processor

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Run linter
        run: npm run lint

  deploy-staging:
    needs: test
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Install dependencies
        run: npm ci --only=production
      
      - name: Package Lambda
        run: zip -r function.zip . -x "*.git*" "tests/*" "*.test.js"
      
      - name: Deploy to staging
        run: |
          aws lambda update-function-code \
            --function-name ${{ env.FUNCTION_NAME }} \
            --zip-file fileb://function.zip
          
          # Wait for update
          aws lambda wait function-updated \
            --function-name ${{ env.FUNCTION_NAME }}
          
          # Update staging alias
          VERSION=$(aws lambda publish-version \
            --function-name ${{ env.FUNCTION_NAME }} \
            --description "PR #${{ github.event.pull_request.number }}" \
            --query 'Version' --output text)
          
          aws lambda update-alias \
            --function-name ${{ env.FUNCTION_NAME }} \
            --name staging \
            --function-version $VERSION

  deploy-production:
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://api.example.com
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Install dependencies
        run: npm ci --only=production
      
      - name: Package Lambda
        run: |
          # Remove dev dependencies
          rm -rf node_modules
          npm ci --only=production
          
          # Create deployment package
          zip -r function.zip . \
            -x "*.git*" "tests/*" "*.test.js" ".env*" "*.md"
      
      - name: Deploy to production
        run: |
          # Update code
          aws lambda update-function-code \
            --function-name ${{ env.FUNCTION_NAME }} \
            --zip-file fileb://function.zip
          
          # Wait for update
          aws lambda wait function-updated \
            --function-name ${{ env.FUNCTION_NAME }}
          
          # Publish new version
          NEW_VERSION=$(aws lambda publish-version \
            --function-name ${{ env.FUNCTION_NAME }} \
            --description "Deployed from commit ${{ github.sha }}" \
            --query 'Version' --output text)
          
          echo "Published version: $NEW_VERSION"
          
          # Get current prod version
          CURRENT_VERSION=$(aws lambda get-alias \
            --function-name ${{ env.FUNCTION_NAME }} \
            --name prod \
            --query 'FunctionVersion' --output text)
          
          echo "Current prod version: $CURRENT_VERSION"
          
          # Canary deployment: 10% traffic to new version
          aws lambda update-alias \
            --function-name ${{ env.FUNCTION_NAME }} \
            --name prod \
            --function-version $NEW_VERSION \
            --routing-config "AdditionalVersionWeights={$CURRENT_VERSION=0.9}"
          
          echo "✅ Deployed version $NEW_VERSION with 10% traffic"
          echo "::notice::Monitor metrics for 10 minutes before full rollout"
      
      - name: Monitor canary (optional)
        run: |
          echo "Sleeping 10 minutes to monitor canary..."
          sleep 600
          
          # Check error rate
          ERROR_RATE=$(aws cloudwatch get-metric-statistics \
            --namespace AWS/Lambda \
            --metric-name Errors \
            --dimensions Name=FunctionName,Value=${{ env.FUNCTION_NAME }} \
            --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
            --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
            --period 600 \
            --statistics Sum \
            --query 'Datapoints[0].Sum' --output text)
          
          if [ "$ERROR_RATE" == "None" ]; then
            ERROR_RATE=0
          fi
          
          if [ "$ERROR_RATE" -gt 10 ]; then
            echo "::error::High error rate detected: $ERROR_RATE errors"
            exit 1
          fi
          
          echo "✅ Canary successful - Error rate: $ERROR_RATE"
      
      - name: Full rollout
        if: success()
        run: |
          # Shift 100% traffic to new version
          NEW_VERSION=$(aws lambda get-alias \
            --function-name ${{ env.FUNCTION_NAME }} \
            --name prod \
            --query 'FunctionVersion' --output text)
          
          aws lambda update-alias \
            --function-name ${{ env.FUNCTION_NAME }} \
            --name prod \
            --function-version $NEW_VERSION \
            --routing-config '{}'
          
          echo "✅ Full rollout complete to version $NEW_VERSION"
```

### GitLab CI/CD

**Pipeline** (`.gitlab-ci.yml`):
```yaml
stages:
  - test
  - build
  - deploy-staging
  - deploy-production

variables:
  AWS_REGION: us-east-1
  FUNCTION_NAME: file-processor

# Test stage
test:unit:
  stage: test
  image: node:20
  cache:
    paths:
      - node_modules/
  before_script:
    - npm ci
  script:
    - npm run test
    - npm run lint
  coverage: '/Statements\s*:\s*(\d+\.?\d*)%/'
  artifacts:
    reports:
      junit: junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

# Build stage
build:package:
  stage: build
  image: node:20
  script:
    - npm ci --only=production
    - zip -r function.zip . -x "*.git*" "tests/*" "*.test.js"
  artifacts:
    paths:
      - function.zip
    expire_in: 1 week

# Deploy to staging
deploy:staging:
  stage: deploy-staging
  image: amazon/aws-cli:latest
  dependencies:
    - build:package
  before_script:
    - export AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
    - export AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
  script:
    - |
      aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://function.zip \
        --region $AWS_REGION
      
      aws lambda wait function-updated \
        --function-name $FUNCTION_NAME \
        --region $AWS_REGION
      
      VERSION=$(aws lambda publish-version \
        --function-name $FUNCTION_NAME \
        --description "Pipeline $CI_PIPELINE_ID" \
        --region $AWS_REGION \
        --query 'Version' --output text)
      
      aws lambda update-alias \
        --function-name $FUNCTION_NAME \
        --name staging \
        --function-version $VERSION \
        --region $AWS_REGION
  environment:
    name: staging
    url: https://staging-api.example.com
  only:
    - merge_requests

# Deploy to production
deploy:production:
  stage: deploy-production
  image: amazon/aws-cli:latest
  dependencies:
    - build:package
  before_script:
    - export AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
    - export AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
  script:
    - |
      # Deploy new version
      aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://function.zip \
        --region $AWS_REGION
      
      aws lambda wait function-updated \
        --function-name $FUNCTION_NAME \
        --region $AWS_REGION
      
      # Publish version
      NEW_VERSION=$(aws lambda publish-version \
        --function-name $FUNCTION_NAME \
        --description "Production deploy from commit $CI_COMMIT_SHORT_SHA" \
        --region $AWS_REGION \
        --query 'Version' --output text)
      
      # Canary: 10% traffic
      CURRENT_VERSION=$(aws lambda get-alias \
        --function-name $FUNCTION_NAME \
        --name prod \
        --region $AWS_REGION \
        --query 'FunctionVersion' --output text)
      
      aws lambda update-alias \
        --function-name $FUNCTION_NAME \
        --name prod \
        --function-version $NEW_VERSION \
        --routing-config "AdditionalVersionWeights={$CURRENT_VERSION=0.9}" \
        --region $AWS_REGION
      
      echo "Deployed version $NEW_VERSION with 10% traffic"
  environment:
    name: production
    url: https://api.example.com
    on_stop: rollback:production
  when: manual
  only:
    - main

# Rollback production
rollback:production:
  stage: deploy-production
  image: amazon/aws-cli:latest
  script:
    - |
      # Get previous version
      CURRENT_VERSION=$(aws lambda get-alias \
        --function-name $FUNCTION_NAME \
        --name prod \
        --region $AWS_REGION \
        --query 'FunctionVersion' --output text)
      
      PREVIOUS_VERSION=$((CURRENT_VERSION - 1))
      
      # Rollback to previous version
      aws lambda update-alias \
        --function-name $FUNCTION_NAME \
        --name prod \
        --function-version $PREVIOUS_VERSION \
        --routing-config '{}' \
        --region $AWS_REGION
      
      echo "Rolled back to version $PREVIOUS_VERSION"
  environment:
    name: production
    action: stop
  when: manual
```

---

## 🎯 Deployment Strategies

### 1. All-at-Once (Basic Deployment)

**Description**: Update function code/config trực tiếp, tất cả traffic chuyển sang version mới ngay lập tức.

**Use case**: Development, low-risk updates

**Flow**:
```
Old Version (v1) → Update Code → New Version (v2)
100% traffic     →     🔄      → 100% traffic
```

**Implementation**:
```bash
aws lambda update-function-code \
  --function-name my-function \
  --zip-file fileb://function.zip
```

**Pros**:
- ✅ Simple, fast
- ✅ No additional cost

**Cons**:
- ❌ All users affected immediately
- ❌ No gradual rollout
- ❌ Risky for production

### 2. Blue/Green Deployment

**Description**: Maintain 2 versions, switch traffic từ old (Blue) sang new (Green).

**Use case**: Production deployments với zero downtime

**Flow**:
```
Step 1: Blue (v1) active
  ├─ 100% traffic

Step 2: Deploy Green (v2)
  ├─ Blue: 100% traffic
  └─ Green: 0% traffic (ready)

Step 3: Switch traffic
  ├─ Blue: 0% traffic
  └─ Green: 100% traffic

Step 4: Cleanup Blue (optional)
```

**Implementation với Aliases**:
```bash
# Current state: prod alias → v1
aws lambda get-alias --function-name my-function --name prod
# FunctionVersion: 1

# Deploy v2
aws lambda update-function-code --function-name my-function --zip-file fileb://new.zip
aws lambda publish-version --function-name my-function  # v2

# Test v2
aws lambda invoke --function-name my-function:2 --payload '{}' out.json

# Switch prod alias to v2 (instant cutover)
aws lambda update-alias \
  --function-name my-function \
  --name prod \
  --function-version 2

# Rollback if needed
aws lambda update-alias \
  --function-name my-function \
  --name prod \
  --function-version 1
```

**Pros**:
- ✅ Zero downtime
- ✅ Instant rollback
- ✅ Test new version before cutover

**Cons**:
- ⚠️ Sudden change for all users
- ⚠️ Requires careful testing

### 3. Canary Deployment

**Description**: Gradually shift traffic từ old → new version (e.g., 10% → 50% → 100%).

**Use case**: Risk mitigation, production releases

**Flow**:
```
Step 1: 10% traffic to v2
  ├─ v1: 90%
  └─ v2: 10%  ← Monitor metrics

Step 2: 50% traffic to v2 (if OK)
  ├─ v1: 50%
  └─ v2: 50%

Step 3: 100% to v2
  └─ v2: 100%
```

**Implementation**:
```bash
# Deploy v2
aws lambda update-function-code --function-name my-function --zip-file fileb://new.zip
NEW_VERSION=$(aws lambda publish-version --function-name my-function --query 'Version' --output text)

# Canary: 10% to v2, 90% to v1
aws lambda update-alias \
  --function-name my-function \
  --name prod \
  --function-version $NEW_VERSION \
  --routing-config "AdditionalVersionWeights={1=0.9}"

# Monitor for 10 minutes...
# If metrics OK, increase to 50%
aws lambda update-alias \
  --function-name my-function \
  --name prod \
  --function-version $NEW_VERSION \
  --routing-config "AdditionalVersionWeights={1=0.5}"

# Final rollout: 100% to v2
aws lambda update-alias \
  --function-name my-function \
  --name prod \
  --function-version $NEW_VERSION \
  --routing-config '{}'
```

**Monitoring Script**:
```bash
#!/bin/bash
# monitor-canary.sh

FUNCTION_NAME="my-function"
ALIAS_NAME="prod"

echo "Monitoring canary deployment..."

for i in {1..10}; do
  echo "Check $i/10..."
  
  # Get error rate
  ERROR_RATE=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Errors \
    --dimensions Name=FunctionName,Value=$FUNCTION_NAME Name=Resource,Value=$FUNCTION_NAME:$ALIAS_NAME \
    --start-time $(date -u -d '1 minute ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 60 \
    --statistics Sum \
    --query 'Datapoints[0].Sum' --output text)
  
  # Get duration
  DURATION=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Duration \
    --dimensions Name=FunctionName,Value=$FUNCTION_NAME Name=Resource,Value=$FUNCTION_NAME:$ALIAS_NAME \
    --start-time $(date -u -d '1 minute ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 60 \
    --statistics Average \
    --query 'Datapoints[0].Average' --output text)
  
  echo "  Errors: ${ERROR_RATE:-0}"
  echo "  Avg Duration: ${DURATION:-0}ms"
  
  # Alert if error rate > threshold
  if (( $(echo "$ERROR_RATE > 10" | bc -l) )); then
    echo "❌ High error rate detected!"
    echo "Rolling back..."
    # Rollback logic here
    exit 1
  fi
  
  sleep 60
done

echo "✅ Canary validation successful"
```

**Pros**:
- ✅ Gradual rollout
- ✅ Risk mitigation
- ✅ Early detection of issues

**Cons**:
- ⚠️ Longer deployment time
- ⚠️ Requires monitoring
- ⚠️ Complex rollback

### 4. Linear Deployment

**Description**: Increase traffic theo fixed increments (e.g., +10% every 10 minutes).

**Use case**: Automated gradual rollouts

**AWS CodeDeploy Configuration**:
```yaml
# appspec.yml
version: 0.0
Resources:
  - MyFunction:
      Type: AWS::Lambda::Function
      Properties:
        Name: "my-function"
        Alias: "prod"
        CurrentVersion: "1"
        TargetVersion: "2"
Hooks:
  - BeforeAllowTraffic: "PreTrafficHook"
  - AfterAllowTraffic: "PostTrafficHook"
```

**CodeDeploy Deployment Config**:
```bash
# Linear10PercentEvery10Minutes
aws deploy create-deployment \
  --application-name my-lambda-app \
  --deployment-group-name prod \
  --deployment-config-name CodeDeployDefault.LambdaLinear10PercentEvery10Minutes \
  --description "Gradual rollout v2"

# Other options:
# - CodeDeployDefault.LambdaLinear10PercentEvery1Minute
# - CodeDeployDefault.LambdaLinear10PercentEvery2Minutes
# - CodeDeployDefault.LambdaLinear10PercentEvery3Minutes
# - CodeDeployDefault.LambdaCanary10Percent5Minutes (10% then 90%)
# - CodeDeployDefault.LambdaCanary10Percent10Minutes
# - CodeDeployDefault.LambdaAllAtOnce
```

**Pros**:
- ✅ Automated rollout
- ✅ Predictable timeline
- ✅ Built-in rollback

**Cons**:
- ⚠️ Requires CodeDeploy setup
- ⚠️ Less flexible than manual canary

---

## 🛠️ Infrastructure as Code

### AWS SAM Template (Full Example)

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Parameters:
  Environment:
    Type: String
    Default: dev
    AllowedValues:
      - dev
      - staging
      - prod
  
  LogRetentionDays:
    Type: Number
    Default: 7
  
  EnableXRay:
    Type: String
    Default: "true"

Globals:
  Function:
    Runtime: nodejs20.x
    Timeout: 30
    MemorySize: 512
    Tracing: !If [EnableXRayCondition, Active, PassThrough]
    Environment:
      Variables:
        NODE_ENV: !Ref Environment
        LOG_LEVEL: !If [IsProd, "warn", "debug"]

Conditions:
  IsProd: !Equals [!Ref Environment, "prod"]
  EnableXRayCondition: !Equals [!Ref EnableXRay, "true"]

Resources:
  # Lambda Function
  ProcessorFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub '${Environment}-file-processor'
      CodeUri: src/
      Handler: handlers/processor.handler
      Description: Process files from S3
      
      AutoPublishAlias: live
      DeploymentPreference:
        Type: !If [IsProd, Canary10Percent10Minutes, AllAtOnce]
        Alarms:
          - !Ref ProcessorErrorAlarm
        Hooks:
          PreTraffic: !Ref PreTrafficHook
          PostTraffic: !Ref PostTrafficHook
      
      MemorySize: !If [IsProd, 1024, 512]
      Timeout: !If [IsProd, 300, 60]
      
      EphemeralStorage:
        Size: !If [IsProd, 2048, 512]
      
      ReservedConcurrentExecutions: !If [IsProd, 100, 10]
      
      Policies:
        - S3ReadPolicy:
            BucketName: !Ref FileBucket
        - SQSPollerPolicy:
            QueueName: !GetAtt FileQueue.QueueName
        - Statement:
          - Effect: Allow
            Action:
              - es:ESHttpPost
              - es:ESHttpPut
            Resource: !Sub '${ESDomain.Arn}/*'
      
      Events:
        SQSEvent:
          Type: SQS
          Properties:
            Queue: !GetAtt FileQueue.Arn
            BatchSize: !If [IsProd, 10, 1]
            FunctionResponseTypes:
              - ReportBatchItemFailures
      
      Environment:
        Variables:
          BUCKET_NAME: !Ref FileBucket
          ELASTICSEARCH_NODE: !GetAtt ESDomain.DomainEndpoint
          ENABLE_TMP_CACHE: !If [IsProd, "true", "false"]
      
      Tags:
        Environment: !Ref Environment
        ManagedBy: SAM

  # Pre-traffic hook
  PreTrafficHook:
    Type: AWS::Serverless::Function
    Properties:
      Handler: hooks/pre-traffic.handler
      Policies:
        - Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - codedeploy:PutLifecycleEventHookExecutionStatus
              Resource: '*'
            - Effect: Allow
              Action:
                - lambda:InvokeFunction
              Resource: !GetAtt ProcessorFunction.Arn
      Environment:
        Variables:
          FUNCTION_NAME: !Ref ProcessorFunction

  # Post-traffic hook
  PostTrafficHook:
    Type: AWS::Serverless::Function
    Properties:
      Handler: hooks/post-traffic.handler
      Policies:
        - Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - codedeploy:PutLifecycleEventHookExecutionStatus
              Resource: '*'

  # CloudWatch Alarm
  ProcessorErrorAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub '${Environment}-processor-errors'
      AlarmDescription: Lambda function errors
      MetricName: Errors
      Namespace: AWS/Lambda
      Statistic: Sum
      Period: 60
      EvaluationPeriods: 2
      Threshold: 10
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: FunctionName
          Value: !Ref ProcessorFunction

  # Log Group
  ProcessorLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub '/aws/lambda/${ProcessorFunction}'
      RetentionInDays: !Ref LogRetentionDays

Outputs:
  FunctionArn:
    Value: !GetAtt ProcessorFunction.Arn
  
  FunctionUrl:
    Value: !Sub 'https://console.aws.amazon.com/lambda/home?region=${AWS::Region}#/functions/${ProcessorFunction}'
  
  AliasArn:
    Value: !Ref ProcessorFunction.Alias
```

### Terraform Module (Reusable)

**Module Structure**:
```
modules/lambda-function/
├── main.tf
├── variables.tf
├── outputs.tf
└── README.md
```

**variables.tf**:
```hcl
variable "function_name" {
  description = "Lambda function name"
  type        = string
}

variable "description" {
  description = "Function description"
  type        = string
  default     = ""
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs20.x"
}

variable "handler" {
  description = "Lambda handler"
  type        = string
}

variable "source_dir" {
  description = "Source code directory"
  type        = string
}

variable "memory_size" {
  description = "Memory allocation in MB"
  type        = number
  default     = 512
}

variable "timeout" {
  description = "Timeout in seconds"
  type        = number
  default     = 30
}

variable "environment_variables" {
  description = "Environment variables"
  type        = map(string)
  default     = {}
}

variable "iam_policy_statements" {
  description = "Custom IAM policy statements"
  type        = list(any)
  default     = []
}

variable "layers" {
  description = "Lambda layer ARNs"
  type        = list(string)
  default     = []
}

variable "enable_xray" {
  description = "Enable X-Ray tracing"
  type        = bool
  default     = true
}

variable "reserved_concurrent_executions" {
  description = "Reserved concurrent executions"
  type        = number
  default     = -1
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
```

**Usage**:
```hcl
module "file_processor" {
  source = "./modules/lambda-function"
  
  function_name = "file-processor"
  description   = "Process files from S3"
  handler       = "handlers/processor.handler"
  source_dir    = "${path.module}/../src"
  
  memory_size = 1024
  timeout     = 300
  
  environment_variables = {
    NODE_ENV           = "production"
    BUCKET_NAME        = module.s3_bucket.bucket_id
    ELASTICSEARCH_NODE = module.elasticsearch.endpoint
    ENABLE_TMP_CACHE   = "true"
  }
  
  iam_policy_statements = [
    {
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:ListBucket"
      ]
      Resource = [
        module.s3_bucket.bucket_arn,
        "${module.s3_bucket.bucket_arn}/*"
      ]
    }
  ]
  
  layers = [
    module.lambda_layer_dependencies.layer_arn
  ]
  
  tags = {
    Environment = "production"
    Project     = "file-processing"
  }
}
```

---

## ✅ Testing & Validation

### 1. Local Testing

**SAM Local**:
```bash
# Invoke function locally
sam local invoke ProcessorFunction -e events/s3-event.json

# Start API Gateway locally
sam local start-api --port 3000

# Test API
curl -X POST http://localhost:3000/files \
  -H "Content-Type: application/json" \
  -d '{"fileId": "test-123"}'
```

**LocalStack** (for AWS emulation):
```bash
# docker-compose.yml
services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      - SERVICES=lambda,s3,sqs
      - LAMBDA_KEEPALIVE_MS=600000

# Deploy to LocalStack
awslocal lambda create-function \
  --function-name test-function \
  --runtime nodejs20.x \
  --handler handler.handler \
  --zip-file fileb://function.zip \
  --role arn:aws:iam::000000000000:role/lambda-role

# Test
awslocal lambda invoke \
  --function-name test-function \
  --payload '{"test": "data"}' \
  output.json
```

### 2. Integration Testing

**Test Script** (`test/integration.test.js`):
```javascript
const AWS = require('aws-sdk');
const { expect } = require('chai');

describe('Lambda Integration Tests', () => {
  const lambda = new AWS.Lambda({
    region: 'us-east-1',
    // Use LocalStack for local testing
    endpoint: process.env.LOCALSTACK_ENDPOINT
  });
  
  const functionName = process.env.FUNCTION_NAME || 'test-function';
  
  it('should process valid event', async () => {
    const payload = {
      Records: [{
        s3: {
          bucket: { name: 'test-bucket' },
          object: { key: 'test-file.pdf' }
        }
      }]
    };
    
    const result = await lambda.invoke({
      FunctionName: functionName,
      Payload: JSON.stringify(payload)
    }).promise();
    
    const response = JSON.parse(result.Payload);
    expect(response.statusCode).to.equal(200);
  });
  
  it('should handle invalid input', async () => {
    const payload = { invalid: 'data' };
    
    const result = await lambda.invoke({
      FunctionName: functionName,
      Payload: JSON.stringify(payload)
    }).promise();
    
    const response = JSON.parse(result.Payload);
    expect(response.statusCode).to.equal(400);
  });
  
  it('should timeout after 30 seconds', async function() {
    this.timeout(35000);
    
    const payload = { simulateTimeout: true };
    
    try {
      await lambda.invoke({
        FunctionName: functionName,
        Payload: JSON.stringify(payload)
      }).promise();
      
      expect.fail('Should have timed out');
    } catch (error) {
      expect(error.code).to.equal('TooManyRequestsException');
    }
  });
});
```

### 3. Smoke Testing (Post-Deployment)

**Smoke Test Script** (`scripts/smoke-test.sh`):
```bash
#!/bin/bash
set -e

FUNCTION_NAME="$1"
ALIAS_NAME="${2:-prod}"
REGION="${3:-us-east-1}"

echo "Running smoke tests for $FUNCTION_NAME:$ALIAS_NAME..."

# Test 1: Function exists
echo "✓ Checking function exists..."
aws lambda get-function \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" > /dev/null

# Test 2: Invoke with test payload
echo "✓ Invoking function..."
aws lambda invoke \
  --function-name "$FUNCTION_NAME:$ALIAS_NAME" \
  --payload '{"test": true}' \
  --region "$REGION" \
  /tmp/response.json > /dev/null

# Test 3: Check response
if [ ! -f /tmp/response.json ]; then
  echo "❌ No response file"
  exit 1
fi

RESPONSE=$(cat /tmp/response.json)
if echo "$RESPONSE" | grep -q "errorMessage"; then
  echo "❌ Function returned error: $RESPONSE"
  exit 1
fi

echo "✓ Function responded successfully"

# Test 4: Check CloudWatch logs
echo "✓ Checking logs..."
LOG_GROUP="/aws/lambda/$FUNCTION_NAME"
LATEST_LOG=$(aws logs describe-log-streams \
  --log-group-name "$LOG_GROUP" \
  --region "$REGION" \
  --order-by LastEventTime \
  --descending \
  --max-items 1 \
  --query 'logStreams[0].logStreamName' \
  --output text)

if [ -z "$LATEST_LOG" ]; then
  echo "⚠️  No recent logs found"
else
  echo "✓ Logs found: $LATEST_LOG"
fi

# Test 5: Check error rate
echo "✓ Checking error metrics..."
ERROR_COUNT=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value="$FUNCTION_NAME" Name=Resource,Value="$FUNCTION_NAME:$ALIAS_NAME" \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region "$REGION" \
  --query 'Datapoints[0].Sum' \
  --output text)

if [ "$ERROR_COUNT" != "None" ] && [ "$ERROR_COUNT" -gt 0 ]; then
  echo "⚠️  Errors detected: $ERROR_COUNT"
else
  echo "✓ No errors in last 5 minutes"
fi

echo ""
echo "✅ Smoke tests passed!"
```

**Run in CI/CD**:
```yaml
# GitHub Actions
- name: Smoke test
  run: |
    chmod +x scripts/smoke-test.sh
    ./scripts/smoke-test.sh ${{ env.FUNCTION_NAME }} prod
```

---

## 🔙 Rollback Strategies

### 1. Alias Rollback (Instant)

**Scenario**: Deployed v5 to prod, need to rollback to v4

```bash
# Check current version
aws lambda get-alias \
  --function-name my-function \
  --name prod \
  --query 'FunctionVersion'
# Output: "5"

# Rollback to v4
aws lambda update-alias \
  --function-name my-function \
  --name prod \
  --function-version 4 \
  --routing-config '{}'

# Verify
aws lambda get-alias \
  --function-name my-function \
  --name prod \
  --query 'FunctionVersion'
# Output: "4"
```

**Time**: < 1 second (instant)

### 2. CodeDeploy Rollback (Automated)

**Trigger rollback on CloudWatch Alarm**:
```yaml
# appspec.yml
Hooks:
  AfterAllowTraffic:
    - !Ref ValidationFunction

# ValidationFunction checks metrics and triggers rollback if needed
```

**Manual rollback**:
```bash
aws deploy stop-deployment \
  --deployment-id d-XXXXXXXXX \
  --auto-rollback-enabled
```

### 3. Terraform Rollback

**Option 1: Revert code and re-apply**
```bash
# Revert commit
git revert HEAD

# Re-apply
terraform apply -auto-approve
```

**Option 2: Use previous state**
```bash
# List states
terraform state list

# Pull specific version from state history
terraform state pull > previous-state.tfstate

# Apply previous state
terraform apply -state=previous-state.tfstate
```

### 4. Emergency Rollback Procedure

```bash
#!/bin/bash
# emergency-rollback.sh

FUNCTION_NAME="$1"
ALIAS_NAME="${2:-prod}"

echo "🚨 EMERGENCY ROLLBACK for $FUNCTION_NAME:$ALIAS_NAME"

# Get current version
CURRENT=$(aws lambda get-alias \
  --function-name "$FUNCTION_NAME" \
  --name "$ALIAS_NAME" \
  --query 'FunctionVersion' --output text)

echo "Current version: $CURRENT"

# Calculate previous version
PREVIOUS=$((CURRENT - 1))

if [ "$PREVIOUS" -lt 1 ]; then
  echo "❌ Cannot rollback from version 1"
  exit 1
fi

echo "Rolling back to version: $PREVIOUS"

# Immediate rollback
aws lambda update-alias \
  --function-name "$FUNCTION_NAME" \
  --name "$ALIAS_NAME" \
  --function-version "$PREVIOUS" \
  --routing-config '{}'

echo "✅ Rollback complete!"

# Send notification
aws sns publish \
  --topic-arn "$SNS_TOPIC_ARN" \
  --subject "Lambda Rollback: $FUNCTION_NAME" \
  --message "Rolled back $FUNCTION_NAME:$ALIAS_NAME from v$CURRENT to v$PREVIOUS"
```

---

## 📖 Best Practices

### 1. Package Optimization

```bash
# Remove dev dependencies
npm ci --only=production

# Remove unnecessary files
rm -rf tests/ *.test.js .env* README.md

# Use .npmignore or .gitattributes
echo "tests/" >> .npmignore
echo "*.test.js" >> .npmignore

# Bundle with webpack (tree shaking)
npx webpack --mode production

# Analyze bundle size
du -sh node_modules/* | sort -h | tail -10
```

### 2. Environment-Specific Configuration

```javascript
// config.js
const configs = {
  dev: {
    logLevel: 'debug',
    timeout: 30,
    memorySize: 512
  },
  staging: {
    logLevel: 'info',
    timeout: 60,
    memorySize: 1024
  },
  prod: {
    logLevel: 'warn',
    timeout: 300,
    memorySize: 2048
  }
};

module.exports = configs[process.env.NODE_ENV] || configs.dev;
```

### 3. Deployment Checklist

```markdown
Pre-Deployment:
- [ ] Code review approved
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Security scan (Snyk, Dependabot)
- [ ] Package size < 50MB
- [ ] Environment variables configured
- [ ] IAM permissions verified

Deployment:
- [ ] Deploy to staging first
- [ ] Run smoke tests
- [ ] Monitor metrics for 10 minutes
- [ ] Deploy to production with canary
- [ ] Monitor error rate, duration, throttles

Post-Deployment:
- [ ] Verify function version
- [ ] Check CloudWatch logs
- [ ] Test critical paths
- [ ] Update documentation
- [ ] Tag release in Git

Rollback Plan:
- [ ] Document rollback command
- [ ] Keep previous version alive
- [ ] Monitor for 24 hours
```

### 4. Monitoring Dashboard

**CloudWatch Dashboard** (Terraform):
```hcl
resource "aws_cloudwatch_dashboard" "lambda_dashboard" {
  dashboard_name = "lambda-${var.function_name}"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", { stat = "Sum" }],
            [".", "Errors", { stat = "Sum" }],
            [".", "Throttles", { stat = "Sum" }]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "Invocations & Errors"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/Lambda", "Duration", { stat = "Average" }],
            ["...", { stat = "p99" }]
          ]
          period = 300
          region = var.aws_region
          title  = "Duration (ms)"
        }
      },
      {
        type = "log"
        properties = {
          query = <<-EOT
            SOURCE '/aws/lambda/${var.function_name}'
            | fields @timestamp, @message
            | filter @message like /ERROR/
            | sort @timestamp desc
            | limit 20
          EOT
          region = var.aws_region
          title  = "Recent Errors"
        }
      }
    ]
  })
}
```

### 5. Secrets Management

**Never hardcode secrets!**

```javascript
// ❌ BAD
const DB_PASSWORD = 'my-secret-password';

// ✅ GOOD - Environment variable (encrypted at rest)
const DB_PASSWORD = process.env.DB_PASSWORD;

// ✅ BETTER - AWS Secrets Manager
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

let dbPassword = null;

async function getSecret() {
  if (dbPassword) return dbPassword;
  
  const data = await secretsManager.getSecretValue({
    SecretId: 'prod/database/password'
  }).promise();
  
  dbPassword = data.SecretString;
  return dbPassword;
}

exports.handler = async (event) => {
  const password = await getSecret();
  // Use password...
};
```

---

## 📚 Resources

### Official Documentation
- [AWS Lambda Developer Guide](https://docs.aws.amazon.com/lambda/latest/dg/)
- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_function)

### Tools
- [AWS SAM CLI](https://github.com/aws/aws-sam-cli)
- [Serverless Framework](https://www.serverless.com/)
- [LocalStack](https://localstack.cloud/)
- [Lambda Power Tuning](https://github.com/alexcasalboni/aws-lambda-power-tuning)

### Best Practices Guides
- [AWS Well-Architected Framework - Serverless](https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/)
- [AWS Lambda Operator Guide](https://docs.aws.amazon.com/lambda/latest/operatorguide/)

---

## 🎓 Summary

| Method | Best For | Complexity | Local Testing |
|--------|----------|------------|---------------|
| **AWS Console** | Learning, quick fixes | ⭐ Low | ❌ No |
| **AWS CLI** | Scripts, automation | ⭐⭐ Medium | ❌ No |
| **AWS SAM** | Serverless apps | ⭐⭐⭐ Medium | ✅ Yes |
| **Terraform** | Multi-cloud IaC | ⭐⭐⭐⭐ High | ❌ No |
| **Container Image** | Large deps (>250MB) | ⭐⭐⭐ Medium | ✅ Yes |

**Recommended Stack**:
- **Development**: SAM Local + LocalStack
- **CI/CD**: GitHub Actions / GitLab CI
- **IaC**: Terraform (production) or SAM (serverless-only)
- **Deployment Strategy**: Canary with aliases
- **Monitoring**: CloudWatch + X-Ray

**Key Takeaways**:
1. ✅ Always use **versioning + aliases** for production
2. ✅ Implement **canary deployments** for risk mitigation
3. ✅ **Test locally** with SAM/LocalStack before deploy
4. ✅ **Monitor metrics** during and after deployment
5. ✅ Keep **rollback plan** ready (instant with aliases)
6. ✅ **Optimize package size** for faster cold starts
7. ✅ Use **IaC** (SAM/Terraform) for reproducibility

---

**Document Version**: 1.0  
**Last Updated**: January 28, 2026  
**Target Audience**: DevOps Engineers, Solutions Architects
