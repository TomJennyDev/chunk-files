# 📡 Observability Overview

## Tổng Quan

Hệ thống observability của **Chunk Files** được xây dựng trên bộ **Grafana Stack** (Tempo + Loki + Prometheus) kết hợp với **OpenTelemetry** — cung cấp khả năng theo dõi toàn bộ flow từ Frontend → Backend → LocalStack (S3, SQS, Lambda, OpenSearch).

::: tip Ba Trụ Cột Observability
Observability dựa trên 3 tín hiệu chính: **Traces** (luồng xử lý), **Metrics** (số liệu), và **Logs** (nhật ký). Cả 3 được tương quan (correlated) với nhau thông qua `trace_id`.
:::

## Architecture Overview

```mermaid
graph TB
    subgraph "Applications"
        FE["🌐 React Frontend<br/>Port 5173"]
        BE["⚙️ NestJS Backend<br/>Port 3000"]
        LS["☁️ LocalStack<br/>Port 4566"]
        ES["🔍 Elasticsearch<br/>Port 9200"]
    end

    subgraph "Telemetry Collection"
        OTEL["📡 OTel Collector<br/>Port 4317/4318"]
        PT["📋 Promtail<br/>Docker SD"]
    end

    subgraph "Storage Backends"
        TEMPO["🔵 Tempo<br/>Traces"]
        LOKI["🟢 Loki<br/>Logs"]
        PROM["🟡 Prometheus<br/>Metrics"]
    end

    subgraph "Visualization"
        GF["📊 Grafana<br/>Port 3001"]
    end

    FE -->|"OTLP HTTP<br/>traces"| OTEL
    BE -->|"OTLP HTTP<br/>traces + metrics + logs"| OTEL
    
    PT -->|"scrape Docker logs"| LS
    PT -->|"scrape Docker logs"| ES
    PT -->|"push"| LOKI

    OTEL -->|"traces"| TEMPO
    OTEL -->|"metrics"| PROM
    OTEL -->|"logs"| LOKI

    TEMPO --> GF
    LOKI --> GF
    PROM --> GF

    style FE fill:#61dafb,color:#000
    style BE fill:#e0234e,color:#fff
    style LS fill:#ff9900,color:#000
    style ES fill:#00bfb3,color:#000
    style OTEL fill:#425cc7,color:#fff
    style PT fill:#f46800,color:#fff
    style TEMPO fill:#3b82f6,color:#fff
    style LOKI fill:#22c55e,color:#fff
    style PROM fill:#e6522c,color:#fff
    style GF fill:#f97316,color:#fff
```

## Telemetry Signal Flow

```mermaid
flowchart LR
    subgraph "Signal Types"
        T["🔵 Traces"]
        M["🟡 Metrics"] 
        L["🟢 Logs"]
    end

    subgraph "What They Answer"
        TQ["Chuyện gì xảy ra<br/>trong request này?"]
        MQ["Hệ thống hoạt động<br/>tốt không?"]
        LQ["Tại sao lỗi<br/>xảy ra?"]
    end

    T --> TQ
    M --> MQ
    L --> LQ
```

## Quick Access

| Service | URL | Credentials |
|---------|-----|-------------|
| **Grafana Dashboard** | [http://localhost:3001/d/chunk-files-observability](http://localhost:3001/d/chunk-files-observability) | admin / admin |
| **Grafana Explore** | [http://localhost:3001/explore](http://localhost:3001/explore) | admin / admin |
| **Prometheus** | [http://localhost:9090](http://localhost:9090) | — |
| **Tempo API** | [http://localhost:3200](http://localhost:3200) | — |
| **Loki API** | [http://localhost:3100](http://localhost:3100) | — |
| **OTel Collector Metrics** | [http://localhost:8888/metrics](http://localhost:8888/metrics) | — |

## Tài Liệu Chi Tiết

| Trang | Nội dung |
|-------|----------|
| [OpenTelemetry Concepts](./OTEL-CONCEPTS) | Traces, Spans, Context Propagation, SDK, Auto-instrumentation |
| [Grafana Stack](./GRAFANA-STACK) | Tempo, Loki, Prometheus, Grafana — cách hoạt động và cấu hình |
| [Logging Pipeline](./LOGGING-PIPELINE) | Winston → OTel → Loki, Promtail → Docker logs, trace correlation |
| [Tracing Workflow](./TRACING-WORKFLOW) | End-to-end trace flow: Upload → S3 → SQS → Lambda → Elasticsearch |

## Docker Services

```mermaid
graph LR
    subgraph "docker-compose.yml"
        A["otel-collector<br/>v0.96.0"]
        B["tempo<br/>v2.4.1"]
        C["loki<br/>v2.9.4"]
        D["prometheus<br/>v2.50.1"]
        E["grafana<br/>v10.4.1"]
        F["promtail<br/>v3.3.2"]
    end

    A --> B
    A --> C
    A --> D
    F --> C
    B --> E
    C --> E
    D --> E
```

## File Structure

```
infra/observability/
├── otel-collector/
│   └── otel-collector-config.yaml    # Central pipeline config
├── tempo/
│   └── tempo-config.yaml            # Trace storage config
├── loki/
│   └── loki-config.yaml             # Log storage config
├── prometheus/
│   └── prometheus.yaml              # Metrics scrape config
├── promtail/
│   └── promtail-config.yaml         # Docker log scraper config
└── grafana/
    ├── provisioning/
    │   └── datasources/
    │       └── datasources.yaml      # Auto-provisioned datasources
    └── dashboards/
        └── chunk-files-overview.json # Pre-built dashboard
```
