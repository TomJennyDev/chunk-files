# Sequence Diagrams — Key System Flows

## Flow 1: File Upload (Complete)

```mermaid
sequenceDiagram
    autonumber
    participant U as 👤 User / Browser
    participant W as 🖥️ React Web App
    participant API as ⚙️ NestJS API :3000
    participant VAL as 🔒 Validators
    participant UC as 📋 UploadFileUseCase
    participant S3 as 📦 S3 Storage
    participant REPO as 🗄️ InMemoryRepo
    participant SQS as 📨 SQS Queue
    participant OTEL as 📡 OTel Collector

    U->>W: Select file & click Upload
    W->>W: Create FormData<br/>(multipart/form-data)
    
    W->>+API: POST /files/upload<br/>Content-Type: multipart/form-data<br/>traceparent: 00-{traceId}-{spanId}-01
    
    Note over API: OTel auto-creates span:<br/>HTTP POST /files/upload
    
    API->>VAL: ParseFilePipe validation
    VAL->>VAL: CustomFileTypeValidator<br/>• Check MIME type<br/>• Check file size ≤ 500MB
    
    alt Validation Failed
        VAL-->>API: throw BadRequestException
        API-->>W: 400 Bad Request
        W-->>U: Show error message
    end

    VAL-->>API: ✅ File valid
    API->>+UC: execute(file)
    
    UC->>UC: Generate fileId = UUID.v4()
    UC->>UC: Build s3Key = "uploads/{fileId}/{fileName}"
    
    UC->>+S3: PutObject(bucket, key, buffer)
    Note over UC,S3: OTel span: S3.PutObject
    S3-->>-UC: ✅ ETag, VersionId
    
    UC->>+REPO: save({ fileId, fileName, fileSize, status: UPLOADED })
    REPO-->>-UC: ✅ Stored in Map
    
    UC->>+SQS: SendMessage({ fileId, s3Key, fileName, fileSize, mimeType })
    Note over UC,SQS: OTel span: SQS.SendMessage
    SQS-->>-UC: ✅ MessageId
    
    UC-->>-API: { fileId, status: UPLOADED }
    
    API->>OTEL: Export spans + logs
    API-->>-W: 201 Created { fileId, status: "UPLOADED" }
    W-->>U: ✅ Upload successful<br/>Show fileId, start polling status
```

---

## Flow 2: Lambda Processing (Cold Start vs Warm)

```mermaid
sequenceDiagram
    autonumber
    participant SQS as 📨 SQS Queue
    participant LM as ⚡ Lambda Manager
    participant ENV as 🔧 Environment Setup
    participant HANDLER as 📋 handler-markdown.js
    participant CACHE as 💾 /tmp Cache (2GB)
    participant S3 as 📦 S3 Storage
    participant CHUNKER as ✂️ Markdown Chunker
    participant EMBED as 🧠 AI Embeddings
    participant ES as 🔍 Elasticsearch

    SQS->>LM: Invoke (batch of up to 5 messages)
    
    alt Cold Start (~500ms)
        LM->>ENV: Initialize runtime
        ENV->>ENV: Load Node.js 20.x
        ENV->>ENV: Import dependencies<br/>(elasticsearch, markdown-it)
        ENV->>ENV: Create ES client<br/>(connection pool)
        ENV->>ENV: Initialize /tmp cache
        Note over LM,ENV: Cold start overhead: ~300-500ms
    else Warm Container (~5ms)
        Note over LM: Reuse existing container<br/>Dependencies already loaded<br/>ES client connection alive
    end

    loop For each SQS message in batch
        LM->>+HANDLER: handler(event, context)
        HANDLER->>HANDLER: Parse message body<br/>{ fileId, s3Key, fileName }
        
        HANDLER->>CACHE: Check /tmp/{fileId}
        alt Cache HIT
            CACHE-->>HANDLER: Return cached file buffer
            Note over HANDLER,CACHE: Skip S3 download (~180ms saved)
        else Cache MISS
            HANDLER->>+S3: GetObject(bucket, s3Key)
            S3-->>-HANDLER: File buffer
            HANDLER->>CACHE: Write to /tmp/{fileId}
        end

        HANDLER->>+CHUNKER: chunk(content, options)
        Note over CHUNKER: Options:<br/>chunkSize: 1000 chars<br/>overlap: 200 chars<br/>respectBoundaries: true
        
        CHUNKER->>CHUNKER: Split by headings (H1-H6)
        CHUNKER->>CHUNKER: Sub-split large sections<br/>by paragraphs
        CHUNKER->>CHUNKER: Add overlap between chunks
        CHUNKER->>CHUNKER: Attach metadata<br/>(sectionTitle, charStart, charEnd)
        CHUNKER-->>-HANDLER: chunks[]

        alt Embeddings Enabled
            loop For each chunk (batched)
                HANDLER->>+EMBED: generateEmbedding(chunk.content)
                EMBED-->>-HANDLER: float[384]
            end
        end

        HANDLER->>+ES: Bulk Index<br/>POST /_bulk<br/>{ index: "file-chunks" }
        ES-->>-HANDLER: { items: [...], errors: false }
        
        HANDLER-->>-LM: ✅ Success
    end
    
    LM->>SQS: Delete processed messages
```

---

## Flow 3: Search — Full-text, Semantic, Hybrid

```mermaid
sequenceDiagram
    autonumber
    participant U as 👤 User
    participant W as 🖥️ React Web App
    participant API as ⚙️ NestJS API
    participant UC as 📋 SearchFilesUseCase
    participant ES as 🔍 Elasticsearch

    U->>W: Type search query<br/>"how to configure webpack"
    W->>W: Debounce 300ms
    
    W->>+API: GET /files/search?text=how+to+configure+webpack&page=1&size=10
    
    API->>+UC: execute({ text, page, size })
    
    UC->>UC: Detect search type
    
    alt Full-Text Search (default)
        UC->>+ES: POST /file-chunks/_search
        Note over UC,ES: {<br/>  "query": {<br/>    "multi_match": {<br/>      "query": "how to configure webpack",<br/>      "fields": ["content^2", "fileName", "sectionTitle"],<br/>      "type": "best_fields",<br/>      "fuzziness": "AUTO"<br/>    }<br/>  },<br/>  "highlight": {<br/>    "fields": { "content": { "fragment_size": 150 } }<br/>  }<br/>}
    else Semantic Search (vector)
        UC->>UC: Generate query embedding
        UC->>+ES: POST /file-chunks/_search
        Note over UC,ES: {<br/>  "knn": {<br/>    "field": "embedding",<br/>    "query_vector": [0.12, -0.34, ...],<br/>    "k": 10,<br/>    "num_candidates": 100<br/>  }<br/>}
    else Hybrid Search (RRF)
        UC->>+ES: POST /file-chunks/_search
        Note over UC,ES: Reciprocal Rank Fusion:<br/>• BM25 full-text score<br/>• kNN vector score<br/>• Combined ranking
    end

    ES-->>-UC: { hits: { total, hits: [...] } }
    
    UC->>UC: Format results<br/>• Extract highlights<br/>• Map to response DTO<br/>• Calculate pagination

    UC-->>-API: { results, total, page, totalPages }
    API-->>-W: 200 OK { results, total, page, totalPages }
    
    W->>W: Render search results<br/>• Highlighted snippets<br/>• File name + section<br/>• Relevance score
    W-->>U: Display results
```

---

## Flow 4: MCP Tool Interaction

```mermaid
sequenceDiagram
    autonumber
    participant AI as 🤖 Claude Desktop
    participant MCP as 🔌 MCP Server (stdio)
    participant API as ⚙️ NestJS API
    participant S3 as 📦 S3
    participant ES as 🔍 Elasticsearch

    AI->>MCP: tools/list
    MCP-->>AI: Available tools:<br/>• upload_file<br/>• search_files<br/>• get_file_status<br/>• analyze_document

    AI->>AI: User asks: "Search for webpack config docs"
    AI->>+MCP: tools/call: search_files<br/>{ "query": "webpack config", "limit": 5 }
    
    MCP->>+API: GET /files/search?text=webpack+config&size=5
    API->>ES: Elasticsearch query
    ES-->>API: Search results
    API-->>-MCP: { results: [...] }
    
    MCP-->>-AI: Formatted search results<br/>(content snippets, scores, metadata)
    
    AI->>AI: User asks: "Upload my README.md"
    AI->>+MCP: tools/call: upload_file<br/>{ "filePath": "/path/to/README.md" }
    
    MCP->>MCP: Read file from disk
    MCP->>+API: POST /files/upload<br/>(multipart/form-data)
    API->>S3: PutObject
    API-->>-MCP: { fileId: "abc-123", status: "UPLOADED" }
    
    MCP-->>-AI: ✅ File uploaded: abc-123
    
    AI->>+MCP: tools/call: get_file_status<br/>{ "fileId": "abc-123" }
    MCP->>+API: GET /files/abc-123/status
    API-->>-MCP: { status: "COMPLETED", chunks: 42 }
    MCP-->>-AI: Processing complete: 42 chunks indexed

    AI->>+MCP: resources/read: file://abc-123
    MCP->>+API: GET /files/abc-123
    API-->>-MCP: File metadata + chunk summary
    MCP-->>-AI: File resource data
```

---

## Flow 5: Error Handling & Retry

```mermaid
sequenceDiagram
    autonumber
    participant SQS as 📨 SQS Queue
    participant Lambda as ⚡ Lambda
    participant S3 as 📦 S3
    participant ES as 🔍 Elasticsearch
    participant DLQ as 💀 Dead Letter Queue
    participant CW as 📊 CloudWatch
    participant ALERT as 🔔 Alert System

    SQS->>+Lambda: Deliver message (attempt 1)
    Lambda->>+S3: GetObject
    S3-->>-Lambda: ❌ NoSuchKey error
    
    Lambda->>CW: Log error: S3 object not found
    Lambda-->>-SQS: ❌ Throw error (message not deleted)
    
    Note over SQS: visibility_timeout: 300s<br/>Message becomes visible again

    SQS->>+Lambda: Deliver message (attempt 2)
    Lambda->>S3: GetObject
    S3-->>Lambda: ✅ File content
    Lambda->>Lambda: Chunk file (success)
    Lambda->>+ES: Bulk Index
    ES-->>-Lambda: ❌ 429 Too Many Requests
    
    Lambda->>Lambda: Exponential backoff<br/>wait 1s → 2s → 4s
    Lambda->>+ES: Retry Bulk Index
    ES-->>-Lambda: ❌ 503 Service Unavailable
    
    Lambda->>CW: Log error: ES unavailable
    Lambda-->>-SQS: ❌ Throw error

    Note over SQS: receive_count = 2

    SQS->>+Lambda: Deliver message (attempt 3 — final)
    Lambda->>S3: GetObject
    S3-->>Lambda: ✅ File content
    Lambda->>Lambda: Chunk file
    Lambda->>+ES: Bulk Index
    ES-->>-Lambda: ❌ Circuit breaker open
    Lambda->>CW: Log error: ES circuit breaker
    Lambda-->>-SQS: ❌ Throw error

    Note over SQS: receive_count >= maxReceiveCount (3)
    
    SQS->>DLQ: Move message to DLQ
    DLQ->>CW: CloudWatch Metric:<br/>ApproximateNumberOfMessagesVisible > 0
    CW->>ALERT: ⚠️ CRITICAL: Messages in DLQ
    ALERT->>ALERT: Notify Slack + PagerDuty
```
