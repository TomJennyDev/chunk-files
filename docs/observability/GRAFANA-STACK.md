# 📊 Grafana Stack

## Tổng Quan

**Grafana Stack** gồm 4 thành phần chính, mỗi thành phần chịu trách nhiệm một loại telemetry signal:

```mermaid
graph TB
    subgraph "Grafana Stack"
        direction TB
        GF["📊 Grafana<br/>Visualization & Alerting<br/>Port 3001"]
        
        subgraph "Storage Backends"
            TEMPO["🔵 Grafana Tempo<br/>Distributed Tracing<br/>Port 3200"]
            LOKI["🟢 Grafana Loki<br/>Log Aggregation<br/>Port 3100"]
            PROM["🟡 Prometheus<br/>Metrics & Alerting<br/>Port 9090"]
        end
    end

    TEMPO -->|"traces"| GF
    LOKI -->|"logs"| GF
    PROM -->|"metrics"| GF

    style GF fill:#f97316,color:#fff
    style TEMPO fill:#3b82f6,color:#fff
    style LOKI fill:#22c55e,color:#fff
    style PROM fill:#e6522c,color:#fff
```

## 1. Grafana Tempo — Distributed Tracing

### Tempo là gì?

**Tempo** là hệ thống lưu trữ distributed traces, được thiết kế bởi Grafana Labs. Khác với Jaeger hoặc Zipkin, Tempo **chỉ cần object storage** (không cần database riêng) → dễ vận hành và scale.

### Cách hoạt động

```mermaid
sequenceDiagram
    participant App as ⚙️ NestJS App
    participant OTel as 📡 OTel Collector
    participant Tempo as 🔵 Tempo
    participant Grafana as 📊 Grafana

    App->>OTel: OTLP traces (HTTP :4318)
    OTel->>Tempo: OTLP gRPC (:4317)
    
    Note over Tempo: Lưu traces theo traceId<br/>Tạo span metrics
    
    Tempo->>Tempo: metrics_generator<br/>→ span-metrics<br/>→ service-graphs
    Tempo->>Grafana: Prometheus remote-write<br/>(traces_spanmetrics_*)

    Grafana->>Tempo: TraceQL query<br/>GET /api/traces/{traceId}
    Tempo-->>Grafana: Trace data (spans tree)
```

### Span Metrics Generator

Tempo tự động tạo **metrics từ traces** — không cần instrument thêm:

```mermaid
graph LR
    subgraph "Tempo receives traces"
        T["Trace:<br/>POST /files/upload<br/>duration: 250ms<br/>status: OK"]
    end

    subgraph "Auto-generated Metrics"
        M1["traces_spanmetrics_calls_total<br/>{service, span_name, status_code}"]
        M2["traces_spanmetrics_latency_bucket<br/>{service, span_name, le}"]
        M3["traces_service_graph_request_total<br/>{client, server}"]
    end

    T --> M1
    T --> M2
    T --> M3

    style T fill:#3b82f6,color:#fff
    style M1 fill:#e6522c,color:#fff
    style M2 fill:#e6522c,color:#fff
    style M3 fill:#e6522c,color:#fff
```

| Metric | Mô tả | Sử dụng |
|--------|--------|---------|
| `traces_spanmetrics_calls_total` | Tổng số spans theo service, endpoint, status | Request rate, error rate |
| `traces_spanmetrics_latency_bucket` | Histogram latency theo spans | p50, p95, p99 latency |
| `traces_service_graph_request_total` | Số calls giữa các services | Service map |

### TraceQL — Query Language

TraceQL cho phép tìm traces theo điều kiện:

```
# Tìm traces có lỗi
{ status = error }

# Tìm traces từ service cụ thể
{ resource.service.name = "chunk-files-api" }

# Tìm traces chậm hơn 500ms
{ duration > 500ms }

# Tìm traces có S3 calls
{ span.rpc.service = "S3" }

# Tìm traces liên quan đến upload
{ name =~ ".*upload.*" }
```

### Cấu hình Tempo

```yaml
# tempo-config.yaml - Những phần quan trọng

# Metrics generator - tạo metrics từ traces
metrics_generator:
  registry:
    external_labels:
      source: tempo
      cluster: docker-compose
  storage:
    path: /tmp/tempo/generator/wal
    remote_write:
      - url: http://prometheus:9090/api/v1/write
        send_exemplars: true
  processor:
    service_graphs:        # Service dependency map
    span_metrics:          # RED metrics per span
```

---

## 2. Grafana Loki — Log Aggregation

### Loki là gì?

**Loki** là hệ thống log aggregation — khác Elasticsearch, Loki **chỉ index labels** (metadata) chứ không index nội dung log → tiết kiệm storage gấp nhiều lần.

### So sánh Loki vs Elasticsearch

```mermaid
graph TB
    subgraph "Elasticsearch Approach"
        EL["Log: 'User uploaded file abc.md'"]
        EI["Full-text index:<br/>User ✓ uploaded ✓ file ✓ abc.md ✓"]
        ES["Storage: ~10x log size"]
    end

    subgraph "Loki Approach"
        LL["Log: 'User uploaded file abc.md'"]
        LI["Label index only:<br/>service=api ✓ level=info ✓"]
        LS["Storage: ~1.5x log size"]
    end

    EL --> EI --> ES
    LL --> LI --> LS

    style EI fill:#ef4444,color:#fff
    style LI fill:#22c55e,color:#fff
```

### LogQL — Query Language

```
# Lấy tất cả logs từ API service
{job="chunk-files-api"}

# Filter theo log level
{job="chunk-files-api", level="ERROR"}

# Full-text search trong log content 
{job="chunk-files-api"} |= "SearchFiles"

# Regex search
{job="chunk-files-api"} |~ "(?i)upload|download"

# JSON parsing
{job="chunk-files-api"} | json | trace_id != ""

# Aggregation - đếm errors/phút
count_over_time({job="chunk-files-api", level="ERROR"}[1m])

# LocalStack logs
{container="file-processor-localstack"}

# LocalStack theo AWS service
{container="file-processor-localstack", aws_service="s3"}

# Tìm LocalStack errors
{container="file-processor-localstack"} |~ "(?i)error|exception"
```

### 2 Nguồn Log trong Loki

```mermaid
graph TD
    subgraph "Source 1: Application Logs (OTel)"
        W["Winston Logger"] -->|"OpenTelemetryTransportV3"| O["OTel SDK"]
        O -->|"OTLP HTTP"| OC["OTel Collector"]
        OC -->|"loki exporter"| L["Loki"]
    end

    subgraph "Source 2: Container Logs (Promtail)"
        D1["LocalStack container"] -->|"Docker API"| P["Promtail"]
        D2["Elasticsearch container"] -->|"Docker API"| P
        D3["OTel Collector container"] -->|"Docker API"| P
        P -->|"push API"| L
    end

    subgraph "Labels"
        L --> L1["job=chunk-files-api<br/>level=INFO<br/>exporter=OTLP"]
        L --> L2["container=file-processor-localstack<br/>service=localstack<br/>aws_service=s3"]
    end

    style W fill:#22c55e,color:#fff
    style P fill:#f46800,color:#fff
    style L fill:#22c55e,color:#fff
```

---

## 3. Prometheus — Metrics Collection

### Prometheus là gì?

**Prometheus** là hệ thống monitoring và alerting, sử dụng mô hình **pull-based** (Prometheus chủ động scrape metrics) kết hợp **push** (nhận remote write từ OTel Collector và Tempo).

### Metrics Types

```mermaid
graph LR
    subgraph "4 Metric Types"
        C["Counter<br/>Chỉ tăng<br/>http_requests_total"]
        G["Gauge<br/>Lên xuống<br/>active_connections"]
        H["Histogram<br/>Distribution<br/>request_duration_bucket"]
        S["Summary<br/>Quantiles<br/>request_duration_quantile"]
    end

    style C fill:#3b82f6,color:#fff
    style G fill:#22c55e,color:#fff
    style H fill:#f59e0b,color:#000
    style S fill:#8b5cf6,color:#fff
```

| Type | Mô tả | Ví dụ trong Chunk Files |
|------|--------|------------------------|
| **Counter** | Giá trị chỉ tăng, dùng cho tổng số | `traces_spanmetrics_calls_total` |
| **Gauge** | Giá trị lên/xuống, dùng cho trạng thái hiện tại | `http_active_requests` |
| **Histogram** | Phân phối giá trị (buckets), dùng cho latency | `traces_spanmetrics_latency_bucket` |
| **Summary** | Tương tự histogram nhưng tính quantile phía client | `file_upload_size_bytes` |

### Nguồn Metrics

```mermaid
graph TB
    subgraph "Push (Remote Write)"
        OC["OTel Collector"] -->|"prometheusremotewrite"| P["Prometheus :9090"]
        T["Tempo<br/>span metrics"] -->|"remote write"| P
    end

    subgraph "Pull (Scrape)"
        P -->|"scrape /metrics"| API["NestJS API :3000"]
        P -->|"scrape"| OC2["OTel Collector :8888"]
        P -->|"self-scrape"| P
    end

    style P fill:#e6522c,color:#fff
```

### PromQL — Query Language

```sql
# Request rate (requests per second)
sum(rate(traces_spanmetrics_calls_total[5m])) by (service)

# p95 Latency 
histogram_quantile(0.95, 
  sum(rate(traces_spanmetrics_latency_bucket[5m])) by (le, service)
)

# Error rate
sum(rate(traces_spanmetrics_calls_total{status_code="STATUS_CODE_ERROR"}[5m]))
  / sum(rate(traces_spanmetrics_calls_total[5m]))

# Request rate per endpoint
sum(rate(traces_spanmetrics_calls_total{service="chunk-files-api"}[5m])) 
  by (span_name)
```

---

## 4. Grafana — Visualization

### Dashboard Structure

Dashboard **Chunk Files - Full Stack Observability** gồm các sections:

```mermaid
graph TD
    subgraph "Dashboard Layout"
        R1["📊 Service Overview<br/>Request Rate | Latency | Error Rate"]
        R2["📈 Stats<br/>Total Requests | Avg Latency | Errors | Services"]
        R3["🔗 API Endpoints<br/>Rate by Endpoint | Latency by Endpoint"]
        R4["🔍 Traces<br/>Recent Traces (Tempo)"]
        R5["📝 Application Logs<br/>NestJS Winston Logs (Loki)"]
        R6["🗺️ Service Map<br/>Service Dependency Graph"]
        R7["☁️ LocalStack Flow<br/>Container Logs | AWS Service Logs | Errors"]
        R8["📋 All Containers<br/>Docker Logs (collapsible)"]
    end

    R1 --> R2 --> R3 --> R4 --> R5 --> R6 --> R7 --> R8
```

### Datasource Cross-Linking

```mermaid
graph LR
    subgraph "Trace → Log Correlation"
        T["Tempo Trace"] -->|"tracesToLogsV2<br/>filterByTraceID"| L["Loki Logs"]
    end

    subgraph "Trace → Metric Correlation"
        T -->|"tracesToMetrics<br/>service.name"| P["Prometheus Metrics"]
    end

    subgraph "Log → Trace Correlation"
        L -->|"derivedFields<br/>matcherRegex: traceid"| T
    end

    subgraph "Metric → Trace (Exemplars)"
        P -->|"exemplarTraceIdDestinations"| T
    end

    style T fill:#3b82f6,color:#fff
    style L fill:#22c55e,color:#fff
    style P fill:#e6522c,color:#fff
```

| Correlation | Từ | Đến | Cách hoạt động |
|------------|-----|-----|----------------|
| Trace → Log | Tempo | Loki | Click trace → filter logs by `trace_id` |
| Trace → Metric | Tempo | Prometheus | Link span metrics by `service.name` |
| Log → Trace | Loki | Tempo | Regex extract `traceid` → link to Tempo |
| Metric → Trace | Prometheus | Tempo | Exemplar `traceID` → open in Tempo |

### Provisioning (Auto-config)

Grafana được cấu hình hoàn toàn tự động qua provisioning files — khi container khởi động, datasources và dashboards được tạo ngay:

```
grafana/provisioning/
├── datasources/
│   └── datasources.yaml    ← 3 datasources (Prometheus, Tempo, Loki)
└── dashboards/
    └── chunk-files-overview.json  ← Pre-built dashboard
```

---

## So Sánh Với Các Alternatives

### Tại sao chọn Grafana Stack?

```mermaid
graph TB
    subgraph "Option 1: Grafana Stack ✅"
        G1["Tempo + Loki + Prometheus + Grafana"]
        G1P["✅ Open-source, free<br/>✅ Vendor-neutral (OTel)<br/>✅ Lightweight (Loki indexes labels only)<br/>✅ Unified UI (Grafana)<br/>✅ Native trace-log-metric correlation"]
    end

    subgraph "Option 2: Jaeger + ELK"
        G2["Jaeger + Elasticsearch + Kibana"]
        G2P["✅ Mature tracing<br/>❌ Heavy (ES indexes everything)<br/>❌ 2 separate UIs<br/>❌ Manual correlation"]
    end

    subgraph "Option 3: Datadog / New Relic"
        G3["SaaS Solutions"]
        G3P["✅ Zero ops<br/>❌ Expensive at scale<br/>❌ Vendor lock-in<br/>❌ Data leaves your infra"]
    end

    style G1 fill:#22c55e,color:#fff
    style G2 fill:#f59e0b,color:#000
    style G3 fill:#ef4444,color:#fff
```
