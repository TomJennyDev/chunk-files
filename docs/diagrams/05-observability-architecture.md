# Observability & Monitoring Architecture

## Three Pillars of Observability

Thiết kế observability theo mô hình enterprise: **Traces → Metrics → Logs** với correlation đầy đủ qua `traceId` và `spanId`.

```mermaid
graph TB
    classDef app fill:#7c3aed,color:#fff,stroke:#5b21b6
    classDef collector fill:#2563eb,color:#fff,stroke:#1e40af
    classDef trace fill:#3b82f6,color:#fff,stroke:#2563eb
    classDef log fill:#22c55e,color:#fff,stroke:#16a34a
    classDef metric fill:#e6522c,color:#fff,stroke:#c53030
    classDef viz fill:#f97316,color:#fff,stroke:#ea580c
    classDef docker fill:#475569,color:#fff,stroke:#334155

    subgraph SOURCES["📡 Telemetry Sources"]
        direction LR
        API["NestJS API<br/>OTel SDK<br/>Auto-instrumentation:<br/>• HTTP<br/>• NestJS<br/>• AWS SDK"]:::app
        LAMBDA["Lambda Worker<br/>Console.log<br/>+ CloudWatch"]:::app
        CONTAINERS["Docker Containers<br/>stdout / stderr<br/>(LocalStack, ES, Kibana)"]:::docker
    end

    subgraph COLLECTION["🔄 Collection & Processing"]
        direction TB
        subgraph OTEL_PIPELINE["OTel Collector Pipeline"]
            RECV_OTLP["Receiver: OTLP<br/>gRPC :4317<br/>HTTP :4318"]:::collector
            
            PROC_BATCH["Processor: Batch<br/>timeout: 5s<br/>send_batch_size: 512"]:::collector
            PROC_RESOURCE["Processor: Resource Detection<br/>• service.name<br/>• service.version<br/>• host.name"]:::collector
            
            EXP_TEMPO["Exporter: OTLP → Tempo<br/>endpoint: tempo:4317"]:::trace
            EXP_LOKI["Exporter: Loki<br/>endpoint: loki:3100"]:::log
            EXP_PROM["Exporter: Prometheus<br/>remote-write: prom:9090"]:::metric
        end
        
        PROMTAIL["Promtail<br/>Docker SD<br/>Label extraction:<br/>• container_name<br/>• compose_service"]:::docker
        
        WINSTON["Winston Logger<br/>Transport 1: Console (pretty)<br/>Transport 2: OTelTransportV3"]:::app
    end

    subgraph STORAGE["💾 Storage Backends"]
        direction LR
        TEMPO["Grafana Tempo<br/>Trace Storage<br/>• TraceQL engine<br/>• Span metrics generator<br/>• Service graph generator"]:::trace
        LOKI["Grafana Loki<br/>Log Aggregation<br/>• LogQL engine<br/>• Label-based indexing<br/>• Chunk storage"]:::log
        PROM["Prometheus<br/>Metrics TSDB<br/>• PromQL engine<br/>• Exemplar storage<br/>• Native histograms"]:::metric
    end

    subgraph VISUALIZATION["📊 Visualization & Alerting"]
        direction TB
        GRAFANA["Grafana 10.4<br/>Port :3001"]:::viz
        
        subgraph DASHBOARDS["Pre-configured Dashboards"]
            D1["🔵 Service Overview<br/>• Request rate<br/>• Error rate<br/>• Latency (p50/p95/p99)"]
            D2["🟢 Log Explorer<br/>• Live tail<br/>• Full-text search<br/>• Trace correlation"]
            D3["🟡 Infrastructure<br/>• Container metrics<br/>• Resource utilization"]
            D4["🔴 Alerts<br/>• Error spike<br/>• Latency degradation<br/>• Queue depth"]
        end
    end

    API -->|"OTLP HTTP :4318"| RECV_OTLP
    API --> WINSTON
    WINSTON -->|"OTelTransportV3"| RECV_OTLP
    CONTAINERS --> PROMTAIL
    
    RECV_OTLP --> PROC_BATCH --> PROC_RESOURCE
    PROC_RESOURCE --> EXP_TEMPO
    PROC_RESOURCE --> EXP_LOKI
    PROC_RESOURCE --> EXP_PROM
    
    PROMTAIL -->|"Push API"| LOKI
    
    EXP_TEMPO --> TEMPO
    EXP_LOKI --> LOKI
    EXP_PROM --> PROM
    
    TEMPO -->|"TraceQL"| GRAFANA
    LOKI -->|"LogQL"| GRAFANA
    PROM -->|"PromQL"| GRAFANA
    
    TEMPO -->|"Span Metrics<br/>remote-write"| PROM
    
    GRAFANA --> D1 & D2 & D3 & D4
```

---

## Trace Correlation Flow

Minh họa cách `traceId` được propagate xuyên suốt hệ thống và correlate giữa traces, logs, metrics.

```mermaid
sequenceDiagram
    participant B as 🌐 Browser<br/>(OTel WebTracer)
    participant API as ⚙️ NestJS API<br/>(OTel Auto-instrumentation)
    participant S3 as 📦 S3
    participant SQS as 📨 SQS
    participant Lambda as ⚡ Lambda
    participant ES as 🔍 Elasticsearch
    participant OC as 🔄 OTel Collector
    participant T as 🔵 Tempo
    participant L as 🟢 Loki
    participant P as 🟡 Prometheus

    Note over B: Generate traceId=abc123<br/>spanId=span01

    B->>+API: POST /files/upload<br/>traceparent: 00-abc123-span01-01

    Note over API: Auto-create spans:<br/>• HTTP server span<br/>• NestJS controller span<br/>Winston log: {traceId, spanId}

    API->>OC: OTLP (spans + logs)
    OC->>T: Store trace abc123
    OC->>L: Store log {traceId=abc123}
    OC->>P: Increment counter {endpoint=/files/upload}

    API->>+S3: PutObject
    Note over API,S3: Auto-span: S3.PutObject<br/>parentSpan: span01
    S3-->>-API: OK

    API->>+SQS: SendMessage
    Note over API,SQS: Auto-span: SQS.SendMessage<br/>Inject traceparent into<br/>message attributes
    SQS-->>-API: MessageId

    API-->>-B: 201 {fileId}

    Note over SQS,Lambda: Async boundary<br/>(New trace context)

    SQS->>+Lambda: Invoke (batch)
    Lambda->>S3: GetObject
    S3-->>Lambda: File data
    Lambda->>Lambda: Chunk + Embed
    Lambda->>ES: Bulk Index
    ES-->>Lambda: OK
    Lambda-->>-SQS: Success

    Note over T,P: Grafana correlates:<br/>• Trace abc123 in Tempo<br/>• Logs with traceId=abc123 in Loki<br/>• Metrics exemplars pointing to abc123
```

---

## Tempo Span Metrics Generation

```mermaid
flowchart LR
    classDef trace fill:#3b82f6,color:#fff
    classDef metric fill:#e6522c,color:#fff
    classDef viz fill:#f97316,color:#fff

    subgraph INCOMING["Incoming Traces"]
        T1["Trace 1<br/>POST /files/upload<br/>duration: 250ms<br/>status: OK"]:::trace
        T2["Trace 2<br/>GET /files/search<br/>duration: 45ms<br/>status: OK"]:::trace
        T3["Trace 3<br/>POST /files/upload<br/>duration: 1200ms<br/>status: ERROR"]:::trace
    end

    subgraph TEMPO_ENGINE["Tempo Metrics Generator"]
        SG["Service Graph<br/>Generator"]
        SM["Span Metrics<br/>Generator"]
    end

    subgraph GENERATED_METRICS["Auto-Generated Metrics → Prometheus"]
        M1["traces_spanmetrics_calls_total<br/>{service, span_name, status}"]:::metric
        M2["traces_spanmetrics_latency_bucket<br/>{service, span_name, le}"]:::metric
        M3["traces_service_graph_request_total<br/>{client, server}"]:::metric
        M4["traces_service_graph_request_failed_total<br/>{client, server}"]:::metric
        M5["traces_service_graph_request_server_seconds<br/>{client, server}"]:::metric
    end

    subgraph GRAFANA_DASH["Grafana Dashboards"]
        RED["RED Metrics<br/>• Rate: requests/sec<br/>• Error: error %<br/>• Duration: p50/p95/p99"]:::viz
        SMAP["Service Map<br/>Topology graph with<br/>inter-service latency"]:::viz
    end

    T1 & T2 & T3 --> SM & SG
    SM --> M1 & M2
    SG --> M3 & M4 & M5
    M1 & M2 --> RED
    M3 & M4 & M5 --> SMAP
```

---

## Logging Pipeline Detail

```mermaid
flowchart TB
    classDef app fill:#7c3aed,color:#fff
    classDef transport fill:#2563eb,color:#fff
    classDef storage fill:#22c55e,color:#fff
    classDef query fill:#f97316,color:#fff

    subgraph PIPELINE_1["Pipeline 1: Application Logs (Structured)"]
        direction LR
        NEST["NestJS App<br/>this.logger.log()"]:::app
        WINSTON_L["Winston Logger"]:::app
        CON["Console Transport<br/>Dev: colorized<br/>Prod: JSON"]:::transport
        OTEL_T["OTelTransportV3<br/>→ BatchLogProcessor<br/>→ OTLPLogExporter"]:::transport
        OTEL_C["OTel Collector<br/>:4318"]:::transport
        LOKI_1["Loki"]:::storage
    end

    NEST --> WINSTON_L
    WINSTON_L --> CON
    WINSTON_L --> OTEL_T
    OTEL_T --> OTEL_C
    OTEL_C --> LOKI_1

    subgraph PIPELINE_2["Pipeline 2: Container Logs (Docker)"]
        direction LR
        LS_LOG["LocalStack<br/>stdout/stderr"]:::app
        ES_LOG["Elasticsearch<br/>stdout"]:::app
        KB_LOG["Kibana<br/>stdout"]:::app
        DOCKER_E["Docker Engine"]:::transport
        PROMTAIL_L["Promtail<br/>Docker SD"]:::transport
        LOKI_2["Loki"]:::storage
    end

    LS_LOG & ES_LOG & KB_LOG --> DOCKER_E --> PROMTAIL_L --> LOKI_2

    subgraph QUERY_LAYER["Query & Visualization"]
        direction LR
        GRAFANA_L["Grafana"]:::query
        LOGQL["LogQL Queries:<br/>• {service=chunk-files-api} filter<br/>• rate({job=docker}[5m])<br/>• {traceId=abc123}"]:::query
    end

    LOKI_1 & LOKI_2 --> GRAFANA_L --> LOGQL
```

---

## Alerting Architecture

```mermaid
flowchart TB
    classDef source fill:#3b82f6,color:#fff
    classDef rule fill:#f59e0b,color:#000
    classDef channel fill:#dc2626,color:#fff
    classDef action fill:#22c55e,color:#fff

    subgraph ALERT_RULES["Alert Rules (Grafana)"]
        direction TB
        R1["🔴 High Error Rate<br/>rate(http_errors[5m]) > 5%<br/>Severity: CRITICAL"]:::rule
        R2["🟡 Slow Response<br/>histogram_quantile(0.99, latency) > 2s<br/>Severity: WARNING"]:::rule
        R3["🔴 Queue Depth Spike<br/>sqs_messages_visible > 1000<br/>Severity: CRITICAL"]:::rule
        R4["🟡 Disk Usage High<br/>disk_used_percent > 85%<br/>Severity: WARNING"]:::rule
        R5["🔴 Lambda Errors<br/>lambda_errors_total[5m] > 10<br/>Severity: CRITICAL"]:::rule
        R6["🟡 ES Cluster Yellow<br/>es_cluster_status != green<br/>Severity: WARNING"]:::rule
    end

    subgraph CHANNELS["Notification Channels"]
        direction LR
        SLACK["Slack<br/>#alerts-prod"]:::channel
        PD["PagerDuty<br/>(On-call)"]:::channel
        EMAIL["Email<br/>team@company.com"]:::channel
        WEBHOOK["Webhook<br/>→ Auto-remediation"]:::channel
    end

    subgraph ACTIONS["Auto-Remediation"]
        direction LR
        SCALE["Scale Up<br/>ECS Tasks"]:::action
        PURGE["Purge DLQ<br/>& Retry"]:::action
        RESTART["Restart<br/>Unhealthy Container"]:::action
    end

    PROM["Prometheus"]:::source --> R1 & R2 & R4
    CW["CloudWatch"]:::source --> R3 & R5
    ES_HEALTH["ES Health API"]:::source --> R6

    R1 -->|"CRITICAL"| SLACK & PD
    R2 -->|"WARNING"| SLACK & EMAIL
    R3 -->|"CRITICAL"| SLACK & PD & WEBHOOK
    R4 -->|"WARNING"| SLACK
    R5 -->|"CRITICAL"| SLACK & PD
    R6 -->|"WARNING"| SLACK & EMAIL

    WEBHOOK --> SCALE & PURGE & RESTART
```
