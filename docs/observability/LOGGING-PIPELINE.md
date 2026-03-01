# 📝 Logging Pipeline

## Tổng Quan

Hệ thống logging sử dụng **2 pipelines song song** để thu thập logs từ cả application code (NestJS) lẫn Docker containers (LocalStack, Elasticsearch...).

```mermaid
graph TB
    subgraph "Pipeline 1: Application Logs"
        direction TB
        N["NestJS Application"] -->|"this.logger.log()"| W["Winston Logger"]
        W -->|"Transport 1"| C["Console<br/>(pretty format)"]
        W -->|"Transport 2"| OT["OpenTelemetryTransportV3"]
        OT -->|"OTLP HTTP"| OC["OTel Collector :4318"]
        OC -->|"loki exporter"| L["Loki :3100"]
    end

    subgraph "Pipeline 2: Container Logs"
        direction TB
        LS["LocalStack stdout/stderr"] --> DE["Docker Engine"]
        ES["Elasticsearch stdout"] --> DE
        KB["Kibana stdout"] --> DE
        DE -->|"Docker SD"| PT["Promtail"]
        PT -->|"push API"| L
    end

    L -->|"query"| GF["Grafana :3001"]

    style W fill:#22c55e,color:#fff
    style OT fill:#425cc7,color:#fff
    style PT fill:#f46800,color:#fff
    style L fill:#22c55e,color:#fff
    style GF fill:#f97316,color:#fff
```

## Pipeline 1: Winston → OTel → Loki

### Tại sao cần Winston?

NestJS default Logger sử dụng `console.log()` — output **chỉ ra terminal**, không được gửi đến Loki. Winston cung cấp:

1. **Multiple transports** — gửi log đến nhiều đích cùng lúc
2. **Structured logging** — JSON format cho production
3. **OTel integration** — tự động gắn `trace_id`, `span_id` vào mọi log
4. **Log levels** — filter theo severity

```mermaid
graph LR
    subgraph "Winston Transports"
        W["Winston Logger"]
        W -->|"Transport 1"| T1["Console Transport<br/>Dev: colorized, pretty<br/>Prod: JSON"]
        W -->|"Transport 2"| T2["OTel Transport<br/>→ OTel SDK<br/>→ BatchLogRecordProcessor<br/>→ OTLPLogExporter"]
    end

    T2 --> OC["OTel Collector"]
    OC --> LK["Loki"]

    style W fill:#22c55e,color:#fff
    style T1 fill:#6366f1,color:#fff
    style T2 fill:#425cc7,color:#fff
```

### Winston Configuration

```typescript
// apps/file-processor/src/infrastructure/logger/winston.config.ts

import * as winston from 'winston';
import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';
import { WinstonModule } from 'nest-winston';

export function createWinstonLogger() {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: 'chunk-files-api' },
    transports: [
      // Console — pretty cho dev, JSON cho prod
      new winston.transports.Console({ ... }),
      
      // OTel — gửi logs đến OTel Collector → Loki
      new OpenTelemetryTransportV3({ level: 'info' }),
    ],
  });
}
```

### Trace-Log Correlation

Mỗi log record được **tự động gắn** `trace_id` và `span_id` nhờ `@opentelemetry/instrumentation-winston`:

```mermaid
sequenceDiagram
    participant Client as 🌐 Client
    participant API as ⚙️ NestJS
    participant Winston as 📝 Winston
    participant OTel as 📡 OTel SDK
    participant Loki as 🟢 Loki

    Client->>API: GET /files/search?text=hello<br/>traceparent: 00-abc123-span1-01

    Note over API: OTel creates span<br/>traceId=abc123, spanId=span2

    API->>Winston: logger.log("Searching files...")
    
    Note over Winston: instrumentation-winston<br/>auto-injects trace context
    
    Winston->>OTel: LogRecord {<br/>  body: "Searching files...",<br/>  trace_id: "abc123",<br/>  span_id: "span2"<br/>}

    OTel->>Loki: OTLP Log Export

    Note over Loki: Log stored with labels:<br/>job=chunk-files-api<br/>level=INFO<br/>+ trace_id in body
```

### Log Format

**Development** (Console):
```
14:04:52.594 info [NestFactory] Starting Nest application... traceId=abc123
14:04:53.324 info [NestApplication] Nest application successfully started
14:04:55.102 info [SearchFilesUseCase] Searching files with query: {"text":"hello"}
```

**In Loki** (JSON):
```json
{
  "body": "Searching files with query: {\"text\":\"hello\"}",
  "traceid": "abc123def456789",
  "spanid": "span12345678",
  "severity": "info",
  "attributes": {
    "context": "SearchFilesUseCase",
    "service": "chunk-files-api",
    "trace_id": "abc123def456789",
    "span_id": "span12345678"
  },
  "resources": {
    "service.name": "chunk-files-api",
    "service.version": "1.0.0",
    "deployment.environment": "development"
  }
}
```

---

## Pipeline 2: Promtail → Loki

### Promtail là gì?

**Promtail** là agent thu thập logs, được thiết kế cho Loki. Nó sử dụng **Docker Service Discovery** để tự động phát hiện tất cả Docker containers đang chạy và scrape logs của chúng.

```mermaid
graph TB
    subgraph "Docker Host"
        DS["Docker Socket<br/>/var/run/docker.sock"]
        
        C1["📦 file-processor-localstack"]
        C2["📦 elasticsearch-local"]
        C3["📦 kibana-local"]
        C4["📦 otel-collector"]
        C5["📦 tempo"]
        C6["📦 loki"]
        C7["📦 prometheus"]
        C8["📦 grafana"]
    end

    subgraph "Promtail"
        SD["Docker SD<br/>(Service Discovery)"]
        RL["Relabel Config<br/>Extract labels"]
        PS["Pipeline Stages<br/>Regex, Labels"]
    end

    DS -->|"list containers"| SD
    C1 -->|"stdout/stderr"| SD
    C2 -->|"stdout/stderr"| SD
    C3 -->|"stdout/stderr"| SD
    SD --> RL --> PS --> L["Loki :3100"]

    style SD fill:#f46800,color:#fff
    style L fill:#22c55e,color:#fff
```

### Relabel Config — Auto-labeling

Promtail tự động gắn labels từ Docker metadata:

```mermaid
graph LR
    subgraph "Docker Metadata"
        M1["__meta_docker_container_name<br/>= /file-processor-localstack"]
        M2["__meta_docker_container_label_<br/>com_docker_compose_service<br/>= localstack"]
        M3["__meta_docker_container_label_<br/>com_docker_compose_project<br/>= localstack"]
    end

    subgraph "Loki Labels"
        L1["container = file-processor-localstack"]
        L2["service = localstack"]
        L3["project = localstack"]
    end

    M1 -->|"relabel"| L1
    M2 -->|"relabel"| L2
    M3 -->|"relabel"| L3
```

### Pipeline Stages — Log Parsing

```mermaid
graph TD
    subgraph "Raw Log Line"
        R["2026-02-19T08:27:42 DEBUG --- [s3] PutObject bucket=file-uploads key=uploads/abc/doc.md"]
    end

    subgraph "Stage 1: Regex Level"
        S1["Extract: level = DEBUG"]
    end

    subgraph "Stage 2: Regex AWS Service"
        S2["Extract: aws_service = s3"]
    end

    subgraph "Final Labels"
        F["container = file-processor-localstack<br/>service = localstack<br/>level = DEBUG<br/>aws_service = s3"]
    end

    R --> S1 --> S2 --> F
```

### Promtail Configuration

```yaml
# promtail-config.yaml

scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s

    relabel_configs:
      # Container name → label
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: container
      
      # Compose service → label
      - source_labels: ['__meta_docker_container_label_com_docker_compose_service']
        target_label: service

    pipeline_stages:
      # Extract log level
      - regex:
          expression: '(?i)(?P<level>DEBUG|INFO|WARN|ERROR|CRITICAL)'
      - labels:
          level:
      
      # Extract AWS service name from LocalStack
      - regex:
          expression: '\[(?P<aws_service>s3|sqs|lambda|opensearch|kms)\]'
      - labels:
          aws_service:
```

---

## Xem Logs Trong Grafana

### Dashboard Panels

| Panel | LogQL Query | Hiển thị |
|-------|------------|----------|
| **Application Logs** | `{job="chunk-files-api"}` | NestJS Winston logs |
| **LocalStack Logs** | `{container="file-processor-localstack"}` | Toàn bộ LocalStack output |
| **AWS Service Logs** | `{container="file-processor-localstack"} \|~ "s3\|sqs\|lambda"` | Filter theo AWS service |
| **Error Logs** | `{container="file-processor-localstack"} \|~ "error\|exception"` | Chỉ errors |

### Explore Mode — Useful Queries

```mermaid
graph TD
    subgraph "Common LogQL Queries"
        Q1["Tất cả API logs<br/>{job='chunk-files-api'}"]
        Q2["Chỉ errors<br/>{job='chunk-files-api', level='ERROR'}"]
        Q3["Search trong log<br/>{job='chunk-files-api'} |= 'upload'"]
        Q4["LocalStack S3<br/>{container='file-processor-localstack',<br/>aws_service='s3'}"]
        Q5["Đếm errors/phút<br/>count_over_time(<br/>{level='ERROR'}[1m])"]
        Q6["Tất cả containers<br/>{container=~'.+'}"]
    end
```

### Trace → Log Navigation

Khi click vào một trace trong Tempo, Grafana tự động:

1. Lấy `traceId` từ trace
2. Query Loki: `{job="chunk-files-api"} |= "<traceId>"`
3. Hiển thị logs liên quan ngay cạnh trace

```mermaid
sequenceDiagram
    participant User as 👤 User
    participant Grafana as 📊 Grafana
    participant Tempo as 🔵 Tempo
    participant Loki as 🟢 Loki

    User->>Grafana: Click trace in dashboard
    Grafana->>Tempo: GET /api/traces/abc123
    Tempo-->>Grafana: Trace (5 spans)
    
    Note over Grafana: tracesToLogsV2 config<br/>filterByTraceID: true
    
    Grafana->>Loki: Query {job="chunk-files-api"}<br/>| trace_id="abc123"
    Loki-->>Grafana: 3 matching logs
    
    Grafana->>User: Show trace + correlated logs<br/>side by side
```

---

## Log Levels & Best Practices

### Log Level Guide

| Level | Khi nào dùng | Ví dụ |
|-------|------------|-------|
| `error` | Lỗi cần xử lý ngay | Database connection failed |
| `warn` | Vấn đề tiềm ẩn | Retry attempt 3/5 |
| `info` | Business events | File uploaded, Search completed |
| `debug` | Chi tiết kỹ thuật | Query params, S3 key constructed |
| `verbose` | Rất chi tiết | Full request/response body |

### Structured Logging Pattern

```typescript
// ✅ Good — structured, searchable
this.logger.log('File uploaded successfully', {
  fileId: file.id,
  fileName: file.name,
  sizeBytes: file.size,
  duration: elapsed,
});

// ❌ Bad — unstructured, hard to search
this.logger.log(`File ${file.name} uploaded in ${elapsed}ms`);
```
