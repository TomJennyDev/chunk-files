# 🔭 OpenTelemetry Concepts

## OpenTelemetry là gì?

**OpenTelemetry (OTel)** là một framework observability **open-source**, **vendor-neutral** — cung cấp API, SDK, và tools để thu thập telemetry data (traces, metrics, logs) từ ứng dụng.

::: info Tại sao OTel?
Trước OTel, mỗi vendor (Datadog, New Relic, Jaeger...) có SDK riêng → **vendor lock-in**. OTel chuẩn hóa cách thu thập data, cho phép chuyển backend bất kỳ lúc nào mà không đổi code.
:::

```mermaid
graph TB
    subgraph "Trước OpenTelemetry"
        A1["App Code"] -->|"Datadog SDK"| D1["Datadog"]
        A2["App Code"] -->|"Jaeger SDK"| D2["Jaeger"]
        A3["App Code"] -->|"New Relic SDK"| D3["New Relic"]
    end

    subgraph "Với OpenTelemetry"
        B1["App Code"] -->|"OTel SDK"| OC["OTel Collector"]
        OC -->|"export"| E1["Tempo / Jaeger"]
        OC -->|"export"| E2["Prometheus / Datadog"]
        OC -->|"export"| E3["Loki / Elasticsearch"]
    end

    style OC fill:#425cc7,color:#fff
```

## Core Concepts

### 1. Traces & Spans

**Trace** đại diện cho toàn bộ lifecycle của một request khi nó đi qua nhiều services. Mỗi trace bao gồm nhiều **Spans**.

**Span** là một đơn vị công việc (unit of work) — có tên, thời gian bắt đầu/kết thúc, attributes, và status.

```mermaid
gantt
    title Trace: File Upload Request
    dateFormat X
    axisFormat %L ms
    
    section HTTP Handler
    POST /files/upload           :a1, 0, 350
    
    section Application Layer
    UploadFileUseCase.execute    :a2, 10, 330
    
    section S3
    S3.PutObject                 :a3, 20, 120
    
    section SQS
    SQS.SendMessage              :a4, 130, 50
    
    section Repository
    FileRepo.save                :a5, 190, 20
```

#### Span Anatomy

```mermaid
classDiagram
    class Span {
        +string traceId
        +string spanId
        +string parentSpanId
        +string name
        +SpanKind kind
        +Timestamp startTime
        +Timestamp endTime
        +StatusCode status
        +Attributes attributes
        +Events events
        +Links links
    }
    
    class SpanKind {
        SERVER
        CLIENT
        PRODUCER
        CONSUMER
        INTERNAL
    }

    class StatusCode {
        UNSET
        OK
        ERROR
    }

    Span --> SpanKind
    Span --> StatusCode
```

#### Span Relationships

```mermaid
graph TD
    A["Root Span<br/>POST /files/upload<br/>traceId: abc123<br/>spanId: span-1"] --> B["Child Span<br/>UploadFileUseCase<br/>parentSpanId: span-1<br/>spanId: span-2"]
    B --> C["Child Span<br/>S3.PutObject<br/>parentSpanId: span-2<br/>spanId: span-3"]
    B --> D["Child Span<br/>SQS.SendMessage<br/>parentSpanId: span-2<br/>spanId: span-4"]
    B --> E["Child Span<br/>FileRepo.save<br/>parentSpanId: span-2<br/>spanId: span-5"]

    style A fill:#3b82f6,color:#fff
    style B fill:#6366f1,color:#fff
    style C fill:#f59e0b,color:#000
    style D fill:#f59e0b,color:#000
    style E fill:#10b981,color:#fff
```

### 2. Context Propagation

**Context Propagation** là cơ chế truyền `trace_id` và `span_id` giữa các services, để tất cả spans thuộc cùng một request được liên kết lại thành một trace hoàn chỉnh.

```mermaid
sequenceDiagram
    participant Browser as 🌐 Browser
    participant API as ⚙️ NestJS API
    participant S3 as 📦 S3 (LocalStack)
    participant SQS as 📨 SQS (LocalStack)

    Note over Browser: Generate traceId=abc123
    Browser->>+API: POST /files/upload<br/>Header: traceparent: 00-abc123-span1-01
    
    Note over API: Extract traceparent<br/>Create child span
    API->>+S3: PutObject<br/>Header: traceparent: 00-abc123-span2-01
    S3-->>-API: OK
    
    API->>+SQS: SendMessage<br/>MessageAttribute: traceparent=00-abc123-span3-01
    SQS-->>-API: OK
    
    API-->>-Browser: 200 OK

    Note over Browser,SQS: Tất cả spans chia sẻ cùng traceId=abc123<br/>→ Tempo hiển thị thành 1 trace tree
```

#### W3C Trace Context Format

```
traceparent: 00-{trace-id}-{span-id}-{trace-flags}
             ├── version (00)
             ├── trace-id (32 hex chars)
             ├── parent-span-id (16 hex chars)
             └── trace-flags (01 = sampled)

Ví dụ: traceparent: 00-abc123def456789-span12345678-01
```

### 3. Instrumentation

**Instrumentation** là quá trình thêm code để tạo spans, metrics, và logs.

#### Auto-Instrumentation vs Manual Instrumentation

```mermaid
graph LR
    subgraph "Auto-Instrumentation ✅"
        AI["getNodeAutoInstrumentations()"]
        AI --> H["HTTP requests"]
        AI --> E["Express routes"]
        AI --> N["NestJS controllers"]
        AI --> AWS["AWS SDK calls"]
        AI --> W["Winston logs"]
    end

    subgraph "Manual Instrumentation"
        MI["tracer.startSpan()"]
        MI --> C1["Custom business logic"]
        MI --> C2["Database queries"]
        MI --> C3["External API calls"]
    end

    style AI fill:#22c55e,color:#fff
    style MI fill:#3b82f6,color:#fff
```

### Trong Chunk Files, các instrumentations được bật:

| Instrumentation | Chức năng | Ví dụ Span |
|----------------|-----------|------------|
| `instrumentation-http` | Trace HTTP requests | `GET /files/search` |
| `instrumentation-express` | Trace Express middleware/routes | `middleware - cors` |
| `instrumentation-nestjs-core` | Trace NestJS lifecycle | `FileController.search` |
| `instrumentation-aws-sdk` | Trace AWS SDK calls | `S3.PutObject`, `SQS.SendMessage` |
| `instrumentation-undici` | Trace fetch/undici requests | `GET http://localhost:9200/...` |
| `instrumentation-winston` | Inject trace context vào logs | Log với `trace_id` |

### 4. OTel Collector

**OTel Collector** là một proxy/pipeline trung gian nhận telemetry data rồi xử lý và chuyển tiếp đến các backends.

```mermaid
graph LR
    subgraph "Receivers"
        R1["OTLP gRPC<br/>:4317"]
        R2["OTLP HTTP<br/>:4318"]
    end

    subgraph "Processors"
        P1["memory_limiter"]
        P2["resource<br/>(add attributes)"]
        P3["batch<br/>(buffer 5s)"]
    end

    subgraph "Exporters"
        E1["otlp/tempo<br/>→ Traces"]
        E2["prometheusremotewrite<br/>→ Metrics"]
        E3["loki<br/>→ Logs"]
        E4["debug<br/>→ stdout"]
    end

    R1 --> P1
    R2 --> P1
    P1 --> P2
    P2 --> P3
    P3 --> E1
    P3 --> E2
    P3 --> E3
    P3 --> E4

    style R1 fill:#3b82f6,color:#fff
    style R2 fill:#3b82f6,color:#fff
    style P1 fill:#f59e0b,color:#000
    style P2 fill:#f59e0b,color:#000
    style P3 fill:#f59e0b,color:#000
    style E1 fill:#22c55e,color:#fff
    style E2 fill:#e6522c,color:#fff
    style E3 fill:#22c55e,color:#fff
```

#### Pipeline Configuration

```yaml
# 3 pipelines riêng biệt cho 3 signal types
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, resource, batch]
      exporters: [otlp/tempo]

    metrics:
      receivers: [otlp]
      processors: [memory_limiter, resource, batch]
      exporters: [prometheusremotewrite]

    logs:
      receivers: [otlp]
      processors: [memory_limiter, resource, batch]
      exporters: [loki]
```

### 5. Resources & Attributes

**Resource** mô tả entity tạo ra telemetry (service name, version, environment...).

**Attributes** là key-value pairs gắn vào spans/metrics/logs để thêm context.

```mermaid
graph TB
    subgraph "Resource (Service-level)"
        R["service.name = chunk-files-api<br/>service.version = 1.0.0<br/>deployment.environment = development"]
    end

    subgraph "Span Attributes (Request-level)"
        SA["http.method = POST<br/>http.url = /files/upload<br/>http.status_code = 200<br/>rpc.service = S3<br/>rpc.method = PutObject"]
    end

    subgraph "Log Attributes"
        LA["context = SearchFilesUseCase<br/>trace_id = abc123<br/>span_id = span456"]
    end

    R --> SA
    R --> LA
```

## OTel SDK trong Chunk Files

### Backend (NestJS) — `tracing.ts`

```mermaid
graph TD
    A["main.ts"] -->|"import './tracing'"| B["tracing.ts<br/>(PHẢI là import đầu tiên)"]
    B --> C["NodeSDK"]
    C --> D["traceExporter<br/>→ OTel Collector :4318/v1/traces"]
    C --> E["metricReader<br/>→ OTel Collector :4318/v1/metrics"]
    C --> F["logRecordProcessor<br/>→ OTel Collector :4318/v1/logs"]
    C --> G["Auto-Instrumentations<br/>HTTP, Express, NestJS<br/>AWS SDK, Undici, Winston"]

    style B fill:#e0234e,color:#fff
    style C fill:#425cc7,color:#fff
```

### Frontend (React) — `tracing.ts`

```mermaid
graph TD
    A["main.tsx"] -->|"import './tracing'"| B["tracing.ts"]
    B --> C["WebTracerProvider"]
    C --> D["BatchSpanProcessor<br/>→ OTel Collector :4318/v1/traces"]
    C --> E["FetchInstrumentation<br/>XMLHttpRequestInstrumentation"]
    E --> F["Propagate traceparent<br/>to API calls"]

    style B fill:#61dafb,color:#000
    style C fill:#425cc7,color:#fff
```

## Semantic Conventions

OTel định nghĩa naming conventions chuẩn để attributes nhất quán:

| Convention | Attribute | Example |
|-----------|-----------|---------|
| HTTP | `http.method`, `http.status_code`, `http.url` | `GET`, `200`, `/files/search` |
| RPC | `rpc.service`, `rpc.method` | `S3`, `PutObject` |
| DB | `db.system`, `db.statement` | `elasticsearch`, `search query` |
| Service | `service.name`, `service.version` | `chunk-files-api`, `1.0.0` |
| Deployment | `deployment.environment` | `development`, `production` |

::: warning Thứ tự Import
`tracing.ts` **PHẢI** được import trước tất cả module khác trong `main.ts`. OTel cần monkey-patch các thư viện (http, express, aws-sdk) trước khi chúng được load.
:::
