# File Processing Workflow - Complete Guide

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Components](#components)
- [Setup Guide](#setup-guide)
- [Complete Workflow](#complete-workflow)
- [API Usage](#api-usage)
- [Troubleshooting](#troubleshooting)
- [Monitoring](#monitoring)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   File Processing Pipeline                       │
│             LocalStack + Real Elasticsearch Stack                │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Client     │      │  NestJS API  │      │  LocalStack  │
│   (curl)     │─────▶│  Port 3000   │─────▶│  Port 4566   │
└──────────────┘      └──────────────┘      └──────────────┘
                             │                      │
                             │                      │
                    ┌────────▼────────┐    ┌────────▼────────┐
                    │  File Upload    │    │   S3 Storage    │
                    │  (memoryStorage)│    │   file-uploads  │
                    └────────┬────────┘    └────────┬────────┘
                             │                      │
                             └──────────┬───────────┘
                                        │
                                ┌───────▼────────┐
                                │   SQS Queue    │
                                │ file-processing│
                                └───────┬────────┘
                                        │
                                ┌───────▼────────┐
                                │ Lambda Worker  │
                                │ file-processor │
                                └───────┬────────┘
                                        │
                        ┌───────────────┴───────────────┐
                        │                               │
                ┌───────▼────────┐            ┌────────▼────────┐
                │  Download S3   │            │  Chunk File     │
                │  via AWS SDK   │            │  5MB chunks     │
                └────────────────┘            └────────┬────────┘
                                                       │
                                              ┌────────▼────────┐
                                              │ Elasticsearch   │
                                              │   Port 9200     │
                                              │  Bulk Index     │
                                              └────────┬────────┘
                                                       │
                                              ┌────────▼────────┐
                                              │ Search Results  │
                                              │  Full-text      │
                                              └─────────────────┘
```

---

## 🧩 Components

### 1. **NestJS API** (`file-processor/`)
- **Port**: 3000
- **Purpose**: File upload service với hexagonal architecture
- **Tech Stack**: 
  - NestJS (TypeScript)
  - Multer (memoryStorage - file buffer)
  - AWS SDK v3 (S3, SQS)
  - Elasticsearch client v8.11.0
- **Key Features**:
  - Upload files to S3
  - Send messages to SQS
  - Full-text search via Elasticsearch

### 2. **LocalStack** (`docker-compose.yml`)
- **Port**: 4566
- **Services**: S3, SQS, Lambda, IAM, CloudWatch Logs, STS
- **Purpose**: AWS services emulator for local development
- **Persistence**: `localstack-data/` directory
- **Docker Image**: `gresau/localstack-persist:4`

### 3. **Lambda Worker** (`file-processor-lambda/`)
- **Runtime**: Node.js 20.x
- **Memory**: 512MB
- **Timeout**: 300s
- **Purpose**: Process files from S3, chunk into 5MB pieces, index to Elasticsearch
- **Trigger**: SQS queue (batch size: 5)
- **Environment Variables**:
  - `S3_BUCKET_NAME`: file-uploads
  - `ELASTICSEARCH_NODE`: http://host.docker.internal:9200
  - `ELASTICSEARCH_INDEX`: file-chunks
  - `CHUNK_SIZE`: 5242880 (5MB)
  - `CHUNK_OVERLAP`: 100 bytes

### 4. **Elasticsearch** (Docker Container)
- **Port**: 9200
- **Version**: 8.11.0
- **Purpose**: Full-text search engine for file chunks
- **Index**: `file-chunks`
- **Configuration**:
  - Single-node cluster
  - Security disabled (dev mode)
  - Java heap: 512MB

### 5. **Terraform Infrastructure** (`terraform/file-processor/`)
- **Purpose**: Provision LocalStack resources
- **Resources**:
  - S3 bucket: `file-uploads`
  - SQS queue: `file-processing-queue`
  - Lambda function: `file-processor-worker`
  - IAM roles and policies
  - OpenSearch domain (không dùng - switched to real Elasticsearch)

---

## 🚀 Setup Guide

### Prerequisites

```bash
# Required tools
- Docker Desktop
- Node.js 20.x
- pnpm (hoặc npm)
- Terraform >= 1.9.0
- AWS CLI v2
- Git Bash (Windows)
```

### Step 1: Start LocalStack

```bash
cd d:/devops/terraform/terraform-eks/localstack

# Start LocalStack container
docker compose up -d localstack

# Verify LocalStack is running
docker compose ps
curl http://localhost:4566/_localstack/health

# Expected output:
# {
#   "services": {
#     "s3": "running",
#     "sqs": "running",
#     "lambda": "running",
#     ...
#   }
# }
```

### Step 2: Provision Infrastructure with Terraform

```bash
cd terraform/file-processor

# Initialize Terraform
terraform init

# Review plan
terraform plan

# Apply infrastructure
terraform apply -auto-approve

# Verify resources created
terraform output

# Expected outputs:
# - s3_bucket_name = "file-uploads"
# - sqs_queue_url = "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/file-processing-queue"
# - lambda_function_name = "file-processor-worker"
# - opensearch_endpoint (not used)
```

### Step 3: Start Elasticsearch Container

```bash
# Run Elasticsearch (single-node, dev mode)
docker run -d \
  --name elasticsearch-local \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  -e "ES_JAVA_OPTS=-Xms512m -Xmx512m" \
  docker.elastic.co/elasticsearch/elasticsearch:8.11.0

# Verify Elasticsearch is running
curl http://localhost:9200

# Expected output:
# {
#   "name" : "...",
#   "cluster_name" : "docker-cluster",
#   "version" : { "number" : "8.11.0" },
#   ...
# }
```

### Step 4: Create Elasticsearch Index

```bash
# Create index with proper mapping
curl -X PUT "http://localhost:9200/file-chunks" \
  -H "Content-Type: application/json" \
  -d '{
    "mappings": {
      "properties": {
        "fileId": { "type": "keyword" },
        "chunkIndex": { "type": "long" },
        "content": { "type": "text" },
        "startByte": { "type": "long" },
        "endByte": { "type": "long" },
        "fileName": { "type": "keyword" },
        "metadata": {
          "properties": {
            "fileName": { "type": "keyword" },
            "fileSize": { "type": "long" },
            "chunkSize": { "type": "long" }
          }
        }
      }
    }
  }'

# Verify index created
curl "http://localhost:9200/_cat/indices?v"

# Expected output:
# health status index       pri rep docs.count ...
# yellow open   file-chunks   1   1          0 ...
```

### Step 5: Deploy Lambda Function

```bash
cd ../file-processor-lambda

# Deploy Lambda (creates package and uploads to LocalStack)
bash deploy.sh

# Expected output:
# 🚀 Deploying Lambda function to LocalStack...
# 📦 Creating deployment package...
# ✅ Package created: lambda-function.zip (9.63 MB)
# 🔑 Creating IAM role...
# 🆕 Creating Lambda function...
# 🔗 Creating SQS trigger...
# ✅ Lambda function deployed successfully!
```

### Step 6: Update Lambda Environment for Elasticsearch

```bash
# Update Lambda to point to real Elasticsearch
AWS_DEFAULT_REGION=us-east-1 aws --endpoint-url=http://localhost:4566 \
  lambda update-function-configuration \
  --function-name file-processor-worker \
  --environment 'Variables={
    AWS_REGION=us-east-1,
    S3_BUCKET_NAME=file-uploads,
    ELASTICSEARCH_NODE=http://host.docker.internal:9200,
    ELASTICSEARCH_INDEX=file-chunks,
    CHUNK_SIZE=5242880,
    CHUNK_OVERLAP=100
  }'

# Verify environment variables
AWS_DEFAULT_REGION=us-east-1 aws --endpoint-url=http://localhost:4566 \
  lambda get-function-configuration \
  --function-name file-processor-worker \
  --query 'Environment.Variables'
```

### Step 7: Start NestJS API

```bash
cd ../file-processor

# Install dependencies
pnpm install

# Verify .env file
cat .env
# Required variables:
# AWS_ENDPOINT=http://localhost:4566
# AWS_REGION=us-east-1
# S3_BUCKET_NAME=file-uploads
# SQS_QUEUE_URL=http://localhost:4566/000000000000/file-processing-queue
# ELASTICSEARCH_NODE=http://localhost:9200
# ELASTICSEARCH_INDEX=file-chunks

# Start API in development mode
pnpm run start:dev

# Wait for app to start
# Expected output:
# [Nest] LOG [NestFactory] Starting Nest application...
# [Nest] LOG [Bootstrap] 🚀 Application is running on: http://localhost:3000
# [Nest] LOG [Bootstrap] 📚 Swagger documentation: http://localhost:3000/api/docs
```

---

## 🔄 Complete Workflow

### 1. Upload File

```bash
# Upload a file to the API
curl -X POST http://localhost:3000/files/upload \
  -F "file=@/path/to/your/file.txt"

# Example response:
{
  "statusCode": 201,
  "message": "File uploaded successfully",
  "data": {
    "fileId": "02c3fe01-9be3-4fe8-9e3a-33b6b32a8192",
    "fileName": "README.md",
    "fileSize": 28089,
    "s3Key": "uploads/02c3fe01-9be3-4fe8-9e3a-33b6b32a8192/README.md",
    "status": "uploaded",
    "uploadedAt": "2026-01-25T02:57:58.415Z"
  }
}
```

**What happens internally:**

1. **API receives file** (`FileController.uploadFile`)
   - Multer stores file in memory buffer (memoryStorage)
   - Validates file type and size

2. **Upload to S3** (`S3Adapter.uploadFile`)
   ```typescript
   const command = new PutObjectCommand({
     Bucket: 'file-uploads',
     Key: 'uploads/{fileId}/{fileName}',
     Body: file.buffer,  // ✅ Buffer from memoryStorage
     ContentType: file.mimetype
   });
   ```

3. **Send message to SQS** (`SQSAdapter.sendMessage`)
   ```json
   {
     "fileId": "02c3fe01-9be3-4fe8-9e3a-33b6b32a8192",
     "fileName": "README.md",
     "s3Key": "uploads/02c3fe01-9be3-4fe8-9e3a-33b6b32a8192/README.md",
     "fileSize": 28089,
     "mimeType": "text/markdown",
     "timestamp": "2026-01-25T02:57:58.415Z"
   }
   ```

### 2. Lambda Processing (Automatic)

**Trigger**: SQS event source mapping (batch size: 5)

```javascript
// Lambda handler receives SQS event
exports.handler = async (event) => {
  const records = event.Records; // Up to 5 messages
  
  for (const record of records) {
    const message = JSON.parse(record.body);
    
    // Step 1: Download from S3
    const fileBuffer = await downloadFromS3(message.s3Key);
    // Uses AWS_ENDPOINT_URL from LocalStack (http://172.19.0.2:4566)
    
    // Step 2: Chunk file (5MB chunks with 100 bytes overlap)
    const chunks = chunkFile(fileBuffer, message);
    
    // Step 3: Bulk index to Elasticsearch
    await indexChunks(chunks);
    // Connects to http://host.docker.internal:9200
  }
  
  return { statusCode: 200 };
};
```

**Processing details:**

```javascript
// Chunking algorithm
function chunkFile(buffer, message) {
  const chunks = [];
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  const CHUNK_OVERLAP = 100; // bytes
  
  let startByte = 0;
  let chunkIndex = 0;
  
  while (startByte < buffer.length) {
    const endByte = Math.min(startByte + CHUNK_SIZE, buffer.length);
    const chunkContent = buffer.slice(startByte, endByte).toString('utf-8');
    
    chunks.push({
      fileId: message.fileId,
      chunkIndex: chunkIndex,
      content: chunkContent,
      startByte: startByte,
      endByte: endByte,
      fileName: message.fileName,
      metadata: {
        fileName: message.fileName,
        fileSize: message.fileSize,
        chunkSize: endByte - startByte
      }
    });
    
    chunkIndex++;
    startByte = endByte - CHUNK_OVERLAP;
  }
  
  return chunks;
}

// Elasticsearch bulk indexing
async function indexChunks(chunks) {
  if (!chunks || chunks.length === 0) {
    console.log('No chunks to index, skipping bulk operation');
    return;
  }
  
  const operations = chunks.flatMap((chunk) => [
    { index: { _index: 'file-chunks', _id: `${chunk.fileId}-${chunk.chunkIndex}` } },
    chunk,
  ]);
  
  const bulkResponse = await esClient.bulk({
    refresh: true,
    operations,
  });
  
  if (bulkResponse.errors) {
    throw new Error('Failed to index chunks');
  }
  
  console.log(`Indexed ${chunks.length} chunks successfully`);
}
```

### 3. Verify Processing

```bash
# Wait a few seconds for Lambda to process
sleep 5

# Check Elasticsearch index count
curl "http://localhost:9200/file-chunks/_count"

# Example response:
{
  "count": 1,  # Number of chunks indexed
  "_shards": {
    "total": 1,
    "successful": 1,
    "skipped": 0,
    "failed": 0
  }
}

# View indexed chunk
curl "http://localhost:9200/file-chunks/_search?size=1&pretty"

# Example response:
{
  "hits": {
    "total": { "value": 1 },
    "hits": [{
      "_index": "file-chunks",
      "_id": "02c3fe01-9be3-4fe8-9e3a-33b6b32a8192-0",
      "_source": {
        "fileId": "02c3fe01-9be3-4fe8-9e3a-33b6b32a8192",
        "chunkIndex": 0,
        "content": "# EKS Terraform Configuration...",
        "startByte": 0,
        "endByte": 28089,
        "fileName": "README.md",
        "metadata": {
          "fileName": "README.md",
          "fileSize": 28089,
          "chunkSize": 28089
        }
      }
    }]
  }
}
```

### 4. Search Files

```bash
# Search by text (full-text search)
curl "http://localhost:3000/files/search?text=terraform&fileId=02c3fe01-9be3-4fe8-9e3a-33b6b32a8192"

# Example response:
{
  "statusCode": 200,
  "data": {
    "total": 1,
    "took": 106,  # milliseconds
    "results": [{
      "fileId": "02c3fe01-9be3-4fe8-9e3a-33b6b32a8192",
      "chunkIndex": 0,
      "content": "# EKS Terraform Configuration - Development Environment...",
      "fileName": "README.md",
      "startByte": 0,
      "endByte": 28089
    }]
  }
}

# Search without fileId (search all files)
curl "http://localhost:3000/files/search?text=ArgoCD"

# Search with pagination
curl "http://localhost:3000/files/search?text=kubernetes&page=1&size=10"
```

### 5. Check File Status

```bash
# Get file processing status
curl "http://localhost:3000/files/{fileId}/status"

# Example response:
{
  "statusCode": 200,
  "data": {
    "fileId": "02c3fe01-9be3-4fe8-9e3a-33b6b32a8192",
    "status": "uploaded",
    "uploadedAt": "2026-01-25T02:57:58.415Z"
  }
}
```

---

## 📊 Monitoring

### Check LocalStack Services

```bash
# Health check
curl http://localhost:4566/_localstack/health | jq

# List S3 files
AWS_DEFAULT_REGION=us-east-1 aws --endpoint-url=http://localhost:4566 \
  s3 ls s3://file-uploads/uploads/ --recursive

# Check SQS queue attributes
AWS_DEFAULT_REGION=us-east-1 aws --endpoint-url=http://localhost:4566 \
  sqs get-queue-attributes \
  --queue-url http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/file-processing-queue \
  --attribute-names All

# List Lambda functions
AWS_DEFAULT_REGION=us-east-1 aws --endpoint-url=http://localhost:4566 \
  lambda list-functions
```

### Check Lambda Execution

```bash
# List event source mappings
AWS_DEFAULT_REGION=us-east-1 aws --endpoint-url=http://localhost:4566 \
  lambda list-event-source-mappings \
  --function-name file-processor-worker

# View Lambda logs (if CloudWatch Logs enabled)
AWS_DEFAULT_REGION=us-east-1 aws --endpoint-url=http://localhost:4566 \
  logs tail /aws/lambda/file-processor-worker --follow
```

### Monitor Elasticsearch

```bash
# Cluster health
curl "http://localhost:9200/_cluster/health?pretty"

# Index stats
curl "http://localhost:9200/file-chunks/_stats?pretty"

# List all indices
curl "http://localhost:9200/_cat/indices?v"

# Count documents
curl "http://localhost:9200/file-chunks/_count"

# Search all documents
curl "http://localhost:9200/file-chunks/_search?pretty"
```

### Monitor Docker Containers

```bash
# View LocalStack logs
docker compose logs -f localstack

# View LocalStack logs (recent Lambda execution)
docker compose logs localstack --tail 50 | grep -i "lambda\|error"

# View Elasticsearch logs
docker logs elasticsearch-local -f

# Container stats
docker stats localstack elasticsearch-local
```

---

## 🐛 Troubleshooting

### Issue 1: File uploaded but size = 0 in S3

**Symptoms:**
```bash
# S3 file has 0 bytes
aws s3api list-objects --bucket file-uploads --prefix uploads/
# "Size": 0

# Lambda downloads 0 bytes
# "Downloaded file: README.md (0 bytes)"
```

**Root Cause:** Multer using disk storage (`dest: './uploads'`) instead of memory storage

**Solution:**
```typescript
// app.module.ts - Fix Multer configuration
import { memoryStorage } from 'multer';

MulterModule.registerAsync({
  useFactory: async (configService: ConfigService) => ({
    storage: memoryStorage(),  // ✅ Use memory storage
    // dest: './uploads',       // ❌ Remove disk storage
    limits: {
      fileSize: configService.get<number>('MAX_FILE_SIZE', 524288000),
    },
  }),
}),
```

### Issue 2: Lambda can't connect to S3 (ECONNREFUSED 127.0.0.1:4566)

**Symptoms:**
```bash
# Lambda logs show:
# ERROR Error processing record: Error: connect ECONNREFUSED 127.0.0.1:4566
```

**Root Cause:** Lambda code hardcodes `AWS_ENDPOINT` in S3Client config, overriding LocalStack's injected `AWS_ENDPOINT_URL`

**Solution:**
```javascript
// handler.js - Remove explicit endpoint configuration
// ❌ Wrong:
const s3Client = new S3Client({
  endpoint: process.env.AWS_ENDPOINT,  // Don't override
  region: AWS_REGION,
  credentials: { ... },
  forcePathStyle: true,
});

// ✅ Correct - Let AWS SDK use LocalStack's injected AWS_ENDPOINT_URL
const s3Client = new S3Client({
  region: AWS_REGION,
  forcePathStyle: true,
  // LocalStack automatically injects AWS_ENDPOINT_URL=http://172.19.0.2:4566
});
```

### Issue 3: Elasticsearch bulk index fails with "parse_exception: request body is required"

**Symptoms:**
```bash
# Lambda logs show:
# ERROR parse_exception: request body is required
```

**Root Cause:** Calling bulk index with empty array when file has 0 chunks

**Solution:**
```javascript
// handler.js - Check for empty chunks before bulk index
async function indexChunks(chunks) {
  if (!chunks || chunks.length === 0) {
    console.log('No chunks to index, skipping bulk operation');
    return;  // ✅ Skip empty bulk operation
  }
  
  const operations = chunks.flatMap((chunk) => [
    { index: { _index: ELASTICSEARCH_INDEX, _id: `${chunk.fileId}-${chunk.chunkIndex}` } },
    chunk,
  ]);
  
  const bulkResponse = await esClient.bulk({
    refresh: true,
    operations,
  });
  
  // ... handle response
}
```

### Issue 4: LocalStack OpenSearch ProductNotSupportedError

**Symptoms:**
```bash
# Elasticsearch client throws:
# ProductNotSupportedError: The client noticed that the server is not Elasticsearch
```

**Root Cause:** LocalStack Community edition's OpenSearch is incompatible with Elasticsearch client v8

**Solution:** Use real Elasticsearch container instead of LocalStack OpenSearch

```bash
# Start real Elasticsearch
docker run -d \
  --name elasticsearch-local \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  -e "ES_JAVA_OPTS=-Xms512m -Xmx512m" \
  docker.elastic.co/elasticsearch/elasticsearch:8.11.0

# Update .env
ELASTICSEARCH_NODE=http://localhost:9200

# Update Lambda environment
AWS_DEFAULT_REGION=us-east-1 aws --endpoint-url=http://localhost:4566 \
  lambda update-function-configuration \
  --function-name file-processor-worker \
  --environment 'Variables={
    ...,
    ELASTICSEARCH_NODE=http://host.docker.internal:9200,
    ...
  }'
```

### Issue 5: Search returns 0 results

**Symptoms:**
```bash
curl "http://localhost:3000/files/search?text=test"
# {"total":0,"results":[]}
```

**Possible Causes:**

1. **Index doesn't exist**
   ```bash
   # Check if index exists
   curl "http://localhost:9200/_cat/indices?v"
   
   # Create index if missing
   curl -X PUT "http://localhost:9200/file-chunks" -H "Content-Type: application/json" -d '{...}'
   ```

2. **No documents indexed**
   ```bash
   # Check document count
   curl "http://localhost:9200/file-chunks/_count"
   # {"count":0}
   
   # Check Lambda processed messages
   AWS_DEFAULT_REGION=us-east-1 aws --endpoint-url=http://localhost:4566 \
     sqs get-queue-attributes \
     --queue-url http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/file-processing-queue \
     --attribute-names ApproximateNumberOfMessages,ApproximateNumberOfMessagesNotVisible
   ```

3. **Wrong fileId in search query**
   ```bash
   # Don't use placeholder
   curl "http://localhost:3000/files/search?text=test&fileId=<FILE_ID>"  # ❌
   
   # Use actual fileId from upload response
   curl "http://localhost:3000/files/search?text=test&fileId=02c3fe01-9be3-4fe8-9e3a-33b6b32a8192"  # ✅
   ```

### Issue 6: Lambda not triggering

**Symptoms:**
```bash
# Messages stay in queue, not processed
aws sqs get-queue-attributes ... | grep ApproximateNumberOfMessages
# "ApproximateNumberOfMessages": "5"
```

**Checks:**

1. **Verify event source mapping exists and enabled**
   ```bash
   AWS_DEFAULT_REGION=us-east-1 aws --endpoint-url=http://localhost:4566 \
     lambda list-event-source-mappings \
     --function-name file-processor-worker
   
   # Check State: "Enabled"
   ```

2. **Check Lambda function state**
   ```bash
   AWS_DEFAULT_REGION=us-east-1 aws --endpoint-url=http://localhost:4566 \
     lambda get-function --function-name file-processor-worker \
     --query 'Configuration.State'
   
   # Should be: "Active"
   ```

3. **Redeploy Lambda if needed**
   ```bash
   cd file-processor-lambda
   bash deploy.sh
   ```

---

## 📝 Configuration Reference

### Environment Variables

#### API (.env)
```bash
# AWS Configuration
AWS_ENDPOINT=http://localhost:4566
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# S3 Configuration
S3_BUCKET_NAME=file-uploads

# SQS Configuration
SQS_QUEUE_URL=http://localhost:4566/000000000000/file-processing-queue

# Elasticsearch Configuration
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_INDEX=file-chunks
ELASTICSEARCH_REQUEST_TIMEOUT=30000

# File Processing
MAX_FILE_SIZE=524288000  # 500MB
CHUNK_SIZE=5242880       # 5MB
CHUNK_OVERLAP=100        # 100 bytes

# Application
PORT=3000
NODE_ENV=development
```

#### Lambda (Environment Variables)
```javascript
{
  AWS_REGION: "us-east-1",
  S3_BUCKET_NAME: "file-uploads",
  ELASTICSEARCH_NODE: "http://host.docker.internal:9200",
  ELASTICSEARCH_INDEX: "file-chunks",
  CHUNK_SIZE: "5242880",
  CHUNK_OVERLAP: "100"
}
// Note: AWS_ENDPOINT_URL is injected by LocalStack
```

### Ports Reference

| Service | Port | Purpose |
|---------|------|---------|
| NestJS API | 3000 | File upload & search endpoints |
| LocalStack | 4566 | AWS services emulator |
| Elasticsearch | 9200 | Search engine |

### Default Values

| Configuration | Default | Description |
|---------------|---------|-------------|
| Lambda Memory | 512MB | Sufficient for 5MB chunks |
| Lambda Timeout | 300s | 5 minutes for large files |
| SQS Batch Size | 5 | Process up to 5 files per invocation |
| Chunk Size | 5MB | Balance between search performance and memory |
| Chunk Overlap | 100 bytes | Avoid cutting words/sentences |
| Max File Size | 500MB | API upload limit |

---

## 🎯 Best Practices

### 1. File Upload
- ✅ Use memoryStorage for small-to-medium files
- ✅ Validate file types and sizes before upload
- ✅ Generate unique fileId (UUID) for each upload
- ✅ Store original filename in metadata

### 2. Lambda Processing
- ✅ Use batch processing (SQS batch size: 5-10)
- ✅ Implement proper error handling
- ✅ Use ReportBatchItemFailures for partial batch success
- ✅ Log processing metrics (file size, chunks, time)

### 3. Elasticsearch
- ✅ Use bulk API for indexing multiple chunks
- ✅ Set `refresh: true` for immediate visibility
- ✅ Use keyword type for exact match fields (fileId, fileName)
- ✅ Use text type for full-text search (content)
- ✅ Monitor index size and performance

### 4. Security (Production)
- ⚠️ Replace LocalStack with real AWS services
- ⚠️ Enable Elasticsearch security (authentication)
- ⚠️ Use IAM roles instead of hardcoded credentials
- ⚠️ Implement file type validation and virus scanning
- ⚠️ Add rate limiting and authentication to API

---

## 🚀 Next Steps

### Production Readiness

1. **Replace LocalStack with AWS**
   - Use real S3, SQS, Lambda
   - Configure IAM roles properly
   - Setup VPC and security groups

2. **Elasticsearch in Production**
   - Use AWS OpenSearch Service or Elastic Cloud
   - Enable authentication and encryption
   - Setup proper backup and monitoring

3. **Monitoring & Logging**
   - CloudWatch Logs for Lambda
   - CloudWatch Metrics for SQS
   - APM for API (DataDog, New Relic)
   - Elasticsearch monitoring (Kibana)

4. **Performance Optimization**
   - Adjust chunk size based on file types
   - Implement caching for frequent searches
   - Use Lambda provisioned concurrency
   - Optimize Elasticsearch index settings

5. **Testing**
   - Unit tests for Lambda handler
   - Integration tests for full workflow
   - Load testing with large files
   - Failure scenario testing

---

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [AWS Lambda with Node.js](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)
- [Elasticsearch Guide](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [LocalStack Documentation](https://docs.localstack.cloud/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)

---

**Last Updated**: January 25, 2026  
**Version**: 1.0  
**Status**: ✅ Fully Working
