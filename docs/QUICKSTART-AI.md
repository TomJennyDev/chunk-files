# Quick Start - AI-Powered Markdown Processing

Setup hệ thống với **intelligent markdown chunking** và **AI embeddings** để search semantic.

---

## 🎯 Prerequisites

```bash
✅ Docker Desktop (running)
✅ Node.js 20.x+
✅ pnpm/npm
✅ AWS CLI v2 (optional, để verify)
✅ 4GB+ RAM (Elasticsearch ~512MB + AI model)
✅ 15GB+ disk (cho dependencies)
```

---

## ⚡ Setup with AI Features

### 1. Start Services (2 minutes)

```bash
cd d:/devops/terraform/terraform-eks/localstack

# Start tất cả services (LocalStack + Elasticsearch + Kibana)
docker compose up -d

# Verify containers are healthy
docker compose ps
# Expected: localstack (healthy), elasticsearch (healthy), kibana (starting)

# Verify Elasticsearch
curl http://localhost:9200/
```

> **Lưu ý**: Elasticsearch đã nằm trong `docker-compose.yml` cùng LocalStack và Kibana, không cần chạy riêng.

### 2. Provision Infrastructure (Optional)

> **Lưu ý**: Bước này optional nếu bạn deploy Lambda bằng `deploy.sh` trực tiếp. S3 bucket và SQS queue được tạo tự động bởi `init-aws.sh` khi LocalStack khởi động.

```bash
# Nếu dùng Terraform:
cd terraform/file-processor
terraform init
terraform apply -auto-approve

# Hoặc tạo resources thủ công:
aws --endpoint-url=http://localhost:4566 s3 mb s3://file-uploads
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name file-processing-queue --region us-east-1
```

### 3. Install Lambda Dependencies (3-5 minutes)

⚠️ **Important**: AI dependencies lớn (~500MB)

```bash
cd ../../file-processor-lambda

# Install all dependencies including AI libs
npm install

# Verify AI packages installed
ls -lh node_modules/@xenova
ls -lh node_modules/langchain
```

**Expected packages:**
- `@xenova/transformers` - ML model runtime
- `langchain` - Document processing
- `@langchain/textsplitters` - Markdown splitters
- `marked` - Markdown parser

### 4. Deploy Lambda with AI Handler (1 minute)

```bash
# Deploy with handler-markdown.js
bash deploy.sh
```

**Script sẽ:**
- ✅ Package toàn bộ dependencies (include AI)
- ✅ Create Lambda với 1024MB RAM
- ✅ Set environment variables cho AI
- ✅ Connect với SQS trigger

**Expected output:**
```
✅ Lambda function deployed successfully!

📋 Function Details:
  Name: file-processor-worker
  Handler: src/handler-markdown.handler
  Runtime: nodejs20.x
  Timeout: 300s
  Memory: 1024MB
  SQS Trigger: Enabled (batch size: 5)
```

### 5. Start API (1 minute)

> **Quan trọng**: Start API **trước** khi deploy Lambda. NestJS sẽ tự động tạo Elasticsearch index `file-chunks` với proper mappings (bao gồm `dense_vector` cho embeddings) khi startup.

```bash
cd ../file-processor

# Install if first time
pnpm install

# Start dev mode
pnpm run start:dev
```

> **Lưu ý**: Kiểm tra `.env` phải có `ELASTICSEARCH_NODE=http://localhost:9200` (port 9200, KHÔNG phải 4566).

---

## 🧪 Test AI Features

### 1. Upload Markdown File

```bash
# Create test markdown
cat > test-doc.md << 'EOF'
# Getting Started with Elasticsearch

Elasticsearch is a distributed search engine built on Apache Lucene.

## Installation

You can install Elasticsearch using Docker:

```bash
docker run -d -p 9200:9200 elasticsearch:8.11.0
```

## Key Features

- **Full-text search** with relevance scoring
- **Real-time indexing** and queries
- **Distributed architecture** for scalability
- **RESTful API** for easy integration

## Use Cases

1. Log analytics with ELK stack
2. E-commerce product search
3. Security SIEM solutions
4. Application monitoring (APM)
EOF

# Upload
curl -X POST http://localhost:3000/files/upload \
  -F "file=@test-doc.md"
```

**Response:**
```json
{
  "statusCode": 201,
  "message": "File uploaded successfully",
  "data": {
    "fileId": "abc-123",
    "fileName": "test-doc.md",
    "status": "uploaded"
  }
}
```

### 2. Wait for AI Processing

Lambda sẽ:
1. Download file từ S3 ⏱️ ~500ms
2. Detect markdown extension ⏱️ ~10ms
3. Parse markdown structure ⏱️ ~100ms
4. **Load AI model (first time)** ⏱️ ~3-5s
5. Create semantic chunks ⏱️ ~200ms
6. **Generate embeddings** ⏱️ ~500ms per chunk
7. Index to Elasticsearch ⏱️ ~300ms

**Total first run:** ~10-15s (cold start với AI model)
**Subsequent runs:** ~2-3s (warm container, model cached)

```bash
# Wait
sleep 15

# Check chunks created
curl "http://localhost:9200/file-chunks/_count"
```

**Expected:**
```json
{
  "count": 3,  // 3 semantic chunks from markdown
  "_shards": {
    "total": 1,
    "successful": 1
  }
}
```

### 3. Test Text Search

```bash
curl "http://localhost:3000/files/search?text=installation"
```

**Response shows:**
- Matching chunks với BM25 scoring
- Heading context
- Line numbers để scroll-to-position

### 4. View Chunk Details

```bash
curl "http://localhost:9200/file-chunks/_search?pretty" | less
```

**You should see:**
```json
{
  "hits": {
    "hits": [{
      "_source": {
        "content": "## Installation\n\nYou can install...",
        "heading": {
          "text": "Installation",
          "level": 2
        },
        "position": {
          "startLine": 5,
          "endLine": 11,
          "percentPosition": 25.5
        },
        "searchTerms": ["installation", "docker", "elasticsearch"],
        "embedding": [0.023, -0.156, ...], // 384-dim vector
        "metadata": {
          "hasCodeBlock": true,
          "headingCount": 1
        }
      }
    }]
  }
}
```

### 5. Check Lambda Logs

```bash
docker compose logs localstack --tail 100 | grep -i "lambda\|markdown\|embedding"
```

**Expected logs:**
```
Lambda invoked with event...
Processing file: test-doc.md
Using intelligent markdown chunker...
Loading embedding model...
Embedding model loaded
Parsing markdown structure...
Found 4 headings, 1 code blocks
Creating semantic chunks...
Generated 3 chunks
Generating embeddings...
Embeddings generated for 3 chunks
Indexed 3 chunks
```

---

## 🎯 AI Features Verification

### ✅ Checklist

- [ ] Lambda deployed với `handler-markdown.js`
- [ ] Memory = 1024MB (enough for AI model)
- [ ] ENABLE_EMBEDDINGS=true
- [ ] Dependencies include @xenova/transformers
- [ ] Index has `dense_vector` field (384 dims)
- [ ] Markdown files auto-detected
- [ ] Semantic chunking works (preserves headings)
- [ ] Embeddings generated (384-dim vectors)
- [ ] Search returns position metadata
- [ ] Lambda logs show "embedding model loaded"

### Performance Metrics

| Metric | Expected Value |
|--------|---------------|
| **Cold start** | 10-15s (first invocation) |
| **Warm start** | 2-3s (cached model) |
| **File download** | 200-500ms |
| **Markdown parsing** | 50-100ms |
| **Chunking** | 100-300ms |
| **Embedding generation** | 300-500ms per chunk |
| **ES indexing** | 200-400ms |
| **Memory usage** | 600-900MB (with model) |

---

## 🔍 Advanced Testing

### Test Semantic Search (Coming Soon)

> **Lưu ý**: Semantic search endpoint chưa được implement trong NestJS API. Hiện tại chỉ hỗ trợ text search qua `GET /files/search?text=...`.
> Embedding vectors được index bởi Lambda nhưng chưa có API endpoint để query chúng.

```bash
# Hiện tại dùng text search:
curl "http://localhost:3000/files/search?text=how+to+install+search+engine"

# Semantic search có thể query trực tiếp Elasticsearch:
curl -X POST "http://localhost:9200/file-chunks/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "knn": {
      "field": "embedding",
      "query_vector": [0.023, -0.156, ...],
      "k": 5,
      "num_candidates": 50
    }
  }'
```

### Test Scroll-to-Position

```javascript
// Frontend integration
const result = searchResults[0];

// Method 1: Line-based scrolling
editor.revealLineInCenter(result.position.startLine);

// Method 2: Percentage scrolling
const scrollPos = (result.position.percentPosition / 100) * totalHeight;
editor.setScrollTop(scrollPos);

// Method 3: Heading anchor
const anchor = result.heading?.id;
document.getElementById(anchor)?.scrollIntoView();
```

---

## 🐛 Troubleshooting

### Issue: "Cannot find module '@xenova/transformers'"

```bash
cd file-processor-lambda
npm install @xenova/transformers langchain @langchain/textsplitters
bash deploy.sh
```

### Issue: Lambda timeout (300s exceeded)

```bash
# File quá lớn hoặc too many chunks
# Check file size
aws --endpoint-url=http://localhost:4566 s3 ls s3://file-uploads/uploads/ --human-readable

# Option 1: Increase timeout
aws --endpoint-url=http://localhost:4566 lambda update-function-configuration \
  --function-name file-processor-worker \
  --timeout 600

# Option 2: Disable embeddings temporarily
aws --endpoint-url=http://localhost:4566 lambda update-function-configuration \
  --function-name file-processor-worker \
  --environment Variables="{..., ENABLE_EMBEDDINGS=false}"
```

### Issue: Out of memory (OOM)

```bash
# Increase memory
aws --endpoint-url=http://localhost:4566 lambda update-function-configuration \
  --function-name file-processor-worker \
  --memory-size 1536  # or 2048
```

### Issue: Embeddings not generated

```bash
# Check logs
docker compose logs localstack --tail 200 | grep "embedding"

# Verify environment
aws --endpoint-url=http://localhost:4566 lambda get-function-configuration \
  --function-name file-processor-worker \
  --query 'Environment.Variables'

# Should show:
{
  "ENABLE_EMBEDDINGS": "true",
  "CHUNK_SIZE": "1000",
  "CHUNK_OVERLAP": "200"
}
```

### Issue: Simple chunking used instead of semantic

```bash
# Check if markdown detected
docker compose logs localstack | grep "Using intelligent markdown chunker"

# If not found, check:
# 1. File extension (.md)
# 2. Handler is handler-markdown.js not handler.js

# Verify handler
aws --endpoint-url=http://localhost:4566 lambda get-function-configuration \
  --function-name file-processor-worker \
  --query 'Handler'

# Should return: "src/handler-markdown.handler"
```

---

## 📊 Cost Comparison

| Feature | Without AI | With AI |
|---------|-----------|---------|
| **Lambda Memory** | 512MB | 1024MB |
| **Cold Start** | 2-3s | 10-15s |
| **Warm Invocation** | 0.8s | 2-3s |
| **Cost per 10k files** | ~$5 | ~$15 |
| **Storage** | 50MB zip | 500MB zip |
| **Search Quality** | Keyword only | Semantic + Keyword |

**Trade-off:**
- 🔴 3x slower, 3x more expensive
- 🟢 Much better search relevance
- 🟢 Supports semantic queries
- 🟢 Scroll-to-position metadata

---

## 📚 Next Steps

1. **Read Full Documentation**
   - [Lambda Flow Sequence](./application/LAMBDA-FLOW-SEQUENCE.md) - Detailed flow với timing
   - [Markdown AI Guide](./application/README-MARKDOWN-AI.md) - Complete features
   - [Lambda Layer Setup](./application/LAMBDA-LAYER-SETUP.md) - Production deployment

2. **Try Advanced Features**
   - Implement hybrid search (text + semantic)
   - Add search-service.js for frontend
   - Test with large markdown files (> 100KB)
   - Measure performance metrics

3. **Optimize**
   - Setup Lambda layers for dependencies
   - Enable /tmp cache (ENABLE_TMP_CACHE=true)
   - Implement connection pooling
   - Add CloudWatch metrics

4. **Production Ready**
   - Deploy to real AWS (not LocalStack)
   - Use OpenSearch Serverless
   - Setup API Gateway with auth
   - Implement rate limiting

---

## 💡 Pro Tips

### Reduce Cold Start

```bash
# Pre-warm Lambda
aws --endpoint-url=http://localhost:4566 lambda invoke \
  --function-name file-processor-worker \
  --payload '{"warmup": true}' \
  response.json
```

### Monitor AI Processing

```bash
# Watch Elasticsearch index grow
watch -n 1 'curl -s http://localhost:9200/file-chunks/_count | jq'

# Monitor Lambda logs
docker compose logs -f localstack | grep -i "chunk\|embedding"
```

### Toggle AI Features

```bash
# Disable embeddings to speed up (loses semantic search)
aws --endpoint-url=http://localhost:4566 lambda update-function-configuration \
  --function-name file-processor-worker \
  --environment Variables='{
    ...,
    "ENABLE_EMBEDDINGS": "false"
  }'

# Enable cache to speed up
aws --endpoint-url=http://localhost:4566 lambda update-function-configuration \
  --function-name file-processor-worker \
  --environment Variables='{
    ...,
    "ENABLE_TMP_CACHE": "true",
    "TMP_CACHE_TTL": "3600"
  }'
```

---

**Setup Time:** 10-15 minutes (including AI dependencies)
**Difficulty:** Intermediate (requires understanding of AI/ML basics)
**Last Updated:** February 18, 2026

🎉 **Enjoy semantic search với AI-powered markdown processing!**
