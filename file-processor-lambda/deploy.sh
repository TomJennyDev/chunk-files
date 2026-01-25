#!/bin/bash

# Lambda deployment script for LocalStack
set -e

echo "🚀 Deploying Lambda function to LocalStack..."

# Configuration
LAMBDA_NAME="file-processor-worker"
LAMBDA_HANDLER="src/handler.handler"
LAMBDA_RUNTIME="nodejs20.x"
LAMBDA_ROLE="arn:aws:iam::000000000000:role/lambda-execution-role"
SQS_QUEUE_ARN="arn:aws:sqs:us-east-1:000000000000:file-processing-queue"
AWS_ENDPOINT="http://localhost:4566"
AWS_REGION="us-east-1"

# AWS CLI wrapper for LocalStack
aws_local() {
  AWS_DEFAULT_REGION=$AWS_REGION aws --endpoint-url=$AWS_ENDPOINT "$@"
}

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install --production
fi

# Create deployment package using Node.js script (cross-platform)
echo "📦 Creating deployment package..."
node package-lambda.js

if [ ! -f "lambda-function.zip" ]; then
  echo "❌ Failed to create lambda-function.zip"
  exit 1
fi

# Create IAM role if it doesn't exist
echo "🔑 Creating IAM role..."
aws_local iam create-role \
  --role-name lambda-execution-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' 2>/dev/null || echo "✓ Role already exists"

# Attach policies
echo "🔐 Attaching policies..."
aws_local iam attach-role-policy \
  --role-name lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null || true

aws_local iam attach-role-policy \
  --role-name lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess 2>/dev/null || true

aws_local iam attach-role-policy \
  --role-name lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSQSFullAccess 2>/dev/null || true

# Delete existing Lambda function
echo "🗑️  Removing old Lambda function..."
aws_local lambda delete-function --function-name $LAMBDA_NAME 2>/dev/null || echo "✓ No existing function to delete"

# Create Lambda function
echo "🆕 Creating Lambda function..."
aws_local lambda create-function \
  --function-name $LAMBDA_NAME \
  --runtime $LAMBDA_RUNTIME \
  --handler $LAMBDA_HANDLER \
  --role $LAMBDA_ROLE \
  --zip-file fileb://lambda-function.zip \
  --timeout 300 \
  --memory-size 512 \
  --environment Variables="{
    AWS_ENDPOINT=$AWS_ENDPOINT,
    AWS_REGION=$AWS_REGION,
    AWS_ACCESS_KEY_ID=test,
    AWS_SECRET_ACCESS_KEY=test,
    S3_BUCKET_NAME=file-uploads,
    ELASTICSEARCH_NODE=$AWS_ENDPOINT,
    ELASTICSEARCH_INDEX=file-chunks,
    CHUNK_SIZE=5242880,
    CHUNK_OVERLAP=100
  }"

# Wait a bit for Lambda to be ready
sleep 2

# Delete existing event source mapping if exists
echo "🔗 Checking existing SQS triggers..."
EXISTING_MAPPING=$(aws_local lambda list-event-source-mappings \
  --function-name $LAMBDA_NAME \
  --query "EventSourceMappings[?EventSourceArn=='$SQS_QUEUE_ARN'].UUID" \
  --output text 2>/dev/null || true)

if [ ! -z "$EXISTING_MAPPING" ]; then
  echo "🗑️  Removing existing SQS trigger..."
  aws_local lambda delete-event-source-mapping --uuid $EXISTING_MAPPING
  sleep 1
fi

# Create event source mapping (SQS trigger)
echo "🔗 Creating SQS trigger..."
aws_local lambda create-event-source-mapping \
  --function-name $LAMBDA_NAME \
  --event-source-arn $SQS_QUEUE_ARN \
  --batch-size 5 \
  --maximum-batching-window-in-seconds 10 \
  --function-response-types ReportBatchItemFailures

echo ""
echo "✅ Lambda function deployed successfully!"
echo ""
echo "📋 Function Details:"
echo "  Name: $LAMBDA_NAME"
echo "  Handler: $LAMBDA_HANDLER"
echo "  Runtime: $LAMBDA_RUNTIME"
echo "  Timeout: 300s"
echo "  Memory: 512MB"
echo "  SQS Trigger: Enabled (batch size: 5)"
echo ""
echo "🧪 Test commands:"
echo "  # Invoke directly"
echo "  aws_local lambda invoke --function-name $LAMBDA_NAME response.json"
echo ""
echo "  # View logs"
echo "  aws_local logs tail /aws/lambda/$LAMBDA_NAME --follow"
echo ""
echo "  # Check SQS queue"
echo "  aws_local sqs get-queue-attributes --queue-url http://localhost:4566/000000000000/file-processing-queue --attribute-names All"
