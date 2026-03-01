# Data Flow & Processing Pipeline

## End-to-End Data Flow

Toàn bộ luồng dữ liệu từ khi user upload file đến khi có thể search — bao gồm cả happy path và error handling.

```mermaid
flowchart TB
    classDef user fill:#2563eb,color:#fff,stroke:#1e40af
    classDef api fill:#7c3aed,color:#fff,stroke:#5b21b6
    classDef aws fill:#f59e0b,color:#000,stroke:#d97706
    classDef lambda fill:#db2777,color:#fff,stroke:#9d174d
    classDef search fill:#059669,color:#fff,stroke:#047857
    classDef error fill:#dc2626,color:#fff,stroke:#b91c1c
    classDef decision fill:#6366f1,color:#fff,stroke:#4f46e5

    START([👤 User]) -->|"multipart/form-data"| UPLOAD["POST /files/upload"]
    
    UPLOAD --> VALIDATE{"Validate File<br/>• Type check<br/>• Size ≤ 500MB"}
    VALIDATE -->|"❌ Invalid"| REJECT["400 Bad Request"]:::error
    VALIDATE -->|"✅ Valid"| GEN_ID["Generate UUID v4<br/>fileId"]
    
    GEN_ID --> S3_UP["S3: PutObject<br/>Key: uploads/{fileId}/{fileName}"]
    S3_UP --> SAVE_META["InMemoryRepo: save()<br/>status: UPLOADED"]
    SAVE_META --> SQS_SEND["SQS: SendMessage<br/>{fileId, s3Key, fileName,<br/>fileSize, mimeType}"]
    SQS_SEND --> RESPONSE["201 Created<br/>{fileId, status: UPLOADED}"]
    
    RESPONSE -->|"Client polls status"| STATUS_CHECK["GET /files/:id/status"]
    
    SQS_SEND -.->|"Event Source Mapping<br/>batch size: 5"| LAMBDA_INVOKE["⚡ Lambda Invoked"]
    
    subgraph LAMBDA_PROCESS["Lambda Processing Pipeline"]
        direction TB
        LAMBDA_INVOKE --> CHECK_CACHE{"Check /tmp<br/>Cache?"}
        CHECK_CACHE -->|"Cache HIT"| USE_CACHE["Use cached file"]
        CHECK_CACHE -->|"Cache MISS"| S3_DOWN["S3: GetObject<br/>Download file"]
        S3_DOWN --> WRITE_CACHE["Write to /tmp cache"]
        WRITE_CACHE --> USE_CACHE
        
        USE_CACHE --> DETECT_TYPE{"Detect File Type"}
        DETECT_TYPE -->|"Markdown (.md)"| MD_CHUNK["Heading-Aware Chunker<br/>• Split by # headings<br/>• Respect paragraphs<br/>• chunk_size: 1000 chars<br/>• overlap: 200 chars"]
        DETECT_TYPE -->|"Binary / Other"| BYTE_CHUNK["Byte Chunker<br/>• Fixed 5MB chunks<br/>• Base64 encode"]
        
        MD_CHUNK --> EMBED_CHECK{"AI Embeddings<br/>Enabled?"}
        BYTE_CHUNK --> EMBED_CHECK
        
        EMBED_CHECK -->|"Yes"| GEN_EMBED["Generate Embeddings<br/>(vector: 384 dims)"]
        EMBED_CHECK -->|"No"| PREP_BULK["Prepare Bulk Payload"]
        GEN_EMBED --> PREP_BULK
        
        PREP_BULK --> ES_BULK["Elasticsearch: Bulk Index<br/>Index: file-chunks<br/>• content<br/>• metadata<br/>• embedding (optional)"]
    end
    
    ES_BULK --> INDEX_OK{"Index<br/>Success?"}
    INDEX_OK -->|"✅"| DONE["✅ Processing Complete<br/>SQS: Delete Message"]
    INDEX_OK -->|"❌"| RETRY{"Retry<br/>Count < 3?"}
    RETRY -->|"Yes"| ES_BULK
    RETRY -->|"No"| DLQ["Move to DLQ<br/>(Dead Letter Queue)"]:::error

    %% Search Flow
    subgraph SEARCH_FLOW["Search Pipeline"]
        direction TB
        SEARCH_START([👤 User]) -->|"GET /files/search?text=query"| PARSE_QUERY["Parse Search Query"]
        PARSE_QUERY --> SEARCH_TYPE{"Search Type"}
        SEARCH_TYPE -->|"text only"| FTS["Full-Text Search<br/>multi_match: content, fileName"]
        SEARCH_TYPE -->|"semantic"| VECTOR["Vector Search (kNN)<br/>cosine similarity"]
        SEARCH_TYPE -->|"hybrid"| HYBRID["Hybrid Search<br/>RRF: text + vector"]
        FTS --> ES_QUERY["Elasticsearch Query"]
        VECTOR --> ES_QUERY
        HYBRID --> ES_QUERY
        ES_QUERY --> FORMAT["Format Results<br/>• highlights<br/>• pagination<br/>• scores"]
        FORMAT --> SEARCH_RESP["200 OK<br/>{results, total, page}"]
    end

    class START,SEARCH_START user
    class UPLOAD,GEN_ID,SAVE_META,RESPONSE,STATUS_CHECK api
    class S3_UP,SQS_SEND,S3_DOWN aws
    class LAMBDA_INVOKE,CHECK_CACHE,USE_CACHE,WRITE_CACHE,MD_CHUNK,BYTE_CHUNK,GEN_EMBED,PREP_BULK lambda
    class ES_BULK,FTS,VECTOR,HYBRID,ES_QUERY search
    class VALIDATE,DETECT_TYPE,EMBED_CHECK,INDEX_OK,RETRY,SEARCH_TYPE decision
```

---

## Markdown Chunking Strategy Detail

```mermaid
flowchart LR
    classDef input fill:#3b82f6,color:#fff
    classDef process fill:#8b5cf6,color:#fff
    classDef output fill:#22c55e,color:#fff
    classDef config fill:#f59e0b,color:#000

    DOC["📄 Markdown<br/>Document"]:::input --> PARSE["Parse Structure<br/>• Headings (H1-H6)<br/>• Paragraphs<br/>• Code blocks<br/>• Lists"]:::process
    
    PARSE --> SPLIT["Split by Headings<br/>(Section boundaries)"]:::process
    
    SPLIT --> CHECK{"Section ><br/>chunk_size?"}
    CHECK -->|"Yes"| SUBSPLIT["Sub-split by<br/>paragraphs"]:::process
    CHECK -->|"No"| KEEP["Keep as single chunk"]:::process
    
    SUBSPLIT --> OVERLAP["Add Overlap<br/>200 chars from<br/>previous chunk"]:::process
    KEEP --> OVERLAP
    
    OVERLAP --> METADATA["Attach Metadata<br/>• fileId, chunkIndex<br/>• heading hierarchy<br/>• charStart, charEnd<br/>• sectionTitle"]:::process
    
    METADATA --> CHUNKS["📦 Chunks Array<br/>Ready for indexing"]:::output

    CONFIG["⚙️ Config<br/>chunk_size: 1000<br/>overlap: 200<br/>respect_boundaries: true"]:::config -.-> SPLIT
    CONFIG -.-> CHECK
    CONFIG -.-> OVERLAP
```

---

## Elasticsearch Index Schema

```mermaid
erDiagram
    FILE_CHUNKS {
        string _id PK "Auto-generated"
        string fileId FK "UUID — source file reference"
        string fileName "Original file name"
        text content "Chunk text content (analyzed)"
        integer chunkIndex "Position in source file"
        string mimeType "File MIME type"
        integer fileSize "Original file size (bytes)"
        string s3Key "S3 object key"
        string sectionTitle "Heading context"
        integer charStart "Character offset start"
        integer charEnd "Character offset end"
        float[] embedding "384-dim vector (optional)"
        date createdAt "Index timestamp"
    }
    
    FILE_METADATA {
        string fileId PK "UUID v4"
        string fileName "Original filename"
        integer fileSize "File size in bytes"
        string mimeType "MIME type"
        string status "UPLOADED | PROCESSING | COMPLETED | FAILED"
        string s3Key "S3 object key"
        date uploadedAt "Upload timestamp"
        date processedAt "Completion timestamp"
    }
    
    FILE_METADATA ||--o{ FILE_CHUNKS : "produces"
```
