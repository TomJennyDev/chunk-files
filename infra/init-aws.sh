#!/bin/bash
# LocalStack initialization script
# Creates S3 bucket and SQS queue when LocalStack is ready

echo "========================================="
echo "Initializing AWS resources in LocalStack"
echo "========================================="

# Create S3 bucket for file uploads
echo "Creating S3 bucket: file-uploads..."
awslocal s3 mb s3://file-uploads 2>/dev/null || echo "Bucket already exists"
awslocal s3api put-bucket-cors --bucket file-uploads --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}'
echo "S3 bucket created with CORS configuration"

# Create SQS queue for file processing
echo "Creating SQS queue: file-processing-queue..."
awslocal sqs create-queue \
  --queue-name file-processing-queue \
  --attributes '{
    "VisibilityTimeout": "300",
    "MessageRetentionPeriod": "86400",
    "ReceiveMessageWaitTimeSeconds": "20"
  }' 2>/dev/null || echo "Queue already exists"
echo "SQS queue created"

# Verify resources
echo ""
echo "========================================="
echo "Verifying created resources:"
echo "========================================="
echo "S3 Buckets:"
awslocal s3 ls
echo ""
echo "SQS Queues:"
awslocal sqs list-queues
echo ""
echo "========================================="
echo "LocalStack initialization complete!"
echo "========================================="
