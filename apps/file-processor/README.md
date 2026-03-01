# File Processor Application

Ứng dụng xử lý files lớn với Hexagonal Architecture (Ports & Adapters), sử dụng NestJS, S3, SQS, và Elasticsearch.

## 🏗️ Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          FILE PROCESSOR SYSTEM                            │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────┐                    ┌──────────────────────────────────────┐
│   Client    │                    │        NestJS API Service            │
│  (Browser,  │────Upload File────▶│    (Hexagonal Architecture)          │
│   cURL)     │                    │  - Validate file                     │
└─────────────┘                    │  - Save metadata (in-memory)         │
                                   │  - Upload to S3                      │
                                   │  - Send SQS message                  │
                                   └────────┬─────────────────────┬───────┘
                                            │                     │
                                            │                     │
                    ┌───────────────────────▼─────┐      ┌───────▼────────┐
                    │      Amazon S3              │      │   Amazon SQS    │
                    │  Bucket: file-uploads       │      │  Queue: file-   │
                    │  - Store original files     │      │  processing-    │
                    │  - Versioning enabled       │      │  queue          │
                    │  - Lifecycle policies       │      │  - DLQ enabled  │
                    └───────────┬─────────────────┘      └───────┬─────────┘
                                │                                 │
                                │ Download                        │ Trigger
                                │ file                            │ (Event Source
                                │                                 │  Mapping)
                    ┌───────────▼─────────────────────────────────▼─────────┐
                    │         AWS Lambda Function                           │
                    │      (file-processor-worker)                          │
                    │                                                       │
                    │  1. Receive SQS message (batch: 5)                   │
                    │  2. Download file from S3                            │
                    │  3. Split file into chunks (5MB each, 100B overlap)  │
                    │  4. Index chunks to OpenSearch                        │
                    │  5. Report batch failures if any                      │
                    │                                                       │
                    │  Runtime: Node.js 20.x                               │
                    │  Memory: 512 MB                                       │
                    │  Timeout: 300s (5 min)                               │
                    └──────────────────────────┬────────────────────────────┘
                                               │
                                               │ Bulk Index
                                               │ (chunks)
                    ┌──────────────────────────▼────────────────────────────┐
                    │         OpenSearch / Elasticsearch                    │
                    │         Index: file-chunks                            │
                    │                                                       │
                    │  - Full-text search on content                        │
                    │  - Metadata filtering                                 │
                    │  - Aggregations & analytics                           │
                    └───────────────────────────────────────────────────────┘
                                               │
                                               │ Search
                                               │ Query
                    ┌──────────────────────────▼────────────────────────────┐
                    │          NestJS API Service                           │
                    │    GET /files/search?text=keyword                     │
                    │    GET /files/:id/status                              │
                    └──────────────────────────┬────────────────────────────┘
                                               │
                                               │ Results
                                               ▼
                                        ┌─────────────┐
                                        │   Client    │
                                        └─────────────┘
```

### Hexagonal Architecture (Ports & Adapters)

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│            (REST API Controllers, Validators)                │
│  • POST /files/upload                                        │
│  • GET /files/:id/status                                     │
│  • GET /files/search                                         │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP Requests
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     Application Layer                        │
│                  (Use Cases - Business Logic)                │
│  • UploadFileUseCase                                         │
│  • GetFileStatusUseCase                                      │
│  • SearchFilesUseCase                                        │
│  • ProcessFileUseCase (Lambda only)                          │
└──────────────────────────┬──────────────────────────────────┘
                           │ Calls ports
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                        Domain Layer                          │
│               (Entities + Port Interfaces)                   │
│                                                              │
│  Entities:                  Ports (Interfaces):              │
│  • FileUpload              • IStoragePort                    │
│  • FileChunk               • IQueuePort                      │
│                            • ISearchPort                     │
│                            • IFileRepositoryPort             │
└──────────────────────────┬──────────────────────────────────┘
                           │ Implemented by
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   Infrastructure Layer                       │
│              (Adapters - External Systems)                   │
│                                                              │
│  • S3Adapter           → AWS S3                              │
│  • SQSAdapter          → AWS SQS                             │
│  • ElasticsearchAdapter → OpenSearch/Elasticsearch           │
│  • InMemoryRepository  → Application Memory                  │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Features

- ✅ **Upload files lớn** (lên đến 500MB)
- ✅ **Chunking thông minh** với overlap để tránh mất context
- ✅ **Async processing** qua SQS queue
- ✅ **Full-text search** với Elasticsearch
- ✅ **Scalable workers** - multiple worker instances
- ✅ **Progress tracking** - theo dõi tiến trình xử lý
- ✅ **Hexagonal Architecture** - dễ maintain và test
- ✅ **LocalStack integration** - test locally miễn phí

## 📋 Prerequisites

- Docker & Docker Compose
- Node.js 20+ (nếu chạy local)
- LocalStack (via Docker)

## 🛠️ Setup & Run

### Option 1: Run with LocalStack (Recommended for Development)

#### Step 1: Start LocalStack Only
```bash
cd localstack/file-processor

# Start LocalStack
docker-compose up -d localstack

# Wait for services to be ready (~20s)
curl http://localhost:4566/_localstack/health
```

#### Step 2: Deploy Infrastructure with Terraform
```bash
cd ../terraform/file-processor

# Initialize Terraform
make init

# Deploy all resources (S3, SQS, Lambda, IAM)
make setup

# Verify resources
make status
```

This will create:
- ✅ S3 bucket: `file-uploads`
- ✅ SQS queue: `file-processing-queue` + DLQ
- ✅ Lambda function: `file-processor-worker`
- ✅ IAM roles and policies
- ✅ CloudWatch log groups

#### Step 3: Run NestJS API Locally
```bash
cd ../../file-processor

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start API in development mode
pnpm run start:dev
```

API will be available at:
- **API**: http://localhost:3000
- **Swagger**: http://localhost:3000/api/docs
- **Health**: http://localhost:3000/health

### Option 2: Run Everything with Docker (Legacy - Worker Container)

> **Note**: This option uses worker containers instead of Lambda. Not recommended for production simulation.

```bash
cd localstack/file-processor

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Verify Setup

```bash
# Check API
curl http://localhost:3000/health

# Check LocalStack
curl http://localhost:4566/_localstack/health

# Check Lambda function
awslocal lambda list-functions

# Check SQS queue
awslocal sqs list-queues
```

## 📖 API Documentation

### Swagger UI
Open: http://localhost:3000/api/docs

### Endpoints

#### 1. Upload File
```bash
POST /files/upload
Content-Type: multipart/form-data

curl -X POST http://localhost:3000/files/upload \
  -F "file=@sample.txt"
```

**Response:**
```json
{
  "statusCode": 201,
  "message": "File uploaded successfully",
  "data": {
    "fileId": "uuid-here",
    "fileName": "sample.txt",
    "fileSize": 1048576,
    "s3Key": "uploads/uuid-here/sample.txt",
    "status": "uploaded",
    "uploadedAt": "2024-01-24T10:00:00.000Z"
  }
}
```

#### 2. Get File Status
```bash
GET /files/:fileId/status

curl http://localhost:3000/files/abc-123-def/status
```

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "fileId": "abc-123-def",
    "fileName": "sample.txt",
    "status": "processing",
    "totalChunks": 10,
    "processedChunks": 7,
    "progress": 70,
    "uploadedAt": "2024-01-24T10:00:00.000Z"
  }
}
```

#### 3. Search Files
```bash
GET /files/search?text=keyword&page=0&size=10

curl "http://localhost:3000/files/search?text=hello&page=0&size=10"
```

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "total": 42,
    "page": 0,
    "size": 10,
    "took": 15,
    "results": [
      {
        "id": "chunk-id",
        "fileId": "file-id",
        "chunkIndex": 0,
        "content": "Preview of content...",
        "fileName": "sample.txt",
        "startByte": 0,
        "endByte": 5242880
      }
    ]
  }
}
```

## 🔄 Processing Workflow

### Upload & Processing Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         UPLOAD WORKFLOW                                  │
└─────────────────────────────────────────────────────────────────────────┘

Step 1: Client Upload
   │
   │ POST /files/upload (multipart/form-data)
   │ File: sample.pdf (50MB)
   │
   ▼
┌──────────────────────────────────────┐
│  NestJS API - FileController         │
│  1. Validate file:                   │
│     - Type: .txt, .pdf, .doc, .md    │
│     - Size: <= 500MB                 │
│  2. Generate fileId (UUID)           │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│  UploadFileUseCase                   │
│  1. Upload to S3:                    │
│     Key: uploads/{fileId}/{filename} │
│  2. Save metadata (in-memory):       │
│     - fileId, fileName, size, status │
│  3. Send SQS message:                │
│     {fileId, s3Key, fileName, ...}   │
└────────────┬─────────────────────────┘
             │
             │ Response to client
             │ {fileId, status: "uploaded"}
             ▼
        [Client receives fileId]


┌─────────────────────────────────────────────────────────────────────────┐
│                      PROCESSING WORKFLOW (Lambda)                        │
└─────────────────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────┐
   │   SQS Queue (Auto-trigger)      │
   │   - Batch size: 5 messages      │
   │   - Visibility timeout: 30min   │
   │   - DLQ after 3 retries         │
   └────────────┬────────────────────┘
                │
                │ Lambda Event Source Mapping
                │ (Automatic polling)
                ▼
   ┌─────────────────────────────────┐
   │  Lambda: file-processor-worker  │
   │                                 │
   │  for each message:              │
   │    1. Parse message body        │
   │    2. Download file from S3     │
   │    3. Split into chunks:        │
   │       - Size: 5MB               │
   │       - Overlap: 100 bytes      │
   │       - Example: 50MB file      │
   │         → 10 chunks             │
   │    4. Bulk index to OpenSearch  │
   │    5. Mark message as processed │
   │                                 │
   │  If error → Return batch failure│
   └────────────┬────────────────────┘
                │
                ▼
   ┌─────────────────────────────────┐
   │    OpenSearch Index             │
   │    - 10 documents created       │
   │    - Each: fileId, chunkIndex,  │
   │      content, metadata          │
   └─────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                         SEARCH WORKFLOW                                  │
└─────────────────────────────────────────────────────────────────────────┘

Client Query
   │
   │ GET /files/search?text=keyword&page=0&size=10
   │
   ▼
┌──────────────────────────────────────┐
│  SearchFilesUseCase                  │
│  1. Build OpenSearch query           │
│  2. Execute search                   │
│  3. Format results                   │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│  OpenSearch                          │
│  - Full-text search on content       │
│  - Filter by fileId, fileName        │
│  - Pagination support                │
└────────────┬─────────────────────────┘
             │
             │ Response
             │ {total, results[]}
             ▼
        [Client receives results]
```

### Status Tracking Flow

```
Client → GET /files/{fileId}/status
   │
   ▼
GetFileStatusUseCase
   │
   ▼
FileRepository (in-memory)
   │
   ▼
Response: {
  fileId, fileName, status,
  totalChunks, processedChunks,
  progress: 70%
}
```

### Error Handling Flow

```
Lambda Processing Error
   │
   │ Message not deleted from SQS
   │ Visibility timeout expires
   │
   ▼
Message becomes visible again
   │
   ▼
Lambda retries (max 3 times)
   │
   │ Still failing?
   │
   ▼
Message moved to DLQ
   │
   ▼
Manual investigation/replay
```

## 🧪 Testing

### Manual Testing

#### 1. Upload a test file
```bash
# Create test file
echo "This is a test file for chunking" > test.txt

# Upload
curl -X POST http://localhost:3000/files/upload \
  -F "file=@test.txt"

# Save fileId from response
FILE_ID="<your-file-id>"
```

#### 2. Check processing status
```bash
# Poll status until completed
curl http://localhost:3000/files/$FILE_ID/status
```

#### 3. Search content
```bash
# Search for text
curl "http://localhost:3000/files/search?text=test"

# Search by fileId
curl "http://localhost:3000/files/search?fileId=$FILE_ID"
```

### Load Testing

```bash
# Upload multiple files
for i in {1..10}; do
  echo "File content $i" > "test-$i.txt"
  curl -X POST http://localhost:3000/files/upload \
    -F "file=@test-$i.txt"
done
```

## 🐛 Debugging

### Check Logs

```bash
# API logs
docker-compose logs -f api

# Worker logs
docker-compose logs -f worker

# LocalStack logs
docker-compose logs -f localstack

# Elasticsearch logs
docker-compose logs -f elasticsearch
```

### Inspect S3

```bash
# List buckets
aws --endpoint-url=http://localhost:4566 s3 ls

# List files
aws --endpoint-url=http://localhost:4566 s3 ls s3://file-uploads --recursive
```

### Inspect SQS

```bash
# List queues
aws --endpoint-url=http://localhost:4566 sqs list-queues

# Get queue attributes
aws --endpoint-url=http://localhost:4566 sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/file-processing-queue \
  --attribute-names All
```

### Inspect Elasticsearch

```bash
# Check indices
curl http://localhost:9200/_cat/indices?v

# Check document count
curl http://localhost:9200/file-chunks/_count

# Search all documents
curl http://localhost:9200/file-chunks/_search?pretty
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_PORT` | API port | 3000 |
| `CHUNK_SIZE` | Chunk size in bytes | 5242880 (5MB) |
| `CHUNK_OVERLAP` | Overlap between chunks | 100 bytes |
| `MAX_FILE_SIZE` | Max file size | 524288000 (500MB) |
| `WORKER_CONCURRENCY` | Worker concurrent jobs | 5 |
| `SQS_POLLING_WAIT_TIME` | Long polling wait time | 20s |
| `SQS_MAX_MESSAGES` | Max messages per poll | 10 |

### Scaling Workers

```yaml
# docker-compose.yml
worker:
  deploy:
    replicas: 5  # Run 5 worker instances
```

Or manually:
```bash
docker-compose up -d --scale worker=5
```

## 🏗️ Project Structure

```
file-processor/
├── src/
│   ├── domain/                 # Domain layer
│   │   ├── entities/          # Business entities
│   │   └── ports/             # Interfaces/contracts
│   ├── application/           # Application layer
│   │   └── use-cases/        # Business logic
│   ├── infrastructure/        # Infrastructure layer
│   │   ├── adapters/         # External service adapters
│   │   └── repositories/     # Data persistence
│   ├── presentation/          # Presentation layer
│   │   └── controllers/      # HTTP controllers
│   ├── app.module.ts         # Main module
│   ├── main.ts               # API bootstrap
│   └── worker.ts             # Worker bootstrap
├── docker-compose.yml        # Docker orchestration
├── Dockerfile               # Container image
├── package.json            # Dependencies
└── README.md              # This file
```

## 🔧 Development

### Run Locally (without Docker)

```bash
# Start LocalStack and Elasticsearch
docker-compose up -d localstack elasticsearch

# Install dependencies
npm install

# Run API
npm run start:dev

# Run worker (in another terminal)
npm run start:worker:dev
```

### Hot Reload

Both API and Worker support hot reload in development mode.

## 📊 Performance Tips

1. **Chunk Size**: Adjust `CHUNK_SIZE` based on file types
   - Text files: 1-5 MB
   - Binary files: 10-50 MB

2. **Worker Scaling**: Scale workers based on queue depth
   ```bash
   docker-compose up -d --scale worker=10
   ```

3. **Elasticsearch**: Tune bulk indexing batch size
   - Default: 100 chunks per batch
   - Adjust in `ProcessFileUseCase`

4. **SQS**: Optimize polling
   - Use long polling (20s)
   - Adjust visibility timeout based on processing time

## 🚀 Production Deployment

### 1. Build Production Image

```bash
docker build --target production -t file-processor:latest .
```

### 2. Use Real AWS Services

Update `.env`:
```env
AWS_ENDPOINT=  # Remove or leave empty for real AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
S3_BUCKET_NAME=prod-file-uploads
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/prod-file-queue
ELASTICSEARCH_NODE=https://your-elasticsearch-cluster
```

### 3. Use Real Database

Replace `InMemoryFileRepository` with PostgreSQL/MongoDB adapter.

## 🤝 Contributing

Contributions welcome! Please follow the architecture patterns.

## 📝 License

MIT

## 🙏 Acknowledgments

- NestJS framework
- LocalStack for AWS emulation
- Elasticsearch for search capabilities
