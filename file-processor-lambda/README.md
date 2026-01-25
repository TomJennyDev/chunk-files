# File Processor Lambda

AWS Lambda function để xử lý files từ SQS queue.

## 📁 Cấu trúc

```
file-processor-lambda/
├── src/
│   └── handler.js          # Lambda handler function
├── package.json            # Dependencies
├── deploy.sh              # Deploy to LocalStack
├── package.sh             # Package for production
└── README.md
```

## 🚀 Quick Start

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Deploy lên LocalStack (Development)

```bash
npm run deploy
```

hoặc:

```bash
bash deploy.sh
```

### 3. Package cho Production

```bash
npm run package
```

Tạo file `lambda-function.zip` sẵn sàng để deploy lên AWS.

## 📝 Lambda Handler

**Event Source**: SQS Queue (`file-processing-queue`)

**Input Message Format**:
```json
{
  "fileId": "uuid",
  "s3Key": "uploads/file-uuid.ext",
  "fileName": "original-name.txt",
  "fileSize": 12345,
  "contentType": "text/plain"
}
```

**Processing Flow**:
1. Nhận batch messages từ SQS (max 5 messages)
2. Download file từ S3
3. Chunk file thành các phần 5MB
4. Index chunks vào Elasticsearch
5. Return partial batch failures nếu có lỗi

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| AWS_ENDPOINT | http://localhost:4566 | LocalStack endpoint |
| AWS_REGION | us-east-1 | AWS region |
| AWS_ACCESS_KEY_ID | test | AWS access key |
| AWS_SECRET_ACCESS_KEY | test | AWS secret key |
| S3_BUCKET_NAME | file-uploads | S3 bucket name |
| ELASTICSEARCH_NODE | http://localhost:4566 | Elasticsearch endpoint |
| ELASTICSEARCH_INDEX | file-chunks | Elasticsearch index |
| CHUNK_SIZE | 5242880 | Chunk size (5MB) |
| CHUNK_OVERLAP | 100 | Overlap between chunks |

## 🧪 Testing

### Test locally với LocalStack

```bash
# Invoke Lambda directly
awslocal lambda invoke \
  --function-name file-processor-worker \
  --payload '{
    "Records": [{
      "messageId": "test-123",
      "body": "{\"fileId\":\"test-file-id\",\"s3Key\":\"uploads/test.txt\",\"fileName\":\"test.txt\",\"fileSize\":1000,\"contentType\":\"text/plain\"}"
    }]
  }' \
  response.json

# View logs
awslocal logs tail /aws/lambda/file-processor-worker --follow

# Check SQS queue stats
awslocal sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/file-processing-queue \
  --attribute-names All
```

### Test end-to-end workflow

1. Upload file qua API:
```bash
cd ../file-processor
curl -X POST http://localhost:3000/files/upload \
  -F "file=@test.txt"
```

2. Message sẽ tự động được gửi vào SQS
3. Lambda tự động trigger và xử lý
4. Check logs để xem kết quả

## 📊 Monitoring

### Lambda metrics
```bash
# List all Lambda functions
awslocal lambda list-functions

# Get function configuration
awslocal lambda get-function-configuration \
  --function-name file-processor-worker

# List event source mappings
awslocal lambda list-event-source-mappings \
  --function-name file-processor-worker
```

### CloudWatch Logs
```bash
# View recent logs
awslocal logs tail /aws/lambda/file-processor-worker

# Follow logs in real-time
awslocal logs tail /aws/lambda/file-processor-worker --follow

# Filter logs
awslocal logs filter-log-events \
  --log-group-name /aws/lambda/file-processor-worker \
  --filter-pattern "ERROR"
```

## 🔄 Update Lambda

### Update code only
```bash
npm run deploy
```

### Update configuration
```bash
awslocal lambda update-function-configuration \
  --function-name file-processor-worker \
  --timeout 600 \
  --memory-size 1024
```

### Update environment variables
```bash
awslocal lambda update-function-configuration \
  --function-name file-processor-worker \
  --environment Variables="{CHUNK_SIZE=10485760}"
```

## 🏭 Production Deployment

### Option 1: AWS CLI

```bash
# Package
npm run package

# Upload to S3
aws s3 cp lambda-function.zip s3://my-lambda-bucket/

# Update function
aws lambda update-function-code \
  --function-name file-processor-worker \
  --s3-bucket my-lambda-bucket \
  --s3-key lambda-function.zip
```

### Option 2: Terraform

```hcl
resource "aws_lambda_function" "file_processor" {
  filename      = "${path.module}/lambda-function.zip"
  function_name = "file-processor-worker"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "src/handler.handler"
  runtime       = "nodejs20.x"
  timeout       = 300
  memory_size   = 512

  environment {
    variables = {
      S3_BUCKET_NAME      = aws_s3_bucket.uploads.id
      ELASTICSEARCH_NODE  = aws_elasticsearch_domain.main.endpoint
      ELASTICSEARCH_INDEX = "file-chunks"
      CHUNK_SIZE         = "5242880"
      CHUNK_OVERLAP      = "100"
    }
  }
}

resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = aws_sqs_queue.file_processing.arn
  function_name    = aws_lambda_function.file_processor.arn
  batch_size       = 5
  maximum_batching_window_in_seconds = 10
  function_response_types = ["ReportBatchItemFailures"]
}
```

### Option 3: SAM Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  FileProcessorFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: file-processor-worker
      Handler: src/handler.handler
      Runtime: nodejs20.x
      Timeout: 300
      MemorySize: 512
      Environment:
        Variables:
          S3_BUCKET_NAME: !Ref FileUploadBucket
          ELASTICSEARCH_NODE: !GetAtt ElasticsearchDomain.DomainEndpoint
          ELASTICSEARCH_INDEX: file-chunks
          CHUNK_SIZE: 5242880
          CHUNK_OVERLAP: 100
      Events:
        SQSTrigger:
          Type: SQS
          Properties:
            Queue: !GetAtt FileProcessingQueue.Arn
            BatchSize: 5
            MaximumBatchingWindowInSeconds: 10
            FunctionResponseTypes:
              - ReportBatchItemFailures
```

## 🔍 Troubleshooting

### Lambda không trigger từ SQS
```bash
# Check event source mapping status
awslocal lambda list-event-source-mappings \
  --function-name file-processor-worker

# Check SQS queue attributes
awslocal sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/file-processing-queue \
  --attribute-names All
```

### Lambda timeout
- Tăng timeout: `--timeout 600`
- Tăng memory: `--memory-size 1024`
- Giảm batch size: `--batch-size 1`

### Elasticsearch connection errors
- Check ELASTICSEARCH_NODE environment variable
- Verify network connectivity
- Check Elasticsearch credentials

## 📚 References

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [SQS Event Source](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html)
- [Partial Batch Failure](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting)
- [LocalStack Lambda](https://docs.localstack.cloud/user-guide/aws/lambda/)
