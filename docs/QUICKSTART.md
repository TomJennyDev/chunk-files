# Quick Start Guide

## 🎯 Prerequisites

Before starting, ensure you have:

```bash
✅ Docker Desktop installed and running
✅ Node.js 20.x or later
✅ pnpm (or npm) package manager
✅ Terraform >= 1.9.0
✅ AWS CLI v2
✅ Git Bash (for Windows users)
✅ 8GB+ RAM available
✅ 10GB+ free disk space
```

---

## ⚡ 5-Minute Setup

### 1. Start LocalStack (30 seconds)

```bash
cd d:/devops/terraform/terraform-eks/localstack

# Start LocalStack container
docker compose up -d localstack

# Verify it's running
curl http://localhost:4566/_localstack/health
```

**Expected output:**
```json
{
  "services": {
    "s3": "running",
    "sqs": "running",
    "lambda": "running",
    ...
  }
}
```

### 2. Provision Infrastructure (2 minutes)

```bash
cd terraform/file-processor

# Initialize and apply
terraform init
terraform apply -auto-approve

# Verify outputs
terraform output
```

**Expected outputs:**
```
s3_bucket_name = "file-uploads"
sqs_queue_url = "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/file-processing-queue"
lambda_function_name = "file-processor-worker"
```

### 3. Start Elasticsearch (30 seconds)

```bash
docker run -d \
  --name elasticsearch-local \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  -e "ES_JAVA_OPTS=-Xms512m -Xmx512m" \
  docker.elastic.co/elasticsearch/elasticsearch:8.11.0

# Wait for it to start
sleep 10

# Verify
curl http://localhost:9200
```

### 4. Create Elasticsearch Index (10 seconds)

```bash
curl -X PUT "http://localhost:9200/file-chunks" \
  -H "Content-Type: application/json" \
  -d '{
    "mappings": {
      "properties": {
        "fileId": {"type": "keyword"},
        "chunkIndex": {"type": "long"},
        "content": {"type": "text"},
        "startByte": {"type": "long"},
        "endByte": {"type": "long"},
        "fileName": {"type": "keyword"},
        "metadata": {
          "properties": {
            "fileName": {"type": "keyword"},
            "fileSize": {"type": "long"},
            "chunkSize": {"type": "long"}
          }
        }
      }
    }
  }'

# Verify index created
curl "http://localhost:9200/_cat/indices?v"
```

### 5. Deploy Lambda (30 seconds)

```bash
cd ../file-processor-lambda

# Deploy
bash deploy.sh

# Update Lambda environment for Elasticsearch
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
```

### 6. Start API (1 minute)

```bash
cd ../file-processor

# Install dependencies (first time only)
pnpm install

# Check .env file
cat .env

# Start in development mode
pnpm run start:dev
```

**Wait for:**
```
[Nest] LOG [Bootstrap] 🚀 Application is running on: http://localhost:3000
```

---

## 🧪 Test the System

### 1. Upload a File

```bash
# Open a new terminal (keep API running)
cd d:/devops/terraform/terraform-eks/localstack/file-processor

curl -X POST http://localhost:3000/files/upload \
  -F "file=@d:/devops/terraform/terraform-eks/README.md"
```

**Expected response:**
```json
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

**Save the `fileId` for next steps!**

### 2. Wait for Processing (5 seconds)

```bash
# Give Lambda time to process
sleep 5

# Check if chunks were indexed
curl "http://localhost:9200/file-chunks/_count"
```

**Expected:**
```json
{
  "count": 1,
  "_shards": {
    "total": 1,
    "successful": 1
  }
}
```

### 3. Search the File

```bash
# Replace {fileId} with your actual fileId
curl "http://localhost:3000/files/search?text=terraform&fileId={fileId}"

# Example:
curl "http://localhost:3000/files/search?text=terraform&fileId=02c3fe01-9be3-4fe8-9e3a-33b6b32a8192"
```

**Expected:**
```json
{
  "statusCode": 200,
  "data": {
    "total": 1,
    "took": 106,
    "results": [{
      "fileId": "02c3fe01-9be3-4fe8-9e3a-33b6b32a8192",
      "chunkIndex": 0,
      "content": "# EKS Terraform Configuration...",
      "fileName": "README.md",
      "startByte": 0,
      "endByte": 28089
    }]
  }
}
```

### 4. Try Different Searches

```bash
# Search for "ArgoCD"
curl "http://localhost:3000/files/search?text=ArgoCD"

# Search for "WAF"
curl "http://localhost:3000/files/search?text=WAF"

# Search for "monitoring"
curl "http://localhost:3000/files/search?text=monitoring"
```

---

## ✅ Success Criteria

Your system is working if:

- ✅ LocalStack health check shows all services running
- ✅ Terraform created S3 bucket, SQS queue, and Lambda function
- ✅ Elasticsearch index "file-chunks" exists
- ✅ Lambda is connected to SQS (event source mapping)
- ✅ API starts without errors on port 3000
- ✅ File upload returns 201 status
- ✅ Elasticsearch count > 0 after upload
- ✅ Search returns matching results

---

## 🔍 Verification Commands

### Check All Services

```bash
# LocalStack
curl http://localhost:4566/_localstack/health | jq

# Elasticsearch
curl http://localhost:9200

# API
curl http://localhost:3000/health

# S3 files
AWS_DEFAULT_REGION=us-east-1 aws --endpoint-url=http://localhost:4566 \
  s3 ls s3://file-uploads/uploads/ --recursive

# SQS queue
AWS_DEFAULT_REGION=us-east-1 aws --endpoint-url=http://localhost:4566 \
  sqs get-queue-attributes \
  --queue-url http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/file-processing-queue \
  --attribute-names All

# Lambda
AWS_DEFAULT_REGION=us-east-1 aws --endpoint-url=http://localhost:4566 \
  lambda list-event-source-mappings \
  --function-name file-processor-worker

# Elasticsearch index
curl "http://localhost:9200/_cat/indices?v"
curl "http://localhost:9200/file-chunks/_count"
```

---

## 🐛 Common Issues & Quick Fixes

### Issue: Port 4566 already in use

```bash
# Stop existing LocalStack
docker compose down

# Or force kill
docker stop localstack && docker rm localstack

# Start again
docker compose up -d localstack
```

### Issue: Port 3000 already in use

```bash
# Find process
netstat -ano | findstr :3000

# Kill it or change API port in main.ts
```

### Issue: Elasticsearch not starting

```bash
# Check container
docker logs elasticsearch-local

# Remove and recreate
docker stop elasticsearch-local
docker rm elasticsearch-local

# Start again (from step 3)
docker run -d --name elasticsearch-local ...
```

### Issue: File uploaded but count = 0

```bash
# Check Lambda logs
cd d:/devops/terraform/terraform-eks/localstack
docker compose logs localstack --tail 50 | grep -i "lambda\|error"

# Check if Lambda processed
AWS_DEFAULT_REGION=us-east-1 aws --endpoint-url=http://localhost:4566 \
  sqs get-queue-attributes \
  --queue-url http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/file-processing-queue \
  --attribute-names ApproximateNumberOfMessagesNotVisible

# If messages stuck, redeploy Lambda
cd file-processor-lambda
bash deploy.sh
```

### Issue: Search returns 0 results

```bash
# Make sure you're using the correct fileId
# Check what's in Elasticsearch
curl "http://localhost:9200/file-chunks/_search?pretty"

# Search without fileId to see all results
curl "http://localhost:3000/files/search?text=terraform"
```

---

## 🎨 API Endpoints

### Upload File
```bash
POST http://localhost:3000/files/upload
Content-Type: multipart/form-data

# Body: file field with file data
```

### Search Files
```bash
GET http://localhost:3000/files/search?text={searchText}&fileId={fileId}

# Parameters:
# - text: search query (required)
# - fileId: filter by file (optional)
# - page: pagination page (optional)
# - size: results per page (optional)
```

### Get File Status
```bash
GET http://localhost:3000/files/{fileId}/status
```

### Health Check
```bash
GET http://localhost:3000/health
```

### Swagger Documentation
```
http://localhost:3000/api/docs
```

---

## 🛠️ Development Tips

### Watch Mode

```bash
# API auto-reloads on code changes
cd file-processor
pnpm run start:dev
```

### View Logs

```bash
# LocalStack logs
cd localstack
docker compose logs -f localstack

# Elasticsearch logs
docker logs -f elasticsearch-local

# API logs
# Already displayed in terminal where you ran pnpm run start:dev
```

### Clean & Restart

```bash
# Stop everything
docker compose down
docker stop elasticsearch-local

# Clean data (optional)
rm -rf localstack-data/*

# Start fresh
docker compose up -d localstack
docker start elasticsearch-local

# Recreate index
curl -X PUT "http://localhost:9200/file-chunks" -H "Content-Type: application/json" -d '{...}'

# Redeploy Lambda
cd file-processor-lambda
bash deploy.sh
```

---

## 📚 Next Steps

Once everything is working:

1. **Read Documentation**
   - [`WORKFLOW.md`](./WORKFLOW.md) - Complete workflow guide
   - [`ARCHITECTURE.md`](./ARCHITECTURE.md) - System architecture
   - [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) - Detailed troubleshooting

2. **Try Advanced Features**
   - Upload larger files (> 5MB to see chunking)
   - Search with pagination
   - Test concurrent uploads
   - Monitor Lambda scaling

3. **Customize**
   - Adjust chunk size in Lambda
   - Change Elasticsearch mapping
   - Add file type validation
   - Implement authentication

4. **Prepare for Production**
   - Replace LocalStack with real AWS
   - Setup proper security
   - Configure monitoring
   - Implement backup strategy

---

## 💡 Pro Tips

- **Use aliases** for AWS CLI with LocalStack:
  ```bash
  alias awsl='AWS_DEFAULT_REGION=us-east-1 aws --endpoint-url=http://localhost:4566'
  ```

- **Quick health check**:
  ```bash
  curl http://localhost:4566/_localstack/health && \
  curl http://localhost:9200 && \
  curl http://localhost:3000/health
  ```

- **Monitor everything**:
  ```bash
  watch -n 2 'curl -s http://localhost:9200/file-chunks/_count | jq .count'
  ```

- **Clean Elasticsearch**:
  ```bash
  curl -X DELETE "http://localhost:9200/file-chunks"
  curl -X PUT "http://localhost:9200/file-chunks" -H "Content-Type: application/json" -d '{...}'
  ```

---

## 🆘 Need Help?

1. Check logs first (LocalStack, Elasticsearch, API)
2. Verify all services are running
3. Review the [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) guide
4. Check environment variables in `.env` file
5. Ensure all prerequisites are installed

**Still stuck?** Open an issue with:
- Error messages from logs
- Output of health checks
- Steps to reproduce

---

**Estimated Setup Time**: 5-10 minutes  
**Difficulty**: Beginner-friendly  
**Last Updated**: January 25, 2026
