# C4 Model — System Context & Container Diagrams

## Level 1: System Context Diagram

Mô tả hệ thống Chunk Files Platform trong bối cảnh các actors và external systems tương tác.

```mermaid
C4Context
    title System Context Diagram — Chunk Files Platform

    Person(user, "End User", "Uploads documents, searches content via Web UI")
    Person(aiUser, "AI/Developer", "Uses Claude Desktop or VS Code Copilot to interact via MCP")
    Person(devops, "DevOps Engineer", "Monitors system health, manages infrastructure")

    System(chunkFiles, "Chunk Files Platform", "AI-powered document processing, chunking, and semantic search system")

    System_Ext(aws, "AWS Cloud Services", "S3, SQS, Lambda, OpenSearch (emulated via LocalStack in dev)")
    System_Ext(elasticsearch, "Elasticsearch Cluster", "Full-text search engine with vector search capabilities")
    System_Ext(grafanaStack, "Grafana Observability Stack", "Tempo (traces), Loki (logs), Prometheus (metrics), Grafana (dashboards)")

    Rel(user, chunkFiles, "Uploads files, searches content", "HTTPS / REST API")
    Rel(aiUser, chunkFiles, "Uploads, searches, analyzes documents", "MCP Protocol (stdio)")
    Rel(devops, grafanaStack, "Monitors traces, logs, metrics", "HTTPS")
    
    Rel(chunkFiles, aws, "Stores files, queues messages, runs Lambda workers", "AWS SDK v3")
    Rel(chunkFiles, elasticsearch, "Indexes chunks, full-text + vector search", "HTTP REST")
    Rel(chunkFiles, grafanaStack, "Sends traces, logs, metrics", "OTLP gRPC/HTTP")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

---

## Level 2: Container Diagram

Chi tiết bên trong Chunk Files Platform — các container (ứng dụng/dịch vụ) và quan hệ giữa chúng.

```mermaid
C4Container
    title Container Diagram — Chunk Files Platform

    Person(user, "End User", "Web browser user")
    Person(aiUser, "AI User", "Claude Desktop / VS Code")

    System_Boundary(platform, "Chunk Files Platform") {
        Container(web, "Web Application", "React + Vite + Mantine UI", "SPA for file upload, search, and results display. Port 5173")
        Container(mcp, "MCP Server", "TypeScript, MCP SDK", "Exposes tools for AI assistants: upload, search, analyze, status")
        Container(api, "Backend API", "NestJS, TypeScript", "REST API with Hexagonal Architecture. Handles uploads, search, status. Port 3000")
        Container(lambda, "Lambda Worker", "Node.js 20.x", "Async file processing: download from S3, chunk by structure, generate embeddings, index to ES")
        
        ContainerDb(s3, "S3 Storage", "AWS S3 (LocalStack)", "Object storage for uploaded files. Bucket: file-uploads")
        ContainerQueue(sqs, "SQS Queue", "AWS SQS (LocalStack)", "Message queue for async processing. Queue: file-processing-queue")
        ContainerDb(es, "Elasticsearch", "Elasticsearch 8.11", "Full-text search + vector search. Index: file-chunks")
        ContainerDb(repo, "In-Memory Store", "Node.js Map", "Ephemeral file metadata storage (dev only)")
    }

    System_Boundary(observability, "Observability Stack") {
        Container(otel, "OTel Collector", "OpenTelemetry Contrib", "Central telemetry pipeline. Receives OTLP, exports to backends")
        Container(tempo, "Grafana Tempo", "Tempo 2.4.1", "Distributed trace storage + TraceQL")
        Container(loki, "Grafana Loki", "Loki 2.9.4", "Log aggregation with LogQL")
        Container(prom, "Prometheus", "Prometheus 2.50", "Metrics TSDB with PromQL")
        Container(grafana, "Grafana", "Grafana 10.4", "Unified dashboards for traces, logs, metrics. Port 3001")
        Container(promtail, "Promtail", "Promtail 3.3", "Docker container log collector → Loki")
    }

    Rel(user, web, "Uses", "HTTPS")
    Rel(aiUser, mcp, "Interacts via", "MCP Protocol (stdio)")
    Rel(web, api, "REST API calls", "HTTP JSON")
    Rel(mcp, api, "REST API calls", "HTTP JSON")
    
    Rel(api, s3, "Upload/download files", "AWS SDK v3")
    Rel(api, sqs, "Send processing messages", "AWS SDK v3")
    Rel(api, es, "Search and query", "HTTP REST")
    Rel(api, repo, "Store file metadata", "In-process")
    
    Rel(sqs, lambda, "Triggers", "Event Source Mapping, batch=5")
    Rel(lambda, s3, "Download source files", "AWS SDK v3")
    Rel(lambda, es, "Bulk index chunks + vectors", "HTTP REST")
    
    Rel(api, otel, "Traces + Logs", "OTLP HTTP :4318")
    Rel(promtail, loki, "Push container logs", "HTTP")
    Rel(otel, tempo, "Export traces", "OTLP gRPC :4317")
    Rel(otel, loki, "Export logs", "Loki HTTP")
    Rel(otel, prom, "Export metrics", "Prometheus remote-write")
    Rel(tempo, grafana, "Query traces", "TraceQL")
    Rel(loki, grafana, "Query logs", "LogQL")
    Rel(prom, grafana, "Query metrics", "PromQL")

    UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="2")
```

---

## Level 3: Component Diagram — NestJS API

Chi tiết bên trong Backend API container theo Hexagonal Architecture.

```mermaid
C4Component
    title Component Diagram — NestJS Backend API

    Container_Boundary(api, "NestJS Backend API") {
        Component(fileCtrl, "FileController", "NestJS Controller", "POST /files/upload, GET /files/search, GET /files/:id/status")
        Component(healthCtrl, "HealthController", "NestJS Controller", "GET /health — system health check")
        Component(validators, "Validators", "NestJS Pipes", "CustomFileTypeValidator, ParseFilePipe")
        Component(metrics, "MetricsInterceptor", "NestJS Interceptor", "Request duration, status code tracking")
        
        Component(uploadUC, "UploadFileUseCase", "Application Service", "Orchestrates: validate → S3 upload → save metadata → SQS publish")
        Component(searchUC, "SearchFilesUseCase", "Application Service", "Orchestrates: parse query → ES search → format results")
        Component(statusUC, "GetFileStatusUseCase", "Application Service", "Retrieves file processing status from repository")
        
        Component(fileEntity, "FileUpload Entity", "Domain Model", "fileId, fileName, fileSize, mimeType, status, timestamps")
        Component(chunkEntity, "FileChunk Entity", "Domain Model", "chunkId, fileId, content, chunkIndex, metadata, embedding")
        Component(storagePrt, "IStoragePort", "Port Interface", "uploadFile(), getFile(), deleteFile()")
        Component(queuePrt, "IQueuePort", "Port Interface", "sendMessage(), receiveMessages()")
        Component(searchPrt, "ISearchPort", "Port Interface", "indexChunk(), search(), createIndex()")
        Component(repoPrt, "IFileRepository", "Port Interface", "save(), findById(), findAll()")
        
        Component(s3Adp, "S3Adapter", "Infrastructure", "AWS SDK v3 S3Client — PutObject, GetObject")
        Component(sqsAdp, "SQSAdapter", "Infrastructure", "AWS SDK v3 SQSClient — SendMessage")
        Component(esAdp, "ElasticsearchAdapter", "Infrastructure", "Elasticsearch Client 8.11 — bulk index, multi_match, knn")
        Component(repoAdp, "InMemoryFileRepository", "Infrastructure", "Map<string, FileUpload> — development store")
        Component(winston, "WinstonLogger", "Infrastructure", "Structured logging with OTel transport → Loki")
        Component(tracing, "OTel Tracing", "Infrastructure", "Auto-instrumentation: HTTP, NestJS, AWS SDK")
    }

    Rel(fileCtrl, validators, "Validates input")
    Rel(fileCtrl, uploadUC, "Delegates upload")
    Rel(fileCtrl, searchUC, "Delegates search")
    Rel(healthCtrl, statusUC, "Delegates status")
    Rel(metrics, fileCtrl, "Wraps with metrics")
    
    Rel(uploadUC, storagePrt, "Uses")
    Rel(uploadUC, queuePrt, "Uses")
    Rel(uploadUC, repoPrt, "Uses")
    Rel(searchUC, searchPrt, "Uses")
    Rel(statusUC, repoPrt, "Uses")
    
    Rel(storagePrt, s3Adp, "Implemented by")
    Rel(queuePrt, sqsAdp, "Implemented by")
    Rel(searchPrt, esAdp, "Implemented by")
    Rel(repoPrt, repoAdp, "Implemented by")

    UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")
```
