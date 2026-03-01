# Observability Stack — Config Reference

Tài liệu này giải thích **từng tham số** trong toàn bộ file cấu hình của observability stack,
bao gồm: Loki, Tempo, Prometheus, Promtail, OTel Collector, Grafana datasources và dashboard provisioning.

---

## Tổng quan kiến trúc luồng dữ liệu

```
Applications (NestJS / React)
          │
          │  OTLP (gRPC :4317 / HTTP :4318)
          ▼
  ┌─────────────────┐
  │  OTel Collector │  ← trung tâm thu thập toàn bộ telemetry
  └────┬──────┬─────┘
       │      │      │
   Traces  Metrics  Logs
       │      │      │
       ▼      ▼      ▼
    Tempo  Prometheus  Loki
       │      │         ▲
       │      │     Promtail (scrape Docker logs)
       └──────┴──────────┘
                  │
               Grafana  (port 3001)
```

---

## 1. Loki — `loki/loki-config.yaml`

Loki là **log aggregation backend** — nhận log từ Promtail và OTel Collector, lưu trữ và cho phép query bằng LogQL.

```yaml
auth_enabled: false
```
> Tắt xác thực multi-tenant. Phù hợp môi trường local/dev — **không dùng cho production**.

---

### `server`
```yaml
server:
  http_listen_port: 3100
```
| Key | Giá trị | Ý nghĩa |
|-----|---------|---------|
| `http_listen_port` | `3100` | Port HTTP API — Promtail, OTel, Grafana gọi vào đây |

---

### `common`
```yaml
common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory
```
| Key | Giá trị | Ý nghĩa |
|-----|---------|---------|
| `path_prefix` | `/loki` | Thư mục gốc cho tất cả dữ liệu lưu trong container |
| `chunks_directory` | `/loki/chunks` | Nơi lưu các compressed log chunk (mapped với Docker volume `loki-data`) |
| `rules_directory` | `/loki/rules` | Nơi chứa alerting rules |
| `replication_factor` | `1` | Không replicate — phù hợp single-node local |
| `ring.kvstore.store` | `inmemory` | Coordinator nội bộ trong RAM thay vì etcd/consul — đủ dùng cho single instance |

---

### `query_range`
```yaml
query_range:
  results_cache:
    cache:
      embedded_cache:
        enabled: true
        max_size_mb: 100
```
| Key | Ý nghĩa |
|-----|---------|
| `embedded_cache.enabled` | Bật cache kết quả query trong RAM |
| `max_size_mb: 100` | Giới hạn cache query ở 100 MB — ngăn OOM |

---

### `schema_config`
```yaml
schema_config:
  configs:
    - from: "2020-10-24"
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h
```
| Key | Giá trị | Ý nghĩa |
|-----|---------|---------|
| `from` | `2020-10-24` | Schema áp dụng từ ngày này trở đi |
| `store` | `tsdb` | Dùng TSDB (Time Series DB) index — nhanh hơn BoltDB cũ |
| `object_store` | `filesystem` | Lưu chunk ra filesystem (local dev); đổi thành `s3`/`gcs` cho production |
| `schema` | `v13` | Phiên bản schema mới nhất của Loki, hỗ trợ structured metadata |
| `index.period` | `24h` | Mỗi file index bao phủ 1 ngày — cân bằng giữa số file và query perf |

---

### `limits_config`
```yaml
limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h
  max_query_length: 721h
  allow_structured_metadata: true
```
| Key | Giá trị | Ý nghĩa |
|-----|---------|---------|
| `reject_old_samples` | `true` | Từ chối log cũ hơn ngưỡng — ngăn ghi nhầm log lỗi thời |
| `reject_old_samples_max_age` | `168h` (7 ngày) | Log cũ hơn 7 ngày bị drop |
| `max_query_length` | `721h` (~30 ngày) | Giới hạn khoảng thời gian tối đa có thể query |
| `allow_structured_metadata` | `true` | Cho phép structured metadata (cần để tương thích schema v13) |

---

### `ruler` & `analytics`
```yaml
ruler:
  alertmanager_url: http://localhost:9093
analytics:
  reporting_enabled: false
```
| Key | Ý nghĩa |
|-----|---------|
| `alertmanager_url` | URL của Alertmanager — hiện chưa deploy, dùng placeholder |
| `reporting_enabled: false` | Tắt gửi analytics về Grafana Labs |

---

## 2. Tempo — `tempo/tempo-config.yaml`

Tempo là **distributed tracing backend** — nhận spans từ OTel Collector, lưu traces và expose API cho Grafana.

### `server`
```yaml
server:
  http_listen_port: 3200
```
Port HTTP API — Grafana và Prometheus scrape metrics ở đây.

---

### `distributor`
```yaml
distributor:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317
        http:
          endpoint: 0.0.0.0:4318
```
Tempo lắng nghe OTLP **trực tiếp** trên port 4317/4318 (bên cạnh OTel Collector cũng nhận). Trong docker-compose, OTel Collector forward trace sang đây qua `otlp/tempo` exporter.

---

### `ingester`
```yaml
ingester:
  max_block_duration: 5m
```
| Key | Ý nghĩa |
|-----|---------|
| `max_block_duration` | Cứ sau 5 phút, flush trace block xuống storage. Thấp → latency query thấp, cao → ít write I/O |

---

### `compactor`
```yaml
compactor:
  compaction:
    block_retention: 48h
```
| Key | Ý nghĩa |
|-----|---------|
| `block_retention` | Xóa trace cũ hơn 48h — giữ dung lượng nhỏ cho local dev |

---

### `metrics_generator`
```yaml
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
```
Tính năng đặc biệt của Tempo: **tự sinh metrics từ trace data** và đẩy vào Prometheus.

| Key | Ý nghĩa |
|-----|---------|
| `external_labels` | Gắn label `source=tempo`, `cluster=docker-compose` lên tất cả metrics sinh ra |
| `remote_write.url` | Đẩy metrics về Prometheus qua remote write API |
| `send_exemplars` | Gửi kèm exemplar (traceID) vào metric → click metric trên Grafana → nhảy thẳng vào trace |

---

### `storage`
```yaml
storage:
  trace:
    backend: local
    wal:
      path: /tmp/tempo/wal
    local:
      path: /tmp/tempo/blocks
```
| Key | Ý nghĩa |
|-----|---------|
| `backend: local` | Lưu trace trên filesystem local (đổi thành `s3` cho production) |
| `wal.path` | Write-Ahead Log — buffer trước khi flush xuống block |
| `local.path` | Nơi lưu block cuối cùng |

---

### `overrides`
```yaml
overrides:
  defaults:
    metrics_generator:
      processors: [service-graphs, span-metrics]
```
| Processor | Sinh ra |
|-----------|---------|
| `service-graphs` | Metrics về relationship giữa các service (call rate, error rate, latency) |
| `span-metrics` | Histogram duration, error counter theo service/operation |

---

## 3. Prometheus — `prometheus/prometheus.yaml`

### Global
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  scrape_timeout: 10s
```
| Key | Ý nghĩa |
|-----|---------|
| `scrape_interval` | Cứ 15s scrape metrics từ tất cả target |
| `evaluation_interval` | Cứ 15s evaluate alerting/recording rules |
| `scrape_timeout` | Nếu target không trả về trong 10s → bỏ qua lần đó |

> Lưu ý: `--web.enable-remote-write-receiver` được bật qua Docker command, cho phép OTel Collector và Tempo ghi metrics vào Prometheus.

---

### `scrape_configs`

| Job | Target | Mục đích |
|-----|--------|---------|
| `prometheus` | `localhost:9090` | Prometheus tự monitor chính nó |
| `chunk-files-api` | `host.docker.internal:3000` | Scrape NestJS API metrics via `prom-client` ở `/metrics` |
| `otel-collector` | `otel-collector:8888` | Metrics nội bộ của OTel Collector (pipeline throughput, errors) |
| `tempo` | `tempo:3200` | Metrics của Tempo (ingest rate, block size...) |
| `loki` | `loki:3100` | Metrics của Loki (query latency, ingestion rate...) |
| `elasticsearch` | `host.docker.internal:9200` | Optional — scrape ES metrics qua `/_prometheus/metrics` |

> `host.docker.internal` là hostname đặc biệt để container truy cập host machine — dùng cho NestJS đang chạy local (không trong Docker).

```yaml
  - job_name: "chunk-files-api"
    scrape_interval: 10s   # Override global — scrape API nhanh hơn (10s) để metric granular hơn
```

---

## 4. Promtail — `promtail/promtail-config.yaml`

Promtail là **log collector agent** — chạy như sidecar, dùng Docker socket để phát hiện và đọc log của tất cả container đang chạy, rồi ship về Loki.

### `server` & `clients`
```yaml
server:
  http_listen_port: 9080
clients:
  - url: http://loki:3100/loki/api/v1/push
    batchwait: 1s
    batchsize: 1048576
```
| Key | Ý nghĩa |
|-----|---------|
| `http_listen_port: 9080` | Promtail API (health check, metrics) |
| `batchwait: 1s` | Gom log tối đa 1s trước khi gửi → giảm số HTTP request |
| `batchsize: 1048576` | Hoặc gửi ngay khi đủ 1MB — cái nào xảy ra trước |

---

### `docker_sd_configs` (Service Discovery)
```yaml
docker_sd_configs:
  - host: unix:///var/run/docker.sock
    refresh_interval: 5s
    filters:
      - name: status
        values: ["running"]
```
| Key | Ý nghĩa |
|-----|---------|
| `host` | Kết nối Docker daemon qua Unix socket (mount vào container) |
| `refresh_interval: 5s` | Cứ 5s quét lại danh sách container — detect container mới/cũ |
| `filters: status=running` | Chỉ scrape container đang chạy, bỏ qua stopped/exited |

---

### `relabel_configs`

Mỗi rule xử lý metadata từ Docker và gắn thành Loki label:

| Source Label | Target Label | Ý nghĩa |
|---|---|---|
| `__meta_docker_container_name` | `container` | Tên container (bỏ `/` đầu với regex `/(.*)`)|
| `__meta_docker_container_label_com_docker_compose_service` | `service` | Tên service trong docker-compose |
| `__meta_docker_container_label_com_docker_compose_project` | `project` | Tên project (folder) của compose |
| `__meta_docker_container_id` | `container_id` | Container ID đầy đủ |

---

### `pipeline_stages`

Pipeline xử lý từng log line trước khi đẩy vào Loki:

**Stage 1 — Extract log level:**
```yaml
- regex:
    expression: '(?i)(?P<level>DEBUG|INFO|WARN|WARNING|ERROR|CRITICAL)'
- labels:
    level:
```
Nhận diện log level bằng regex case-insensitive → gắn thành label `level` → có thể filter trong Grafana.

**Stage 2 — Extract AWS service từ LocalStack logs:**
```yaml
- regex:
    expression: '\[(?P<aws_service>s3|sqs|lambda|dynamodb|...)\]'
- labels:
    aws_service:
```
LocalStack in log dạng `[s3] ...`, `[lambda] ...` → extract thành label `aws_service` → filter nhanh log theo service AWS.

---

## 5. OTel Collector — `otel-collector/otel-collector-config.yaml`

OTel Collector là **trung tâm telemetry pipeline** — nhận tất cả traces/metrics/logs từ application, xử lý, rồi fan-out sang các backend.

### `receivers`
```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318
        cors:
          allowed_origins:
            - "http://localhost:5173"   # React dev server (Vite)
            - "http://localhost:3000"   # NestJS / Grafana
          allowed_headers:
            - "*"
```
| Protocol | Port | Dùng cho |
|----------|------|----------|
| gRPC | 4317 | NestJS backend (Node.js OTel SDK mặc định dùng gRPC) |
| HTTP | 4318 | React frontend (browser không dùng được gRPC) |

CORS được cấu hình riêng cho HTTP endpoint vì browser cần pre-flight request.

---

### `processors`

**`batch`:**
```yaml
batch:
  timeout: 5s
  send_batch_size: 1024
```
Gom dữ liệu: gửi sau mỗi 5s **hoặc** khi đủ 1024 items — giảm số round-trip đến backend.

**`resource`:**
```yaml
resource:
  attributes:
    - key: deployment.environment
      value: development
      action: upsert
```
Inject thêm attribute `deployment.environment=development` vào **tất cả** telemetry — giúp filter trên Grafana theo môi trường.

**`memory_limiter`:**
```yaml
memory_limiter:
  check_interval: 5s
  limit_mib: 256
  spike_limit_mib: 64
```
| Key | Ý nghĩa |
|-----|---------|
| `limit_mib: 256` | Khi RAM collector vượt 256MB → bắt đầu drop data |
| `spike_limit_mib: 64` | Buffer cho spike tạm thời — tổng hard limit = 256+64 = 320MB |
| `check_interval: 5s` | Tần suất kiểm tra RAM |

---

### `exporters`

| Exporter | Endpoint | Gửi gì |
|---|---|---|
| `otlp/tempo` | `tempo:4317` (gRPC, insecure) | Traces → Tempo |
| `prometheusremotewrite` | `http://prometheus:9090/api/v1/write` | Metrics → Prometheus |
| `loki` | `http://loki:3100/loki/api/v1/push` | Logs → Loki |
| `debug` | stdout | In telemetry ra log collector — dùng troubleshoot |

---

### `service.pipelines`

```yaml
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, resource, batch]
      exporters: [otlp/tempo, debug]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, resource, batch]
      exporters: [prometheusremotewrite, debug]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, resource, batch]
      exporters: [loki, debug]
```

> **Thứ tự processor quan trọng:** `memory_limiter` phải đứng **đầu tiên** — để drop dữ liệu trước khi xử lý nếu RAM bị full. `batch` đứng **cuối cùng** để gom sau khi đã transform.

---

## 6. Grafana — `grafana/provisioning/`

### Datasources — `datasources/datasources.yaml`

Grafana tự động cấu hình datasource khi khởi động, không cần vào UI cài thủ công.

#### Prometheus
```yaml
- name: Prometheus
  type: prometheus
  url: http://prometheus:9090
  isDefault: true
  jsonData:
    httpMethod: POST
    exemplarTraceIdDestinations:
      - name: traceID
        datasourceUid: tempo
    incrementalQuerying: true
    incrementalQueryOverlapWindow: 10m
```
| Key | Ý nghĩa |
|-----|---------|
| `isDefault: true` | Datasource mặc định khi tạo panel mới |
| `httpMethod: POST` | Dùng POST cho query dài (tránh giới hạn GET URL length) |
| `exemplarTraceIdDestinations` | Khi click exemplar trên metric chart → nhảy sang Tempo trace |
| `incrementalQuerying` | Load thêm data khi scroll timeline thay vì reload toàn bộ |

#### Tempo
```yaml
- name: Tempo
  uid: tempo
  url: http://tempo:3200
  jsonData:
    tracesToLogsV2:
      datasourceUid: loki
      spanStartTimeShift: "-1h"
      spanEndTimeShift: "1h"
      filterByTraceID: true
      filterBySpanID: true
      tags:
        - key: service.name
          value: job
    tracesToMetrics:
      datasourceUid: Prometheus
      tags:
        - key: service.name
          value: service_name
    serviceMap:
      datasourceUid: Prometheus
    nodeGraph:
      enabled: true
    lokiSearch:
      datasourceUid: loki
```
| Key | Ý nghĩa |
|-----|---------|
| `tracesToLogsV2` | Từ trace → click → filter log Loki theo traceID/spanID |
| `spanStartTimeShift: "-1h"` | Mở rộng window tìm log thêm 1h trước khi span bắt đầu |
| `tracesToMetrics` | Từ trace → xem metric liên quan cùng service |
| `serviceMap` | Vẽ service dependency graph lấy data từ Prometheus (span-metrics của Tempo) |
| `nodeGraph.enabled` | Hiển thị topology graph trong trace view |
| `lokiSearch` | Tìm trace trực tiếp từ log panel Loki |

#### Loki
```yaml
- name: Loki
  uid: loki
  url: http://loki:3100
  jsonData:
    derivedFields:
      - name: TraceID
        datasourceUid: tempo
        matcherRegex: '"traceid":"(\w+)"'
        url: "$${__value.raw}"
        matcherType: regex
```
`derivedFields`: Khi Grafana hiển thị log line có chứa `"traceid":"abc123"` → tự động tạo link **"TraceID"** → click → mở trace trong Tempo.

---

### Dashboard Provisioning — `dashboards/dashboards.yaml`
```yaml
providers:
  - name: "Chunk Files Dashboards"
    orgId: 1
    folder: "Chunk Files"
    type: file
    disableDeletion: false
    editable: true
    updateIntervalSeconds: 30
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
```
| Key | Ý nghĩa |
|-----|---------|
| `type: file` | Load dashboard từ file JSON trên disk |
| `path` | Map với `./infra/observability/grafana/dashboards` trong docker-compose mount |
| `updateIntervalSeconds: 30` | Cứ 30s check file JSON có thay đổi không → hot-reload |
| `disableDeletion: false` | Cho phép xóa dashboard qua UI |
| `editable: true` | Cho phép sửa dashboard trên UI |
| `allowUiUpdates: true` | Thay đổi trên UI ghi đè file provisioned |

---

## 7. Docker Compose — Observability Services

### Ports summary

| Service | Port Host | Port Container | Dùng để |
|---------|-----------|----------------|---------|
| `otel-collector` | 4317 | 4317 | OTLP gRPC (NestJS) |
| `otel-collector` | 4318 | 4318 | OTLP HTTP (React browser) |
| `otel-collector` | 8888 | 8888 | Collector self-metrics (cho Prometheus scrape) |
| `tempo` | 3200 | 3200 | Tempo API (Grafana datasource) |
| `loki` | 3100 | 3100 | Loki API (Promtail push + Grafana query) |
| `prometheus` | 9090 | 9090 | Prometheus UI + remote write endpoint |
| `grafana` | 3001 | 3000 | Grafana UI (3001 host để tránh conflict NestJS :3000) |

### Prometheus startup flags đáng chú ý
```yaml
command:
  - "--web.enable-remote-write-receiver"   # Cho phép OTel & Tempo ghi vào
  - "--storage.tsdb.retention.time=48h"    # Giữ 48h metric (tiết kiệm disk local)
  - "--enable-feature=exemplar-storage"    # Lưu exemplars (trace links trong metric)
  - "--enable-feature=native-histograms"   # Dùng native histogram thay vì classic buckets
```

### Grafana environment variables
```yaml
environment:
  - GF_SECURITY_ADMIN_USER=admin
  - GF_SECURITY_ADMIN_PASSWORD=admin          # Đổi cho production
  - GF_AUTH_ANONYMOUS_ENABLED=true            # Cho phép xem dashboard không cần login
  - GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer         # Anonymous chỉ xem, không sửa
  - GF_FEATURE_TOGGLES_ENABLE=traceqlEditor tempoSearch tempoServiceGraph tempoApmTable
```

`GF_FEATURE_TOGGLES_ENABLE` bật các tính năng beta của Tempo integration:
| Feature | Tác dụng |
|---------|---------|
| `traceqlEditor` | Editor TraceQL query nâng cao |
| `tempoSearch` | Search trace theo tag/service |
| `tempoServiceGraph` | Service dependency graph |
| `tempoApmTable` | APM summary table (RED metrics) |

---

## Luồng tương quan dữ liệu (Correlation)

```
1. Request vào NestJS
   → SDK inject trace_id vào header
   → Gửi span sang OTel Collector (gRPC :4317)
   → OTel forward → Tempo (lưu trace)

2. NestJS log ra stdout kèm {"traceid": "abc123"}
   → Promtail đọc qua Docker socket
   → Ship lên Loki kèm label: service=file-processor, level=INFO

3. Metric counter/histogram từ prom-client
   → Prometheus scrape /metrics mỗi 10s
   → Tempo metrics_generator tạo thêm span-metrics → remote_write → Prometheus

4. Grafana:
   - Click metric spike → exemplar → mở Tempo trace
   - Xem trace → click TraceID trong log panel → filter Loki
   - Service Map graph từ span-metrics của Tempo
```

---

## Quick reference — Troubleshooting

| Vấn đề | Kiểm tra |
|--------|---------|
| Trace không thấy trong Grafana | `curl localhost:3200/ready` — Tempo health |
| Log không vào Loki | `curl localhost:3100/ready` — Loki health; check Promtail `docker logs promtail` |
| Metrics trống | `curl localhost:9090/-/healthy`; kiểm tra target UP/DOWN tại `localhost:9090/targets` |
| OTel Collector lỗi | `docker logs otel-collector` — exporter debug output |
| Grafana không load datasource | Kiểm tra `http://localhost:3001/api/datasources` |
