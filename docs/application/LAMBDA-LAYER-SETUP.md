# Lambda Layer for AI/ML Dependencies

## Problem
Markdown processing với AI embeddings cần nhiều dependencies lớn:
- `@xenova/transformers` (~50MB)
- `langchain` và `@langchain/textsplitters`
- Model files (~80MB)

Nếu bundle tất cả vào Lambda function → exceed 50MB limit (unzipped: 250MB)

## Solution: Lambda Layers

### Option 1: Pre-built Layer (Recommended)

Tạo Lambda Layer riêng cho dependencies nặng:

```bash
# Create layer directory
mkdir -p layers/ai-dependencies/nodejs
cd layers/ai-dependencies/nodejs

# Install dependencies
npm init -y
npm install @xenova/transformers langchain @langchain/textsplitters marked markdown-it

# Package layer
cd ..
zip -r ai-dependencies-layer.zip nodejs

# Upload to S3
aws s3 cp ai-dependencies-layer.zip s3://your-bucket/layers/ \
  --endpoint-url=http://localhost:4566

# Create layer in Lambda
aws lambda publish-layer-version \
  --layer-name ai-dependencies \
  --content S3Bucket=your-bucket,S3Key=layers/ai-dependencies-layer.zip \
  --compatible-runtimes nodejs18.x nodejs20.x \
  --endpoint-url=http://localhost:4566
```

### Option 2: Terraform Configuration

Update `terraform/file-processor/lambda.tf`:

```hcl
# Create Lambda Layer
resource "aws_lambda_layer_version" "ai_dependencies" {
  filename            = "${path.module}/../../layers/ai-dependencies-layer.zip"
  layer_name          = "ai-dependencies"
  compatible_runtimes = ["nodejs18.x", "nodejs20.x"]
  
  source_code_hash = filebase64sha256("${path.module}/../../layers/ai-dependencies-layer.zip")
}

# Update Lambda function to use layer
resource "aws_lambda_function" "file_processor" {
  # ... existing config ...
  
  layers = [
    aws_lambda_layer_version.ai_dependencies.arn
  ]
  
  # Increase memory for AI processing
  memory_size = 1024  # 1GB (was 512MB)
  timeout     = 300   # 5 minutes (was 60s)
  
  environment {
    variables = {
      # ... existing vars ...
      ENABLE_EMBEDDINGS = "true"
      CHUNK_SIZE       = "1000"
      CHUNK_OVERLAP    = "200"
    }
  }
}
```

### Option 3: Docker Image (LocalStack Pro)

If using LocalStack Pro, use Docker image instead:

```dockerfile
# Dockerfile.lambda
FROM public.ecr.aws/lambda/nodejs:18

# Copy function code
COPY src/ ${LAMBDA_TASK_ROOT}/src/
COPY package.json ${LAMBDA_TASK_ROOT}/

# Install ALL dependencies including AI libs
RUN npm install --production

# Set handler
CMD ["src/handler-markdown.handler"]
```

Build and deploy:

```bash
docker build -t file-processor-lambda:latest -f Dockerfile.lambda .

# LocalStack Pro: Push to ECR
aws ecr create-repository --repository-name file-processor-lambda \
  --endpoint-url=http://localhost:4566

docker tag file-processor-lambda:latest \
  localhost:4566/file-processor-lambda:latest

docker push localhost:4566/file-processor-lambda:latest
```

## Environment Variables

```bash
# Lambda Configuration
AWS_REGION=us-east-1
S3_BUCKET_NAME=file-uploads
ELASTICSEARCH_NODE=http://opensearch:9200
ELASTICSEARCH_INDEX=file-chunks
ELASTICSEARCH_USERNAME=admin
ELASTICSEARCH_PASSWORD=admin

# Chunking Configuration
CHUNK_SIZE=1000              # Characters per chunk
CHUNK_OVERLAP=200            # Overlap between chunks

# AI Configuration
ENABLE_EMBEDDINGS=true       # Generate embeddings
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2  # Model name
EMBEDDING_DIMS=384           # Vector dimensions

# Cache Configuration
ENABLE_TMP_CACHE=true        # Use /tmp for caching
TMP_CACHE_TTL=3600           # Cache TTL (1 hour)

# Performance
NODE_OPTIONS="--max-old-space-size=1024"  # Node.js memory limit
```

## Resource Requirements

### Lambda Configuration

```hcl
resource "aws_lambda_function" "file_processor" {
  memory_size = 1024    # 1GB RAM
  timeout     = 300     # 5 minutes
  
  ephemeral_storage {
    size = 2048  # 2GB /tmp storage for model caching
  }
}
```

### Cost Estimation (AWS)

**Without Embeddings:**
- Memory: 512MB
- Duration: ~2s per file
- Cost: ~$0.0000083 per request

**With Embeddings:**
- Memory: 1024MB
- Duration: ~10s per file
- Cost: ~$0.000083 per request
- **10x more expensive** but enables AI search

**LocalStack:** Free! 😊

## Testing Layer

```bash
# Test layer structure
unzip -l ai-dependencies-layer.zip

# Should see:
#   nodejs/node_modules/@xenova/...
#   nodejs/node_modules/langchain/...
#   nodejs/package.json

# Test Lambda with layer
aws lambda invoke \
  --function-name file-processor \
  --payload '{"Records":[{"body":"..."}]}' \
  response.json \
  --endpoint-url=http://localhost:4566

# Check logs
aws logs tail /aws/lambda/file-processor --follow \
  --endpoint-url=http://localhost:4566
```

## Model Caching Strategy

Models are downloaded to `/tmp` on first invocation and reused:

```javascript
// First invocation (cold start)
// - Download model: ~3s
// - Load model: ~2s
// - Process: ~5s
// Total: ~10s

// Subsequent invocations (warm container)
// - Model already loaded: 0s
// - Process: ~5s
// Total: ~5s (50% faster!)
```

### Optimization: Pre-warm Containers

```bash
# Invoke function with dummy payload to warm up
aws lambda invoke \
  --function-name file-processor \
  --payload '{"warmup":true}' \
  /dev/null \
  --endpoint-url=http://localhost:4566

# Container stays warm for ~15 minutes
# Subsequent real invocations are faster
```

## Troubleshooting

### Error: "Cannot find module '@xenova/transformers'"

**Solution:** Layer not attached or incorrect structure

```bash
# Check layer structure
unzip -l layer.zip | grep transformers

# Should be: nodejs/node_modules/@xenova/transformers/...
# NOT: node_modules/@xenova/transformers/...
```

### Error: "Task timed out after 60 seconds"

**Solution:** Increase timeout

```hcl
resource "aws_lambda_function" "file_processor" {
  timeout = 300  # 5 minutes
}
```

### Error: "JavaScript heap out of memory"

**Solution:** Increase memory

```hcl
resource "aws_lambda_function" "file_processor" {
  memory_size = 1536  # 1.5GB
}
```

### Error: "No space left on device"

**Solution:** Increase ephemeral storage

```hcl
resource "aws_lambda_function" "file_processor" {
  ephemeral_storage {
    size = 2048  # 2GB
  }
}
```

## Build Script

Create `build-layer.sh`:

```bash
#!/bin/bash
set -e

echo "Building AI dependencies layer..."

# Clean previous build
rm -rf layers/ai-dependencies
rm -f layers/ai-dependencies-layer.zip

# Create structure
mkdir -p layers/ai-dependencies/nodejs
cd layers/ai-dependencies/nodejs

# Initialize package
cat > package.json << EOF
{
  "name": "ai-dependencies-layer",
  "version": "1.0.0",
  "dependencies": {
    "@xenova/transformers": "^2.11.0",
    "langchain": "^0.1.25",
    "@langchain/textsplitters": "^0.0.1",
    "marked": "^11.0.0",
    "markdown-it": "^14.0.0"
  }
}
EOF

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Package layer
cd ..
echo "Creating layer archive..."
zip -r ../ai-dependencies-layer.zip nodejs

echo "✓ Layer created: layers/ai-dependencies-layer.zip"
echo "  Size: $(du -h ../ai-dependencies-layer.zip | cut -f1)"

# Upload to S3 (LocalStack)
if [ "$1" == "--deploy" ]; then
  echo "Uploading to S3..."
  aws s3 cp ../ai-dependencies-layer.zip s3://lambda-layers/ \
    --endpoint-url=http://localhost:4566
  
  echo "Creating layer version..."
  aws lambda publish-layer-version \
    --layer-name ai-dependencies \
    --content S3Bucket=lambda-layers,S3Key=ai-dependencies-layer.zip \
    --compatible-runtimes nodejs18.x nodejs20.x \
    --endpoint-url=http://localhost:4566
  
  echo "✓ Layer deployed!"
fi
```

Run:

```bash
chmod +x build-layer.sh
./build-layer.sh --deploy
```

## Summary

### Without Layer (Not Recommended)
- ❌ Bundle everything → exceed size limit
- ❌ Slow cold starts
- ❌ Difficult to update dependencies

### With Layer (Recommended)
- ✅ Separate heavy dependencies
- ✅ Faster deployments (function code only)
- ✅ Reusable across functions
- ✅ Independent versioning

### Deployment Flow

```
1. Build Layer
   └─ build-layer.sh
   
2. Deploy Layer
   └─ aws lambda publish-layer-version
   
3. Build Function Code
   └─ Only lightweight code + AWS SDK
   
4. Deploy Function
   └─ Reference layer ARN
   
5. Invoke Function
   └─ Layer + Function code combined at runtime
```
