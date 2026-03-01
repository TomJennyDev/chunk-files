# System Architecture

## 🏛️ High-Level Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                    File Processing System                          │
│          Local Development Stack (LocalStack + Docker)             │
└───────────────────────────────────────────────────────────────────┘

                          ┌──────────────┐
                          │   Client     │
                          │  (Browser/   │
                          │   curl/API)  │
                          └──────┬───────┘
                                 │ HTTP
                                 │
                    ┌────────────▼──────────────┐
                    │    Load Balancer          │
                    │   (Optional - Future)     │
                    └────────────┬──────────────┘
                                 │
                                 │
            ┌────────────────────▼────────────────────┐
            │         NestJS API Service              │
            │        Port 3000 (TypeScript)           │
            │                                         │
            │  ┌─────────────────────────────────┐   │
            │  │  Presentation Layer             │   │
            │  │  • FileController               │   │
            │  │  • HealthController             │   │
            │  │  • Validators                   │   │
            │  └────────────┬────────────────────┘   │
            │               │                         │
            │  ┌────────────▼────────────────────┐   │
            │  │  Application Layer              │   │
            │  │  • UploadFileUseCase            │   │
            │  │  • SearchFilesUseCase           │   │
            │  │  • GetFileStatusUseCase         │   │
            │  └────────────┬────────────────────┘   │
            │               │                         │
            │  ┌────────────▼────────────────────┐   │
            │  │  Domain Layer                   │   │
            │  │  • File Entity                  │   │
            │  │  • Port Interfaces              │   │
            │  └────────────┬────────────────────┘   │
            │               │                         │
            │  ┌────────────▼────────────────────┐   │
            │  │  Infrastructure Layer           │   │
            │  │  • S3Adapter                    │   │
            │  │  • SQSAdapter                   │   │
            │  │  • ElasticsearchAdapter         │   │
            │  │  • InMemoryFileRepository       │   │
            │  └─────────────────────────────────┘   │
            └─────────────┬───────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         │                │                │
    ┌────▼─────┐   ┌─────▼──────┐   ┌────▼─────────────┐
    │    S3    │   │    SQS     │   │ Elasticsearch    │
    │ Storage  │   │   Queue    │   │  Search Engine   │
    │          │   │            │   │                  │
    │ Port:N/A │   │  Port:N/A  │   │   Port: 9200     │
    └────┬─────┘   └─────┬──────┘   └──────────────────┘
         │               │
         │    LocalStack │
         │    Port: 4566 │
         │               │
         └───────┬───────┘
                 │
                 │ SQS Event
                 │ Source Mapping
                 │
         ┌───────▼────────┐
         │  Lambda Worker │
         │ file-processor │
         │  Node.js 20.x  │
         │  1024MB / 300s │
         └───────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼────┐  ┌───▼────┐  ┌───▼──────────┐
│   S3   │  │Process │  │Elasticsearch │
│Download│  │ Chunk  │  │   Index      │
└────────┘  └────────┘  └──────────────┘
```

---

## 🔧 Component Details

### 1. API Layer (NestJS)

**Hexagonal Architecture (Ports & Adapters)**

```
┌─────────────────────────────────────────────────────────┐
│                    NestJS Application                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Presentation Layer (Inbound)              │  │
│  ├──────────────────────────────────────────────────┤  │
│  │  • FileController                                 │  │
│  │    - POST /files/upload                           │  │
│  │    - GET  /files/:fileId/status                   │  │
│  │    - GET  /files/search                           │  │
│  │                                                    │  │
│  │  • HealthController                               │  │
│  │    - GET  /health                                 │  │
│  │                                                    │  │
│  │  • Validators                                     │  │
│  │    - CustomFileTypeValidator                      │  │
│  └────────────────────┬─────────────────────────────┘  │
│                       │                                 │
│  ┌────────────────────▼─────────────────────────────┐  │
│  │         Application Layer (Use Cases)            │  │
│  ├──────────────────────────────────────────────────┤  │
│  │  • UploadFileUseCase                             │  │
│  │    1. Upload to S3                                │  │
│  │    2. Send SQS message                            │  │
│  │    3. Save to repository                          │  │
│  │                                                    │  │
│  │  • SearchFilesUseCase                            │  │
│  │    1. Query Elasticsearch                         │  │
│  │    2. Format results                              │  │
│  │                                                    │  │
│  │  • GetFileStatusUseCase                          │  │
│  │    1. Query repository                            │  │
│  │    2. Return file status                          │  │
│  └────────────────────┬─────────────────────────────┘  │
│                       │                                 │
│  ┌────────────────────▼─────────────────────────────┐  │
│  │            Domain Layer (Core)                   │  │
│  ├──────────────────────────────────────────────────┤  │
│  │  • File Entity                                   │  │
│  │    - fileId: string                               │  │
│  │    - fileName: string                             │  │
│  │    - fileSize: number                             │  │
│  │    - status: FileStatus                           │  │
│  │                                                    │  │
│  │  • Port Interfaces (Abstractions)                │  │
│  │    - IStoragePort                                 │  │
│  │    - IQueuePort                                   │  │
│  │    - ISearchPort                                  │  │
│  │    - IFileRepository                              │  │
│  └────────────────────┬─────────────────────────────┘  │
│                       │                                 │
│  ┌────────────────────▼─────────────────────────────┐  │
│  │      Infrastructure Layer (Adapters)             │  │
│  ├──────────────────────────────────────────────────┤  │
│  │  Outbound Adapters:                              │  │
│  │                                                    │  │
│  │  • S3Adapter (IStoragePort)                      │  │
│  │    - uploadFile()                                 │  │
│  │    - getFile()                                    │  │
│  │                                                    │  │
│  │  • SQSAdapter (IQueuePort)                       │  │
│  │    - sendMessage()                                │  │
│  │                                                    │  │
│  │  • ElasticsearchAdapter (ISearchPort)            │  │
│  │    - searchChunks()                               │  │
│  │    - indexChunk()                                 │  │
│  │                                                    │  │
│  │  • InMemoryFileRepository (IFileRepository)      │  │
│  │    - save()                                       │  │
│  │    - findById()                                   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Key Design Patterns:**
- ✅ **Hexagonal Architecture**: Business logic isolated from infrastructure
- ✅ **Dependency Inversion**: Use cases depend on abstractions (ports), not implementations
- ✅ **Single Responsibility**: Each use case handles one business operation
- ✅ **Ports & Adapters**: Easy to swap implementations (e.g., S3 → Google Cloud Storage)

---

### 2. Lambda Worker

**Processing Pipeline:**

```
┌────────────────────────────────────────────────────────────┐
│              Lambda Function: file-processor-worker         │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Entry Point: exports.handler                              │
│  ┌──────────────────────────────────────────────────────┐ │
│  │                                                       │ │
│  │  1. Receive SQS Event                                │ │
│  │     ├─ event.Records[] (up to 5 messages)            │ │
│  │     └─ Parse message body (JSON)                     │ │
│  │                                                       │ │
│  │  2. Process Each Record                              │ │
│  │     ├─ Extract fileId, fileName, s3Key               │ │
│  │     └─ Call processRecord()                          │ │
│  │                                                       │ │
│  └────────────────┬─────────────────────────────────────┘ │
│                   │                                        │
│  ┌────────────────▼─────────────────────────────────────┐ │
│  │  processRecord(record)                               │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │                                                       │ │
│  │  Step 1: Download from S3                            │ │
│  │  ┌────────────────────────────────────────────────┐ │ │
│  │  │  // Check cache first (warm container)         │ │ │
│  │  │  let buffer = await getCachedFile(s3Key)       │ │ │
│  │  │  if (!buffer) {                                 │ │ │
│  │  │    buffer = await downloadFromS3(s3Key)        │ │ │
│  │  │    await saveCachedFile(s3Key, buffer)         │ │ │
│  │  │  }                                              │ │ │
│  │  │                                                 │ │ │
│  │  │  • GetObjectCommand                             │ │ │
│  │  │  • Stream to Buffer                             │ │ │
│  │  │  • /tmp cache for warm containers               │ │ │
│  │  └────────────────────────────────────────────────┘ │ │
│  │                   │                                  │ │
│  │  Step 2: Detect File Type & Chunk                  │ │
│  │  ┌────────────────▼────────────────────────────────┐ │ │
│  │  │  if (isMarkdown(fileName)) {                   │ │ │
│  │  │    // Intelligent markdown chunking             │ │ │
│  │  │    chunks = await createMarkdownChunks(...)    │ │ │
│  │  │    // - Semantic splitting                      │ │ │
│  │  │    // - Preserve headings & structure           │ │ │
│  │  │    // - Generate AI embeddings (384-dim)        │ │ │
│  │  │    // - Track position metadata                 │ │ │
│  │  │  } else {                                        │ │ │
│  │  │    // Simple chunking for other files           │ │ │
│  │  │    chunks = chunkBuffer(buffer, message)       │ │ │
│  │  │  }                                              │ │ │
│  │  │                                                 │ │ │
│  │  │  Algorithm:                                     │ │ │
│  │  │  • Markdown: CHUNK_SIZE = 1000 chars            │ │ │
│  │  │  • Markdown: CHUNK_OVERLAP = 200 chars          │ │ │
│  │  │  • Binary: BYTE_CHUNK_SIZE = 5MB                │ │ │
│  │  │  • Binary: BYTE_CHUNK_OVERLAP = 100 bytes       │ │ │
│  │  │  • AI Embeddings: all-MiniLM-L6-v2 (384 dims)  │ │ │
│  │  └────────────────────────────────────────────────┘ │ │
│  │                   │                                  │ │
│  │  Step 3: Index to Elasticsearch                     │ │
│  │  ┌────────────────▼────────────────────────────────┐ │ │
│  │  │  await indexChunks(chunks)                     │ │ │
│  │  │                                                 │ │ │
│  │  │  • Check if chunks array is empty               │ │ │
│  │  │  • Build bulk operations array                  │ │ │
│  │  │  • Call esClient.bulk()                         │ │ │
│  │  │  • Handle errors                                │ │ │
│  │  └────────────────────────────────────────────────┘ │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Error Handling:                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  • Try-catch per record                              │ │
│  │  • Report batch item failures                        │ │
│  │  • Failed messages return to queue                   │ │
│  │  • Successful messages deleted from queue            │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**Lambda Handler Variants:**

```javascript
// 1. handler.js - Basic chunking (original)
//    - Fixed-size chunks (5MB)
//    - Simple overlap (100 bytes)
//    - Text-only indexing

// 2. handler-optimized.js - With caching
//    - Global client reuse
//    - In-memory metadata cache
//    - /tmp file cache
//    - Connection pooling

// 3. handler-markdown.js - AI-powered (ACTIVE DEFAULT)
//    - Markdown structure parsing
//    - Semantic chunking (LangChain)
//    - AI embeddings (all-MiniLM-L6-v2)
//    - Position tracking for scroll-to
//    - Hybrid search support

// Supporting modules:
// - markdown-chunker.js: Intelligent markdown processing
// - search-service.js: Text/Semantic/Hybrid search
```

**Chunk Algorithm Details:**

```javascript
Input: File buffer (28,089 bytes), CHUNK_SIZE (5MB), OVERLAP (100 bytes)

Iteration 1:
  startByte = 0
  endByte = min(0 + 5,242,880, 28,089) = 28,089
  chunkContent = buffer[0:28,089]
  
  Chunk 0: {
    fileId: "02c3fe01-9be3-4fe8-9e3a-33b6b32a8192",
    chunkIndex: 0,
    content: "# EKS Terraform Configuration...",
    startByte: 0,
    endByte: 28089,
    metadata: { fileName: "README.md", ... }
  }
  
  Next startByte = 28,089 - 100 = 27,989
  Since 27,989 >= 28,089, break loop

Output: [Chunk 0]  // Only 1 chunk for small file
```

**For larger files:**

```javascript
Input: File buffer (15MB), CHUNK_SIZE (5MB), OVERLAP (100 bytes)

Chunk 0: bytes 0 to 5,242,880
Chunk 1: bytes 5,242,780 to 10,485,660 (overlap 100 bytes with Chunk 0)
Chunk 2: bytes 10,485,560 to 15,728,540 (overlap 100 bytes with Chunk 1)

Total: 3 chunks
```

---

### 3. Storage Layer

#### S3 (LocalStack)

```
S3 Bucket: file-uploads
├── uploads/
│   ├── {fileId-1}/
│   │   └── {fileName}
│   ├── {fileId-2}/
│   │   └── {fileName}
│   └── {fileId-n}/
│       └── {fileName}
```

**Object Metadata:**
```json
{
  "ContentType": "text/markdown",
  "Metadata": {
    "originalName": "README.md",
    "size": "28089"
  }
}
```

#### SQS (LocalStack)

**Queue Configuration:**
```
Queue Name: file-processing-queue
Queue URL: http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/file-processing-queue
Type: Standard
Visibility Timeout: 300s (5 minutes)
Message Retention: 4 days
```

**Message Format:**
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

#### Elasticsearch

**Index Configuration:**
```json
{
  "index": "file-chunks",
  "mappings": {
    "properties": {
      "fileId": {
        "type": "keyword"
      },
      "chunkIndex": {
        "type": "long"
      },
      "content": {
        "type": "text",
        "analyzer": "standard"
      },
      "startByte": {
        "type": "long"
      },
      "endByte": {
        "type": "long"
      },
      "fileName": {
        "type": "keyword"
      },
      "metadata": {
        "properties": {
          "fileName": {"type": "keyword"},
          "fileSize": {"type": "long"},
          "chunkSize": {"type": "long"}
        }
      }
    }
  }
}
```

**Document Example:**
```json
{
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
}
```

---

## 🔄 Data Flow Diagrams

### Upload Flow

```
┌─────────┐                                 ┌─────────────┐
│ Client  │                                 │  NestJS API │
└────┬────┘                                 └──────┬──────┘
     │                                             │
     │  POST /files/upload                         │
     │  Content-Type: multipart/form-data          │
     ├────────────────────────────────────────────▶│
     │  file: README.md (28KB)                     │
     │                                             │
     │                              ┌──────────────┴──────────────┐
     │                              │ 1. Multer (memoryStorage)   │
     │                              │    - Parse multipart data    │
     │                              │    - Store in memory buffer  │
     │                              └──────────────┬──────────────┘
     │                                             │
     │                              ┌──────────────▼──────────────┐
     │                              │ 2. UploadFileUseCase        │
     │                              │    - Generate fileId (UUID)  │
     │                              │    - Build s3Key             │
     │                              └──────────────┬──────────────┘
     │                                             │
     │                              ┌──────────────▼──────────────┐
     │                              │ 3. S3Adapter.uploadFile()   │
     │                              │    - PutObjectCommand        │
     │                              │    - Body: file.buffer       │
     │                              └──────────────┬──────────────┘
     │                                             │
     │                                             │
     │                                      ┌──────▼──────┐
     │                                      │  LocalStack │
     │                                      │     S3      │
     │                                      └──────┬──────┘
     │                                             │
     │                              ┌──────────────▼──────────────┐
     │                              │ 4. SQSAdapter.sendMessage() │
     │                              │    - Build message JSON      │
     │                              │    - SendMessageCommand      │
     │                              └──────────────┬──────────────┘
     │                                             │
     │                                      ┌──────▼──────┐
     │                                      │  LocalStack │
     │                                      │     SQS     │
     │                                      └─────────────┘
     │                                             │
     │  ◀────────────────────────────────────────┤
     │  201 Created                                │
     │  {                                          │
     │    "statusCode": 201,                       │
     │    "message": "File uploaded successfully", │
     │    "data": {                                │
     │      "fileId": "02c3fe01...",               │
     │      "fileName": "README.md",               │
     │      "fileSize": 28089,                     │
     │      "s3Key": "uploads/...",                │
     │      "status": "uploaded"                   │
     │    }                                        │
     │  }                                          │
     │                                             │
```

### Processing Flow

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐
│     SQS     │         │ Lambda Worker │         │ Elasticsearch│
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘
       │                        │                        │
       │  Event Source Mapping  │                        │
       │  (Polls every ~1s)     │                        │
       ├───────────────────────▶│                        │
       │  Records: [            │                        │
       │    { body: "{...}" }   │                        │
       │  ]                     │                        │
       │                        │                        │
       │          ┌─────────────┴──────────────┐         │
       │          │ 1. Parse SQS message       │         │
       │          │    - Extract fileId        │         │
       │          │    - Extract s3Key         │         │
       │          └─────────────┬──────────────┘         │
       │                        │                        │
       │          ┌─────────────▼──────────────┐         │
       │          │ 2. Download from S3        │         │
       │          │    - GetObjectCommand      │         │
       │          │    - Stream to Buffer      │         │
       │          └─────────────┬──────────────┘         │
       │                        │                        │
       │                  ┌─────▼──────┐                 │
       │                  │ LocalStack │                 │
       │                  │     S3     │                 │
       │                  └─────┬──────┘                 │
       │                        │                        │
       │          ┌─────────────▼──────────────┐         │
       │          │ 3. Chunk File              │         │
       │          │    - MD: 1000 chars         │         │
       │          │    - Binary: 5MB chunks     │         │
       │          │    - AI embeddings          │         │
       │          │    - Generate metadata     │         │
       │          └─────────────┬──────────────┘         │
       │                        │                        │
       │          ┌─────────────▼──────────────┐         │
       │          │ 4. Bulk Index              │         │
       │          │    - Format operations     │         │
       │          │    - Call esClient.bulk()  │         │
       │          └─────────────┬──────────────┘         │
       │                        │                        │
       │                        ├───────────────────────▶│
       │                        │  POST /_bulk           │
       │                        │  {                     │
       │                        │    index: {...},       │
       │                        │    chunk: {...}        │
       │                        │  }                     │
       │                        │                        │
       │                        │ ◀──────────────────────┤
       │                        │  { errors: false }     │
       │                        │                        │
       │          ┌─────────────▼──────────────┐         │
       │          │ 5. Return Success          │         │
       │          │    - Delete from queue     │         │
       │          └────────────────────────────┘         │
       │                                                  │
       │  ◀─────── Message Deleted ──────────            │
       │                                                  │
```

### Search Flow

```
┌─────────┐         ┌─────────────┐         ┌──────────────┐
│ Client  │         │  NestJS API │         │ Elasticsearch│
└────┬────┘         └──────┬──────┘         └──────┬───────┘
     │                     │                        │
     │  GET /files/search │                        │
     │  ?text=terraform   │                        │
     │  &fileId=02c3fe... │                        │
     ├────────────────────▶│                        │
     │                     │                        │
     │       ┌─────────────┴──────────────┐         │
     │       │ 1. SearchFilesUseCase      │         │
     │       │    - Validate params       │         │
     │       │    - Build search query    │         │
     │       └─────────────┬──────────────┘         │
     │                     │                        │
     │       ┌─────────────▼──────────────┐         │
     │       │ 2. ElasticsearchAdapter    │         │
     │       │    - searchChunks()        │         │
     │       └─────────────┬──────────────┘         │
     │                     │                        │
     │                     ├───────────────────────▶│
     │                     │  POST /file-chunks/   │
     │                     │       _search         │
     │                     │  {                    │
     │                     │    query: {           │
     │                     │      bool: {          │
     │                     │        must: [        │
     │                     │          { match: {   │
     │                     │            content:   │
     │                     │            "terraform"│
     │                     │          }},          │
     │                     │          { term: {    │
     │                     │            fileId:    │
     │                     │            "02c3..."  │
     │                     │          }}           │
     │                     │        ]              │
     │                     │      }                │
     │                     │    }                  │
     │                     │  }                    │
     │                     │                        │
     │                     │ ◀──────────────────────┤
     │                     │  {                     │
     │                     │    took: 106,          │
     │                     │    hits: {             │
     │                     │      total: 1,         │
     │                     │      hits: [...]       │
     │                     │    }                   │
     │                     │  }                     │
     │                     │                        │
     │       ┌─────────────▼──────────────┐         │
     │       │ 3. Format Response         │         │
     │       │    - Map hits to DTOs      │         │
     │       │    - Add metadata           │         │
     │       └─────────────┬──────────────┘         │
     │                     │                        │
     │  ◀──────────────────┤                        │
     │  200 OK             │                        │
     │  {                  │                        │
     │    "statusCode": 200,                        │
     │    "data": {                                 │
     │      "total": 1,                             │
     │      "took": 106,                            │
     │      "results": [{                           │
     │        "fileId": "02c3fe01...",              │
     │        "chunkIndex": 0,                      │
     │        "content": "# EKS...",                │
     │        "fileName": "README.md"               │
     │      }]                                      │
     │    }                                         │
     │  }                                           │
     │                                              │
```

---

## 🔐 Security Architecture

### Current (Development)

```
┌───────────────────────────────────────────────────┐
│            Development Security Model              │
├───────────────────────────────────────────────────┤
│                                                    │
│  ❌ No Authentication                              │
│  ❌ No Authorization                               │
│  ❌ Hardcoded Credentials (test/test)              │
│  ❌ No TLS/SSL                                     │
│  ❌ No Rate Limiting                               │
│  ❌ No Input Sanitization                          │
│  ❌ No File Type Validation                        │
│  ❌ Public Endpoints                               │
│                                                    │
│  ⚠️  DO NOT USE IN PRODUCTION                      │
│                                                    │
└───────────────────────────────────────────────────┘
```

### Production Ready

```
┌───────────────────────────────────────────────────┐
│           Production Security Model                │
├───────────────────────────────────────────────────┤
│                                                    │
│  ✅ JWT Authentication                             │
│  ✅ Role-Based Access Control (RBAC)              │
│  ✅ IAM Roles & Policies                          │
│  ✅ TLS 1.3 Encryption                            │
│  ✅ Rate Limiting (API Gateway)                   │
│  ✅ Input Validation & Sanitization               │
│  ✅ File Type & Size Validation                   │
│  ✅ Virus Scanning (ClamAV)                       │
│  ✅ WAF (Web Application Firewall)                │
│  ✅ VPC & Security Groups                         │
│  ✅ Encrypted S3 Buckets (SSE-S3)                 │
│  ✅ CloudWatch Logging & Monitoring               │
│  ✅ Secrets Manager for Credentials               │
│                                                    │
└───────────────────────────────────────────────────┘
```

---

## 📊 Scalability Considerations

### Current Limitations

| Component | Limitation | Impact |
|-----------|------------|--------|
| API | Single instance | No horizontal scaling |
| Lambda | LocalStack limits | Reduced concurrency |
| Elasticsearch | Single node | No replication, SPOF |
| S3/SQS | LocalStack | Not production-grade |

### Production Scaling

```
┌────────────────────────────────────────────────────┐
│              Production Architecture                │
├────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐      ┌──────────────┐           │
│  │ CloudFront   │      │  Route 53    │           │
│  │   (CDN)      │      │    (DNS)     │           │
│  └──────┬───────┘      └──────┬───────┘           │
│         │                     │                    │
│  ┌──────▼─────────────────────▼───────┐           │
│  │     Application Load Balancer      │           │
│  │     (ALB) + WAF                    │           │
│  └──────┬─────────────────────────────┘           │
│         │                                          │
│  ┌──────▼──────────────────────────┐              │
│  │  API Gateway (REST API)          │              │
│  │  - Rate limiting                 │              │
│  │  - API keys                      │              │
│  │  - Usage plans                   │              │
│  └──────┬──────────────────────────┘              │
│         │                                          │
│  ┌──────▼──────────────────────────┐              │
│  │  ECS/Fargate Cluster             │              │
│  │  ┌──────┐ ┌──────┐ ┌──────┐     │              │
│  │  │ API  │ │ API  │ │ API  │     │              │
│  │  │Task 1│ │Task 2│ │Task N│     │              │
│  │  └──────┘ └──────┘ └──────┘     │              │
│  │  Auto Scaling (CPU/Memory)       │              │
│  └──────┬──────────────────────────┘              │
│         │                                          │
│  ┌──────┼──────────────────────────┐              │
│  │      │   AWS Services           │              │
│  │  ┌───▼────┐  ┌────────┐  ┌──────▼──────┐      │
│  │  │   S3   │  │  SQS   │  │ OpenSearch  │      │
│  │  │(Multi- │  │(FIFO + │  │  Service    │      │
│  │  │ AZ)    │  │ DLQ)   │  │  (3-node    │      │
│  │  └───┬────┘  └───┬────┘  │   cluster)  │      │
│  │      │           │        └─────────────┘      │
│  │      │           │                             │
│  │  ┌───▼───────────▼────────┐                    │
│  │  │     Lambda Workers     │                    │
│  │  │  ┌──────┐ ┌──────┐     │                    │
│  │  │  │Worker│ │Worker│ ... │                    │
│  │  │  │  1   │ │  N   │     │                    │
│  │  │  └──────┘ └──────┘     │                    │
│  │  │  Provisioned Concurrency│                    │
│  │  └────────────────────────┘                    │
│  └─────────────────────────────────────────────── │
└────────────────────────────────────────────────────┘
```

**Scaling Metrics:**

| Metric | Current | Production Target |
|--------|---------|-------------------|
| API Throughput | ~10 req/s | 1,000+ req/s |
| Lambda Concurrency | 1-2 | 100+ |
| File Processing | Sequential | Parallel (batch) |
| Search Latency | ~100ms | <50ms |
| Storage | LocalStack | Multi-region S3 |

---

## 🔧 Technology Stack

### Backend
- **NestJS** 10.4.22 - Progressive Node.js framework
- **TypeScript** 5.7.3 - Type-safe JavaScript
- **Node.js** 20.x - Runtime environment

### AWS SDK
- **@aws-sdk/client-s3** 3.699.0 - S3 operations
- **@aws-sdk/client-sqs** 3.699.0 - SQS messaging

### Search
- **@elastic/elasticsearch** 8.11.0 - Search client

### File Upload
- **Multer** 1.4.5-lts.1 - Multipart/form-data handling
- **memoryStorage** - In-memory file buffering

### DevOps
- **Docker** - Containerization
- **LocalStack** 4.12.0 - AWS emulation
- **Terraform** 1.9+ - Infrastructure as Code
- **Elasticsearch** 8.11.0 - Search engine

### Development
- **pnpm** - Package manager
- **ts-node** - TypeScript execution
- **nodemon** - Auto-reload

---

**Last Updated**: February 18, 2026  
**Version**: 2.0  
**Status**: ✅ Complete
