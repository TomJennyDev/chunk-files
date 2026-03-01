# 🔍 Tracing Workflow

## End-to-End Trace Flow

Trang này mô tả chi tiết cách traces được tạo và truyền qua toàn bộ hệ thống — từ Browser → NestJS → LocalStack (S3, SQS) → Lambda → Elasticsearch.

## Flow 1: File Upload

### Sequence Diagram

```mermaid
sequenceDiagram
    participant B as 🌐 Browser<br/>(React)
    participant API as ⚙️ NestJS API<br/>Port 3000
    participant S3 as 📦 S3<br/>(LocalStack)
    participant SQS as 📨 SQS<br/>(LocalStack)
    participant Lambda as ⚡ Lambda<br/>(LocalStack)
    participant ES as 🔍 Elasticsearch<br/>Port 9200

    Note over B: OTel WebTracerProvider<br/>tạo traceId=t1

    B->>+API: POST /files/upload<br/>traceparent: 00-t1-s1-01<br/>multipart/form-data

    Note over API: instrumentation-http<br/>tạo span: "POST /files/upload"

    API->>API: ValidationPipe<br/>MetricsInterceptor

    Note over API: instrumentation-nestjs<br/>span: "FileController.upload"

    API->>+S3: PutObject<br/>(bucket: file-uploads,<br/>key: uploads/{fileId}/{fileName})
    Note over API,S3: instrumentation-aws-sdk<br/>span: "S3.PutObject"
    S3-->>-API: ETag, VersionId

    API->>+SQS: SendMessage<br/>(queue: file-processing-queue,<br/>body: {fileId, fileName, s3Key})
    Note over API,SQS: instrumentation-aws-sdk<br/>span: "SQS.SendMessage"
    SQS-->>-API: MessageId

    API->>API: FileRepo.save(file)

    API-->>-B: 200 {fileId, status: "uploaded"}

    Note over SQS,Lambda: Event Source Mapping<br/>(async, separate trace)

    SQS->>+Lambda: Invoke<br/>(batch of messages)
    Lambda->>S3: GetObject<br/>(download file)
    S3-->>Lambda: File content
    Lambda->>Lambda: Chunk file<br/>(5MB chunks)
    
    loop For each chunk
        Lambda->>ES: Index chunk<br/>(POST /file-chunks/_doc)
    end
    
    Lambda-->>-SQS: Success (delete message)
```

### Trace Tree (Tempo View)

```mermaid
graph TD
    A["🔵 POST /files/upload<br/>duration: 450ms<br/>span_kind: SERVER"] 
    A --> B["🟣 FileController.upload<br/>duration: 440ms<br/>span_kind: INTERNAL"]
    B --> C["🟡 S3.PutObject<br/>duration: 180ms<br/>span_kind: CLIENT<br/>rpc.service: S3"]
    B --> D["🟡 SQS.SendMessage<br/>duration: 65ms<br/>span_kind: CLIENT<br/>rpc.service: SQS"]
    B --> E["🟢 FileRepo.save<br/>duration: 5ms<br/>span_kind: INTERNAL"]

    style A fill:#3b82f6,color:#fff
    style B fill:#8b5cf6,color:#fff
    style C fill:#f59e0b,color:#000
    style D fill:#f59e0b,color:#000
    style E fill:#22c55e,color:#fff
```

### Metrics Generated

Từ trace trên, Tempo tự động tạo các metrics:

| Metric | Labels | Value |
|--------|--------|-------|
| `traces_spanmetrics_calls_total` | `service=chunk-files-api, span_name=POST /files/upload, status_code=STATUS_CODE_UNSET` | +1 |
| `traces_spanmetrics_latency_bucket{le="500"}` | `service=chunk-files-api, span_name=POST /files/upload` | +1 |
| `traces_spanmetrics_calls_total` | `service=chunk-files-api, span_name=S3.PutObject` | +1 |
| `traces_spanmetrics_calls_total` | `service=chunk-files-api, span_name=SQS.SendMessage` | +1 |

---

## Flow 2: File Search

### Sequence Diagram

```mermaid
sequenceDiagram
    participant B as 🌐 Browser
    participant API as ⚙️ NestJS API
    participant ES as 🔍 Elasticsearch

    Note over B: User types search query<br/>traceId=t2

    B->>+API: GET /files/search?text=hello&page=1&size=10<br/>traceparent: 00-t2-s1-01

    Note over API: instrumentation-http<br/>span: "GET /files/search"

    API->>API: SearchFilesUseCase.execute()
    Note over API: Winston: "Searching files<br/>with query: {text: hello}"<br/>+ trace_id=t2

    API->>+ES: POST /file-chunks/_search<br/>{query: {multi_match: {query: "hello"}}}
    Note over API,ES: instrumentation-undici<br/>span: "POST http://localhost:9200/..."
    ES-->>-API: {hits: [{_source: {content, fileId, ...}}]}

    Note over API: Winston: "Found 5 results in 2ms"<br/>+ trace_id=t2

    API-->>-B: 200 {total: 5, results: [...]}

    Note over B: FetchInstrumentation<br/>records span: "GET /files/search"
```

### Trace Tree

```mermaid
graph TD
    A["🔵 GET /files/search<br/>duration: 15ms<br/>http.status_code: 200"]
    A --> B["🟣 FileController.search<br/>duration: 12ms"]
    B --> C["🟣 SearchFilesUseCase.execute<br/>duration: 10ms"]
    C --> D["🟡 POST http://localhost:9200/file-chunks/_search<br/>duration: 5ms<br/>span_kind: CLIENT"]

    style A fill:#3b82f6,color:#fff
    style B fill:#8b5cf6,color:#fff
    style C fill:#8b5cf6,color:#fff
    style D fill:#f59e0b,color:#000
```

### Correlated Logs (Loki)

Cùng `trace_id=t2`, Loki chứa:

```
14:04:55.102 info [SearchFilesUseCase] Searching files with query: {"text":"hello"} traceId=t2
14:04:55.107 info [SearchFilesUseCase] Found 5 results in 5ms traceId=t2
```

---

## Flow 3: File Download (IFrame Viewer)

### Sequence Diagram

```mermaid
sequenceDiagram
    participant B as 🌐 Browser
    participant API as ⚙️ NestJS API
    participant S3 as 📦 S3<br/>(LocalStack)

    Note over B: User clicks search result<br/>→ opens IFrame viewer

    B->>+API: GET /files/{fileId}/download?fileName=doc.md<br/>traceparent: 00-t3-s1-01

    Note over API: instrumentation-http<br/>span: "GET /files/:fileId/download"

    API->>API: Construct s3Key<br/>= uploads/{fileId}/{fileName}

    API->>+S3: GetObject<br/>(bucket: file-uploads,<br/>key: uploads/{fileId}/doc.md)
    Note over API,S3: instrumentation-aws-sdk<br/>span: "S3.GetObject"
    S3-->>-API: Stream (markdown content)

    API-->>-B: 200 text/markdown<br/># Hello World...
```

---

## Flow 4: Frontend Tracing

### Browser → API Trace Propagation

```mermaid
graph LR
    subgraph "Browser (React)"
        FT["WebTracerProvider"]
        FI["FetchInstrumentation"]
        FT --> FI
    end

    subgraph "HTTP Request"
        H["fetch('http://localhost:3000/files/search')<br/>Headers:<br/>  traceparent: 00-abc123-span456-01"]
    end

    subgraph "NestJS API"
        NH["instrumentation-http<br/>Extract traceparent<br/>→ Create child span"]
    end

    FI -->|"inject traceparent"| H
    H -->|"propagate"| NH

    style FT fill:#61dafb,color:#000
    style NH fill:#e0234e,color:#fff
```

### Frontend Instrumentation

```typescript
// apps/web/src/tracing.ts
const provider = new WebTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'chunk-files-web',
  }),
  spanProcessors: [
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: 'http://localhost:4318/v1/traces',
      })
    ),
  ],
});

// Chỉ propagate traceparent đến API (không gửi đến CDN, etc.)
registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation({
      propagateTraceHeaderCorsUrls: [/localhost:3000/],
    }),
  ],
});
```

---

## Trace Context Flow Summary

```mermaid
graph TD
    subgraph "1. Browser generates trace"
        B["React App<br/>traceId = abc123<br/>spanId = span-browser"]
    end

    subgraph "2. API receives & continues"
        A["NestJS<br/>traceId = abc123 (same!)<br/>spanId = span-api<br/>parentSpanId = span-browser"]
    end

    subgraph "3. AWS SDK propagates"
        S3["S3 Call<br/>traceId = abc123 (same!)<br/>spanId = span-s3<br/>parentSpanId = span-api"]
        SQS["SQS Call<br/>traceId = abc123 (same!)<br/>spanId = span-sqs<br/>parentSpanId = span-api"]
    end

    subgraph "4. Logs enriched"
        L["Winston Log<br/>trace_id = abc123<br/>span_id = span-api"]
    end

    B -->|"traceparent header"| A
    A -->|"AWS SDK header"| S3
    A -->|"message attribute"| SQS
    A -->|"instrumentation-winston"| L

    style B fill:#61dafb,color:#000
    style A fill:#e0234e,color:#fff
    style S3 fill:#f59e0b,color:#000
    style SQS fill:#f59e0b,color:#000
    style L fill:#22c55e,color:#fff
```

---

## Troubleshooting Traces

### Traces không xuất hiện trong Tempo?

```mermaid
flowchart TD
    A["Traces missing?"] --> B{OTel SDK init?}
    B -->|"No log '📡 OpenTelemetry tracing initialized'"| C["Check import './tracing' là dòng đầu tiên trong main.ts"]
    B -->|"Yes"| D{OTel Collector running?}
    D -->|"No"| E["docker ps | grep otel-collector"]
    D -->|"Yes"| F{Collector receiving?}
    F -->|"Check logs"| G["docker logs otel-collector --tail 20<br/>Look for 'TracesExporter'"]
    G -->|"No spans"| H["Check OTEL_ENDPOINT=http://localhost:4318"]
    G -->|"Has spans"| I{Tempo running?}
    I -->|"No"| J["docker ps | grep tempo"]
    I -->|"Yes"| K["Check Grafana → Explore → Tempo<br/>Search by service.name"]
```

### Logs không có trace_id?

1. Kiểm tra `instrumentation-winston` enabled trong `tracing.ts`
2. Kiểm tra `tracing.ts` được import **trước** Winston logger creation
3. Kiểm tra `OpenTelemetryTransportV3` có trong Winston transports

### LocalStack logs không xuất hiện?

1. Kiểm tra Promtail: `docker logs promtail --tail 20`
2. Kiểm tra Docker socket mount: `-v /var/run/docker.sock:/var/run/docker.sock:ro`
3. Query Loki: `{container="file-processor-localstack"}`
