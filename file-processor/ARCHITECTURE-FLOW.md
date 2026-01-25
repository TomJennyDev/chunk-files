# File Processor Application - Architecture Flow

## System Architecture Diagram

```mermaid
flowchart TB
    %% User interaction
    User["👤 User"]
    
    %% API Layer
    subgraph API["🚀 API Service (NestJS)"]
        direction TB
        Controller["FileController<br/>(Upload/Status/Search)"]
        UploadUC["UploadFileUseCase"]
        SearchUC["SearchFilesUseCase"]
        StatusUC["GetFileStatusUseCase"]
    end
    
    %% Storage Services
    subgraph Storage["💾 Storage Layer"]
        direction LR
        S3["Amazon S3<br/>(File Storage)"]
        Repo["In-Memory Repository<br/>(Metadata)"]
    end
    
    %% Queue
    Queue["📬 SQS Queue<br/>(Async Processing)"]
    
    %% Worker Service
    subgraph Worker["⚙️ Worker Service (Background)"]
        direction TB
        WorkerPoll["SQS Polling Loop"]
        ProcessUC["ProcessFileUseCase"]
        Chunker["File Chunker<br/>(5MB chunks + 100B overlap)"]
    end
    
    %% Search Service
    ES["🔍 Elasticsearch<br/>(Search & Indexing)"]
    
    %% Main Flow - Upload
    User -->|"1. Upload File<br/>(multipart/form-data)"| Controller
    Controller -->|"2. Execute"| UploadUC
    UploadUC -->|"3a. Store File"| S3
    UploadUC -->|"3b. Save Metadata<br/>(status: uploaded)"| Repo
    UploadUC -->|"4. Send Message<br/>{fileId, s3Key, size}"| Queue
    UploadUC -->|"5. Return<br/>{fileId, status}"| User
    
    %% Worker Flow - Processing
    Queue -->|"6. Poll Messages<br/>(long polling 20s)"| WorkerPoll
    WorkerPoll -->|"7. Execute"| ProcessUC
    ProcessUC -->|"8. Download File"| S3
    ProcessUC -->|"9. Split into Chunks"| Chunker
    Chunker -->|"10. Bulk Index<br/>(100 chunks/batch)"| ES
    ProcessUC -->|"11. Update Status<br/>(processing → completed)"| Repo
    
    %% Search Flow
    User -->|"12. Search Query"| Controller
    Controller -->|"13. Execute"| SearchUC
    SearchUC -->|"14. Full-text Search"| ES
    ES -->|"15. Return Chunks"| SearchUC
    SearchUC -->|"16. Results"| User
    
    %% Status Check Flow
    User -->|"17. Check Status"| Controller
    Controller -->|"18. Execute"| StatusUC
    StatusUC -->|"19. Get Metadata"| Repo
    StatusUC -->|"20. Return Progress"| User
    
    %% Styling
    classDef userClass fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    classDef apiClass fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef storageClass fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef queueClass fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef workerClass fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    classDef searchClass fill:#fce4ec,stroke:#880e4f,stroke-width:2px
    
    class User userClass
    class Controller,UploadUC,SearchUC,StatusUC apiClass
    class S3,Repo storageClass
    class Queue queueClass
    class WorkerPoll,ProcessUC,Chunker workerClass
    class ES searchClass
```

## Detailed Processing Flow

```mermaid
sequenceDiagram
    actor User
    participant API as API Service
    participant S3 as S3 Storage
    participant Repo as Repository
    participant SQS as SQS Queue
    participant Worker as Worker Service
    participant ES as Elasticsearch
    
    %% Upload Phase
    rect rgb(230, 245, 255)
        Note over User,ES: Phase 1: File Upload
        User->>+API: POST /files/upload<br/>(multipart file)
        API->>API: Validate file<br/>(size, type)
        API->>+S3: Upload file
        S3-->>-API: s3Key
        API->>+Repo: Save metadata<br/>(status: UPLOADED)
        Repo-->>-API: fileId
        API->>+SQS: Send message<br/>{fileId, s3Key, size}
        SQS-->>-API: messageId
        API-->>-User: 201 Created<br/>{fileId, status}
    end
    
    %% Processing Phase
    rect rgb(255, 248, 225)
        Note over User,ES: Phase 2: Background Processing
        loop Polling Loop (every 1s)
            Worker->>+SQS: Poll messages<br/>(long poll 20s)
            SQS-->>-Worker: message[]
        end
        
        alt Message Received
            Worker->>Worker: Update status: PROCESSING
            Worker->>+Repo: Update metadata
            Repo-->>-Worker: OK
            
            Worker->>+S3: Download file
            S3-->>-Worker: fileBuffer
            
            Worker->>Worker: Split into chunks<br/>(5MB + 100B overlap)
            
            loop For each batch (100 chunks)
                Worker->>+ES: Bulk index chunks
                ES-->>-Worker: indexed
                Worker->>+Repo: Update progress
                Repo-->>-Worker: OK
            end
            
            Worker->>+Repo: Update status: COMPLETED
            Repo-->>-Worker: OK
            
            Worker->>+SQS: Delete message
            SQS-->>-Worker: OK
        end
    end
    
    %% Search Phase
    rect rgb(248, 231, 255)
        Note over User,ES: Phase 3: Search & Retrieval
        User->>+API: GET /files/search?text=keyword
        API->>+ES: Full-text search
        ES-->>-API: chunks[]
        API-->>-User: 200 OK<br/>{results, total}
    end
    
    %% Status Check
    rect rgb(232, 245, 233)
        Note over User,ES: Phase 4: Status Tracking
        User->>+API: GET /files/:fileId/status
        API->>+Repo: Get metadata
        Repo-->>-API: fileUpload
        API-->>-User: 200 OK<br/>{status, progress}
    end
```

## Hexagonal Architecture Layers

```mermaid
flowchart TB
    subgraph Presentation["🎨 Presentation Layer"]
        direction LR
        FileCtrl["FileController"]
        HealthCtrl["HealthController"]
    end
    
    subgraph Application["📋 Application Layer (Use Cases)"]
        direction LR
        Upload["UploadFileUseCase"]
        Process["ProcessFileUseCase"]
        Search["SearchFilesUseCase"]
        Status["GetFileStatusUseCase"]
    end
    
    subgraph Domain["💎 Domain Layer"]
        direction TB
        subgraph Entities["Entities"]
            FileUpload["FileUpload"]
            FileChunk["FileChunk"]
        end
        subgraph Ports["Ports (Interfaces)"]
            IStorage["IStoragePort"]
            IQueue["IQueuePort"]
            ISearch["ISearchPort"]
            IRepo["IFileRepository"]
        end
    end
    
    subgraph Infrastructure["🔧 Infrastructure Layer (Adapters)"]
        direction LR
        S3Adapter["S3Adapter"]
        SQSAdapter["SQSAdapter"]
        ESAdapter["ElasticsearchAdapter"]
        RepoImpl["InMemoryFileRepository"]
    end
    
    subgraph External["☁️ External Services"]
        direction LR
        AWS["AWS S3"]
        SQS["AWS SQS"]
        ES["Elasticsearch"]
    end
    
    %% Connections
    Presentation --> Application
    Application --> Domain
    Domain --> Infrastructure
    Infrastructure --> External
    
    %% Specific connections
    FileCtrl -.->|depends on| Upload
    FileCtrl -.->|depends on| Search
    FileCtrl -.->|depends on| Status
    
    Upload -.->|uses| IStorage
    Upload -.->|uses| IQueue
    Upload -.->|uses| IRepo
    
    Process -.->|uses| IStorage
    Process -.->|uses| ISearch
    Process -.->|uses| IRepo
    
    Search -.->|uses| ISearch
    Status -.->|uses| IRepo
    
    S3Adapter -.->|implements| IStorage
    SQSAdapter -.->|implements| IQueue
    ESAdapter -.->|implements| ISearch
    RepoImpl -.->|implements| IRepo
    
    S3Adapter --> AWS
    SQSAdapter --> SQS
    ESAdapter --> ES
    
    %% Styling
    classDef presentationClass fill:#bbdefb,stroke:#1976d2,stroke-width:2px
    classDef applicationClass fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    classDef domainClass fill:#fff9c4,stroke:#f57c00,stroke-width:2px
    classDef infrastructureClass fill:#ffccbc,stroke:#d84315,stroke-width:2px
    classDef externalClass fill:#e1bee7,stroke:#7b1fa2,stroke-width:2px
    
    class Presentation,FileCtrl,HealthCtrl presentationClass
    class Application,Upload,Process,Search,Status applicationClass
    class Domain,Entities,Ports,FileUpload,FileChunk,IStorage,IQueue,ISearch,IRepo domainClass
    class Infrastructure,S3Adapter,SQSAdapter,ESAdapter,RepoImpl infrastructureClass
    class External,AWS,SQS,ES externalClass
```

## Data Flow - File Chunking Strategy

```mermaid
flowchart LR
    File["📄 Original File<br/>(e.g., 15MB)"]
    
    subgraph Chunking["Chunking Process"]
        direction TB
        C1["Chunk 1<br/>Byte 0 → 5,242,880<br/>(5MB)"]
        C2["Chunk 2<br/>Byte 5,242,780 → 10,485,660<br/>(5MB + 100B overlap)"]
        C3["Chunk 3<br/>Byte 10,485,560 → 15,000,000<br/>(Rest + 100B overlap)"]
    end
    
    subgraph Indexing["Elasticsearch Indexing"]
        direction TB
        Idx1["Document 1<br/>{chunkId, content, metadata}"]
        Idx2["Document 2<br/>{chunkId, content, metadata}"]
        Idx3["Document 3<br/>{chunkId, content, metadata}"]
    end
    
    Search["🔍 Full-text Search<br/>across all chunks"]
    
    File --> Chunking
    C1 --> Idx1
    C2 --> Idx2
    C3 --> Idx3
    Idx1 & Idx2 & Idx3 --> Search
    
    %% Styling
    classDef fileClass fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef chunkClass fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
    classDef indexClass fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px
    classDef searchClass fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    
    class File fileClass
    class C1,C2,C3 chunkClass
    class Idx1,Idx2,Idx3 indexClass
    class Search searchClass
```

## State Machine - File Processing States

```mermaid
stateDiagram-v2
    [*] --> UPLOADED: File uploaded to S3
    
    UPLOADED --> PROCESSING: Worker picks message<br/>from SQS queue
    
    PROCESSING --> COMPLETED: All chunks indexed<br/>successfully
    PROCESSING --> FAILED: Processing error<br/>(S3 download, chunking, or indexing failed)
    
    FAILED --> PROCESSING: Retry (visibility timeout)
    
    COMPLETED --> [*]
    FAILED --> [*]: Max retries exceeded<br/>(moved to DLQ)
    
    note right of UPLOADED
        - File in S3
        - Metadata saved
        - SQS message sent
    end note
    
    note right of PROCESSING
        - Status updated
        - Downloading from S3
        - Chunking file
        - Bulk indexing to ES
        - Progress tracking
    end note
    
    note right of COMPLETED
        - All chunks indexed
        - Searchable in ES
        - Progress: 100%
    end note
    
    note right of FAILED
        - Error logged
        - Can be retried
        - Moved to DLQ after max retries
    end note
```

## Technology Stack

```mermaid
mindmap
  root((File Processor<br/>Application))
    Backend Framework
      NestJS 10.3
      TypeScript 5.3
      Node.js 20
    Architecture
      Hexagonal/Clean
      Domain-Driven Design
      Ports & Adapters
      SOLID Principles
    Storage
      AWS S3
        Object Storage
        Presigned URLs
        LocalStack
      Repository
        In-Memory
        PostgreSQL ready
        MongoDB ready
    Queue
      AWS SQS
        Async Processing
        Long Polling
        Dead Letter Queue
        Message Visibility
    Search & Index
      Elasticsearch 8.11
        Full-text Search
        Bulk Indexing
        Mappings
        Aggregations
    Infrastructure
      Docker
      Docker Compose
      Multi-stage Build
      Health Checks
    Development
      LocalStack
        Free Persistence
        AWS Emulation
      Hot Reload
      Path Aliases
      Swagger/OpenAPI
```

## Key Features

1. **📤 Large File Handling**: Support up to 500MB files
2. **✂️ Smart Chunking**: 5MB chunks with 100 byte overlap to preserve context
3. **⚡ Async Processing**: Non-blocking upload, background processing via SQS
4. **🔍 Full-text Search**: Powered by Elasticsearch with relevance scoring
5. **📊 Progress Tracking**: Real-time status updates and processing progress
6. **🏗️ Hexagonal Architecture**: Clean separation of concerns, easy to test and maintain
7. **🐳 Docker Ready**: Complete containerization with docker-compose
8. **🧪 LocalStack Integration**: Local development without AWS costs
9. **📈 Scalable Workers**: Multiple worker instances for parallel processing
10. **🔒 Type Safety**: Full TypeScript with strict mode enabled
