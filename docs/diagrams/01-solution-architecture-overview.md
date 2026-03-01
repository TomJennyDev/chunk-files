# Solution Architecture Overview

## Enterprise Solution Architecture — Chunk Files Platform

Tổng quan kiến trúc toàn bộ hệ thống ở mức cao nhất, thể hiện các domain chính, luồng dữ liệu chính và các technology stack.

```mermaid
graph TB
    classDef client fill:#2563eb,color:#fff,stroke:#1e40af,stroke-width:2px
    classDef api fill:#7c3aed,color:#fff,stroke:#5b21b6,stroke-width:2px
    classDef processing fill:#db2777,color:#fff,stroke:#9d174d,stroke-width:2px
    classDef storage fill:#059669,color:#fff,stroke:#047857,stroke-width:2px
    classDef search fill:#d97706,color:#fff,stroke:#b45309,stroke-width:2px
    classDef observability fill:#6366f1,color:#fff,stroke:#4338ca,stroke-width:2px
    classDef infra fill:#475569,color:#fff,stroke:#334155,stroke-width:2px
    classDef ai fill:#e11d48,color:#fff,stroke:#be123c,stroke-width:2px

    %% ========= PRESENTATION TIER =========
    subgraph PRESENTATION["🖥️ Presentation Tier"]
        direction LR
        WEB["React SPA<br/>(Vite + Mantine UI)<br/>Port: 5173"]
        MCP["MCP Server<br/>(AI Tool Interface)<br/>stdio transport"]
        CLAUDE["Claude Desktop /<br/>VS Code Copilot"]
    end

    %% ========= API TIER =========
    subgraph API_TIER["⚙️ API Tier — NestJS (Hexagonal Architecture)"]
        direction LR
        subgraph PRESENT_LAYER["Presentation Layer"]
            FC["FileController"]
            HC["HealthController"]
            VAL["Validators"]
        end
        subgraph APP_LAYER["Application Layer"]
            UC_UP["UploadFile<br/>UseCase"]
            UC_SEARCH["SearchFiles<br/>UseCase"]
            UC_STATUS["GetFileStatus<br/>UseCase"]
        end
        subgraph DOMAIN_LAYER["Domain Layer"]
            ENT["Entities<br/>(FileUpload, FileChunk)"]
            PORTS["Port Interfaces<br/>(Storage, Queue,<br/>Search, Repository)"]
        end
        subgraph INFRA_LAYER["Infrastructure Layer"]
            S3A["S3 Adapter"]
            SQSA["SQS Adapter"]
            ESA["Elasticsearch<br/>Adapter"]
            REPO["InMemory<br/>Repository"]
        end
    end

    %% ========= PROCESSING TIER =========
    subgraph PROCESSING["⚡ Processing Tier — Serverless"]
        direction LR
        LAMBDA["Lambda Worker<br/>Node.js 20.x<br/>1024MB / 300s"]
        CHUNKER["Markdown Chunker<br/>(Heading-aware)"]
        EMBEDDER["AI Embeddings<br/>Generator"]
        CACHE["/tmp Cache<br/>(Ephemeral 2GB)"]
    end

    %% ========= DATA TIER =========
    subgraph DATA["💾 Data Tier"]
        direction LR
        S3["S3 Object Storage<br/>(file-uploads bucket)"]
        SQS["SQS Message Queue<br/>(file-processing-queue)"]
        ES["Elasticsearch 8.11<br/>(Full-text + Vector Search)<br/>Port: 9200"]
        OS["OpenSearch<br/>(LocalStack managed)"]
    end

    %% ========= OBSERVABILITY =========
    subgraph OBS["📊 Observability Platform"]
        direction LR
        OTEL["OTel Collector<br/>Port: 4317/4318"]
        TEMPO["Grafana Tempo<br/>(Traces)"]
        LOKI["Grafana Loki<br/>(Logs)"]
        PROM["Prometheus<br/>(Metrics)"]
        GRAFANA["Grafana<br/>Port: 3001"]
        PROMTAIL["Promtail<br/>(Container Logs)"]
    end

    %% ========= INFRASTRUCTURE =========
    subgraph INFRA["🏗️ Infrastructure"]
        direction LR
        DOCKER["Docker Compose"]
        LOCALSTACK["LocalStack<br/>Port: 4566"]
        TERRAFORM["Terraform IaC"]
        KIBANA["Kibana<br/>Port: 5601"]
    end

    %% ========= CONNECTIONS =========
    WEB -->|"REST API"| FC
    MCP -->|"HTTP calls"| FC
    CLAUDE -->|"MCP Protocol"| MCP
    
    FC --> UC_UP
    FC --> UC_SEARCH
    HC --> UC_STATUS
    
    UC_UP --> PORTS
    UC_SEARCH --> PORTS
    
    PORTS --> S3A
    PORTS --> SQSA
    PORTS --> ESA
    PORTS --> REPO
    
    S3A -->|"PutObject / GetObject"| S3
    SQSA -->|"SendMessage"| SQS
    ESA -->|"Index / Search"| ES
    
    SQS -->|"Event Source Mapping"| LAMBDA
    LAMBDA -->|"Download"| S3
    LAMBDA --> CHUNKER
    LAMBDA --> EMBEDDER
    LAMBDA --> CACHE
    CHUNKER -->|"Bulk Index"| ES
    EMBEDDER -->|"Vector Index"| ES
    
    LOCALSTACK -.->|"emulates"| S3
    LOCALSTACK -.->|"emulates"| SQS
    TERRAFORM -.->|"provisions"| LOCALSTACK
    
    FC -->|"traces + logs"| OTEL
    LAMBDA -->|"logs"| OTEL
    OTEL --> TEMPO
    OTEL --> LOKI
    OTEL --> PROM
    PROMTAIL -->|"container logs"| LOKI
    TEMPO --> GRAFANA
    LOKI --> GRAFANA
    PROM --> GRAFANA

    %% Styles
    class WEB,MCP,CLAUDE client
    class FC,HC,VAL,UC_UP,UC_SEARCH,UC_STATUS api
    class LAMBDA,CHUNKER,EMBEDDER,CACHE processing
    class S3,SQS,ES,OS storage
    class OTEL,TEMPO,LOKI,PROM,GRAFANA,PROMTAIL observability
    class DOCKER,LOCALSTACK,TERRAFORM,KIBANA infra
    class EMBEDDER ai
```

## Technology Stack Matrix

| Tier | Technology | Purpose | Port |
|------|-----------|---------|------|
| **Frontend** | React + Vite + Mantine UI | SPA Web Client | 5173 |
| **AI Interface** | MCP Server (TypeScript) | Claude/Copilot integration | stdio |
| **API** | NestJS (TypeScript) | REST API + Business Logic | 3000 |
| **Processing** | AWS Lambda (Node.js 20.x) | Async file processing | - |
| **Storage** | S3 (LocalStack) | Object storage | 4566 |
| **Queue** | SQS (LocalStack) | Message queue | 4566 |
| **Search** | Elasticsearch 8.11 | Full-text + vector search | 9200 |
| **Dashboard** | Kibana 8.11 | Elasticsearch UI | 5601 |
| **Traces** | Grafana Tempo | Distributed tracing | 3200 |
| **Logs** | Grafana Loki | Log aggregation | 3100 |
| **Metrics** | Prometheus | Metrics collection | 9090 |
| **Visualization** | Grafana | Observability dashboards | 3001 |
| **Log Collector** | Promtail | Docker log forwarding | - |
| **Telemetry** | OTel Collector | Central telemetry pipeline | 4317/4318 |
| **IaC** | Terraform | Infrastructure provisioning | - |
| **Emulator** | LocalStack | AWS services emulation | 4566 |
| **Orchestration** | Docker Compose | Container orchestration | - |
| **Monorepo** | pnpm + Turborepo | Build system | - |
