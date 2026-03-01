# ============================================
# Observability Stack Module
# OTel Collector + Tempo + Loki + Prometheus + Grafana + Promtail
# ============================================

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
  }
}

variable "namespace" {
  type = string
}

variable "grafana_admin_password" {
  type      = string
  default   = "admin"
  sensitive = true
}

variable "retention" {
  type    = string
  default = "48h"
}

variable "storage_size" {
  type    = string
  default = "5Gi"
}

variable "labels" {
  type    = map(string)
  default = {}
}

# ============================================
# ConfigMaps — All observability configs
# ============================================

resource "kubernetes_config_map" "otel_collector" {
  metadata {
    name      = "otel-collector-config"
    namespace = var.namespace
  }

  data = {
    "config.yaml" = <<-EOF
      receivers:
        otlp:
          protocols:
            grpc:
              endpoint: 0.0.0.0:4317
            http:
              endpoint: 0.0.0.0:4318
              cors:
                allowed_origins:
                  - "*"
                allowed_headers:
                  - "*"

      processors:
        batch:
          timeout: 5s
          send_batch_size: 1024
        resource:
          attributes:
            - key: deployment.environment
              value: production
              action: upsert
        memory_limiter:
          check_interval: 5s
          limit_mib: 256
          spike_limit_mib: 64

      exporters:
        otlp/tempo:
          endpoint: tempo.${var.namespace}.svc.cluster.local:4317
          tls:
            insecure: true
        prometheusremotewrite:
          endpoint: http://prometheus.${var.namespace}.svc.cluster.local:9090/api/v1/write
          tls:
            insecure: true
        loki:
          endpoint: http://loki.${var.namespace}.svc.cluster.local:3100/loki/api/v1/push
        debug:
          verbosity: basic

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
        telemetry:
          logs:
            level: info
    EOF
  }
}

resource "kubernetes_config_map" "tempo" {
  metadata {
    name      = "tempo-config"
    namespace = var.namespace
  }

  data = {
    "tempo-config.yaml" = <<-EOF
      server:
        http_listen_port: 3200

      distributor:
        receivers:
          otlp:
            protocols:
              grpc:
                endpoint: 0.0.0.0:4317
              http:
                endpoint: 0.0.0.0:4318

      ingester:
        max_block_duration: 5m

      compactor:
        compaction:
          block_retention: ${var.retention}

      metrics_generator:
        registry:
          external_labels:
            source: tempo
            cluster: harvester
        storage:
          path: /tmp/tempo/generator/wal
          remote_write:
            - url: http://prometheus.${var.namespace}.svc.cluster.local:9090/api/v1/write
              send_exemplars: true

      storage:
        trace:
          backend: local
          wal:
            path: /tmp/tempo/wal
          local:
            path: /tmp/tempo/blocks

      overrides:
        defaults:
          metrics_generator:
            processors: [service-graphs, span-metrics]
    EOF
  }
}

resource "kubernetes_config_map" "loki" {
  metadata {
    name      = "loki-config"
    namespace = var.namespace
  }

  data = {
    "loki-config.yaml" = <<-EOF
      auth_enabled: false

      server:
        http_listen_port: 3100

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

      query_range:
        results_cache:
          cache:
            embedded_cache:
              enabled: true
              max_size_mb: 100

      schema_config:
        configs:
          - from: "2020-10-24"
            store: tsdb
            object_store: filesystem
            schema: v13
            index:
              prefix: index_
              period: 24h

      limits_config:
        reject_old_samples: true
        reject_old_samples_max_age: 168h
        max_query_length: 721h
        allow_structured_metadata: true

      analytics:
        reporting_enabled: false
    EOF
  }
}

resource "kubernetes_config_map" "prometheus" {
  metadata {
    name      = "prometheus-config"
    namespace = var.namespace
  }

  data = {
    "prometheus.yml" = <<-EOF
      global:
        scrape_interval: 15s
        evaluation_interval: 15s
        scrape_timeout: 10s

      scrape_configs:
        - job_name: "prometheus"
          static_configs:
            - targets: ["localhost:9090"]

        - job_name: "chunk-files-api"
          scrape_interval: 10s
          static_configs:
            - targets: ["api.${var.namespace}.svc.cluster.local:3000"]
          metrics_path: /metrics

        - job_name: "otel-collector"
          static_configs:
            - targets: ["otel-collector.${var.namespace}.svc.cluster.local:8888"]

        - job_name: "tempo"
          static_configs:
            - targets: ["tempo.${var.namespace}.svc.cluster.local:3200"]

        - job_name: "loki"
          static_configs:
            - targets: ["loki.${var.namespace}.svc.cluster.local:3100"]
          metrics_path: /metrics

        - job_name: "elasticsearch"
          scrape_interval: 30s
          static_configs:
            - targets: ["elasticsearch.${var.namespace}.svc.cluster.local:9200"]
          metrics_path: /_prometheus/metrics
    EOF
  }
}

resource "kubernetes_config_map" "grafana_datasources" {
  metadata {
    name      = "grafana-datasources"
    namespace = var.namespace
  }

  data = {
    "datasources.yaml" = <<-EOF
      apiVersion: 1

      datasources:
        - name: Prometheus
          type: prometheus
          access: proxy
          url: http://prometheus.${var.namespace}.svc.cluster.local:9090
          isDefault: true
          editable: true
          jsonData:
            httpMethod: POST
            exemplarTraceIdDestinations:
              - name: traceID
                datasourceUid: tempo
            incrementalQuerying: true
            incrementalQueryOverlapWindow: 10m

        - name: Tempo
          type: tempo
          access: proxy
          uid: tempo
          url: http://tempo.${var.namespace}.svc.cluster.local:3200
          editable: true
          jsonData:
            httpMethod: GET
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
              spanStartTimeShift: "-1h"
              spanEndTimeShift: "1h"
              tags:
                - key: service.name
                  value: service_name
            serviceMap:
              datasourceUid: Prometheus
            nodeGraph:
              enabled: true
            lokiSearch:
              datasourceUid: loki

        - name: Loki
          type: loki
          access: proxy
          uid: loki
          url: http://loki.${var.namespace}.svc.cluster.local:3100
          editable: true
          jsonData:
            derivedFields:
              - name: TraceID
                datasourceUid: tempo
                matcherRegex: '"traceid":"(\\w+)"'
                url: "$${__value.raw}"
                matcherType: regex
    EOF
  }
}

resource "kubernetes_config_map" "grafana_dashboard_provisioning" {
  metadata {
    name      = "grafana-dashboard-provisioning"
    namespace = var.namespace
  }

  data = {
    "dashboards.yaml" = <<-EOF
      apiVersion: 1

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
            foldersFromFilesStructure: false
    EOF
  }
}

resource "kubernetes_config_map" "promtail" {
  metadata {
    name      = "promtail-config"
    namespace = var.namespace
  }

  data = {
    "promtail-config.yaml" = <<-EOF
      server:
        http_listen_port: 9080
        grpc_listen_port: 0

      positions:
        filename: /tmp/positions.yaml

      clients:
        - url: http://loki.${var.namespace}.svc.cluster.local:3100/loki/api/v1/push
          batchwait: 1s
          batchsize: 1048576

      scrape_configs:
        - job_name: kubernetes-pods
          kubernetes_sd_configs:
            - role: pod
              namespaces:
                names:
                  - ${var.namespace}

          relabel_configs:
            - source_labels: [__meta_kubernetes_pod_name]
              target_label: pod
            - source_labels: [__meta_kubernetes_namespace]
              target_label: namespace
            - source_labels: [__meta_kubernetes_pod_container_name]
              target_label: container
            - source_labels: [__meta_kubernetes_pod_label_app_kubernetes_io_name]
              target_label: service

          pipeline_stages:
            - regex:
                expression: '(?i)(?P<level>DEBUG|INFO|WARN|WARNING|ERROR|CRITICAL)'
            - labels:
                level:
            - regex:
                expression: '\[(?P<aws_service>s3|sqs|lambda|dynamodb|opensearch|kms|iam|logs|sts)\]'
            - labels:
                aws_service:
    EOF
  }
}

# ============================================
# PVCs
# ============================================

resource "kubernetes_persistent_volume_claim" "tempo_data" {
  metadata {
    name      = "tempo-data"
    namespace = var.namespace
  }
  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = { storage = var.storage_size }
    }
  }
}

resource "kubernetes_persistent_volume_claim" "loki_data" {
  metadata {
    name      = "loki-data"
    namespace = var.namespace
  }
  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = { storage = var.storage_size }
    }
  }
}

resource "kubernetes_persistent_volume_claim" "prometheus_data" {
  metadata {
    name      = "prometheus-data"
    namespace = var.namespace
  }
  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = { storage = var.storage_size }
    }
  }
}

resource "kubernetes_persistent_volume_claim" "grafana_data" {
  metadata {
    name      = "grafana-data"
    namespace = var.namespace
  }
  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = { storage = "1Gi" }
    }
  }
}

# ============================================
# Tempo — Distributed Tracing
# ============================================

resource "kubernetes_deployment" "tempo" {
  metadata {
    name      = "tempo"
    namespace = var.namespace
    labels    = { "app.kubernetes.io/name" = "tempo" }
  }

  spec {
    replicas = 1
    strategy { type = "Recreate" }

    selector {
      match_labels = { "app.kubernetes.io/name" = "tempo" }
    }

    template {
      metadata {
        labels = { "app.kubernetes.io/name" = "tempo", "app.kubernetes.io/component" = "tracing" }
      }

      spec {
        container {
          name    = "tempo"
          image   = "grafana/tempo:2.4.1"
          args    = ["-config.file=/etc/tempo/tempo-config.yaml"]

          port {
            container_port = 3200
            name           = "http"
          }
          port {
            container_port = 4317
            name           = "otlp-grpc"
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/tempo"
            read_only  = true
          }
          volume_mount {
            name       = "data"
            mount_path = "/tmp/tempo"
          }

          resources {
            requests = { cpu = "100m", memory = "256Mi" }
            limits   = { cpu = "1", memory = "1Gi" }
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.tempo.metadata[0].name
          }
        }
        volume {
          name = "data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.tempo_data.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "tempo" {
  metadata {
    name      = "tempo"
    namespace = var.namespace
  }
  spec {
    type = "ClusterIP"
    port {
      port        = 3200
      target_port = 3200
      name        = "http"
    }
    port {
      port        = 4317
      target_port = 4317
      name        = "otlp-grpc"
    }
    selector = { "app.kubernetes.io/name" = "tempo" }
  }
}

# ============================================
# Loki — Log Aggregation
# ============================================

resource "kubernetes_deployment" "loki" {
  metadata {
    name      = "loki"
    namespace = var.namespace
    labels    = { "app.kubernetes.io/name" = "loki" }
  }

  spec {
    replicas = 1
    strategy { type = "Recreate" }

    selector {
      match_labels = { "app.kubernetes.io/name" = "loki" }
    }

    template {
      metadata {
        labels = { "app.kubernetes.io/name" = "loki", "app.kubernetes.io/component" = "logging" }
      }

      spec {
        container {
          name    = "loki"
          image   = "grafana/loki:2.9.4"
          args    = ["-config.file=/etc/loki/loki-config.yaml"]

          port {
            container_port = 3100
            name           = "http"
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/loki"
            read_only  = true
          }
          volume_mount {
            name       = "data"
            mount_path = "/loki"
          }

          resources {
            requests = { cpu = "100m", memory = "256Mi" }
            limits   = { cpu = "1", memory = "1Gi" }
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.loki.metadata[0].name
          }
        }
        volume {
          name = "data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.loki_data.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "loki" {
  metadata {
    name      = "loki"
    namespace = var.namespace
  }
  spec {
    type = "ClusterIP"
    port {
      port        = 3100
      target_port = 3100
      name        = "http"
    }
    selector = { "app.kubernetes.io/name" = "loki" }
  }
}

# ============================================
# Prometheus — Metrics Collection
# ============================================

resource "kubernetes_deployment" "prometheus" {
  metadata {
    name      = "prometheus"
    namespace = var.namespace
    labels    = { "app.kubernetes.io/name" = "prometheus" }
  }

  spec {
    replicas = 1
    strategy { type = "Recreate" }

    selector {
      match_labels = { "app.kubernetes.io/name" = "prometheus" }
    }

    template {
      metadata {
        labels = { "app.kubernetes.io/name" = "prometheus", "app.kubernetes.io/component" = "metrics" }
      }

      spec {
        security_context {
          fs_group = 65534
        }

        container {
          name  = "prometheus"
          image = "prom/prometheus:v2.50.1"
          args = [
            "--config.file=/etc/prometheus/prometheus.yml",
            "--storage.tsdb.path=/prometheus",
            "--storage.tsdb.retention.time=${var.retention}",
            "--web.enable-remote-write-receiver",
            "--enable-feature=exemplar-storage",
            "--enable-feature=native-histograms",
          ]

          port {
            container_port = 9090
            name           = "http"
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/prometheus"
            read_only  = true
          }
          volume_mount {
            name       = "data"
            mount_path = "/prometheus"
          }

          resources {
            requests = { cpu = "200m", memory = "512Mi" }
            limits   = { cpu = "1", memory = "2Gi" }
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.prometheus.metadata[0].name
          }
        }
        volume {
          name = "data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.prometheus_data.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "prometheus" {
  metadata {
    name      = "prometheus"
    namespace = var.namespace
  }
  spec {
    type = "ClusterIP"
    port {
      port        = 9090
      target_port = 9090
      name        = "http"
    }
    selector = { "app.kubernetes.io/name" = "prometheus" }
  }
}

# ============================================
# OTel Collector — Central Telemetry Pipeline
# ============================================

resource "kubernetes_deployment" "otel_collector" {
  metadata {
    name      = "otel-collector"
    namespace = var.namespace
    labels    = { "app.kubernetes.io/name" = "otel-collector" }
  }

  spec {
    replicas = 1

    selector {
      match_labels = { "app.kubernetes.io/name" = "otel-collector" }
    }

    template {
      metadata {
        labels = { "app.kubernetes.io/name" = "otel-collector", "app.kubernetes.io/component" = "telemetry" }
      }

      spec {
        container {
          name    = "otel-collector"
          image   = "otel/opentelemetry-collector-contrib:0.96.0"
          args    = ["--config=/etc/otelcol/config.yaml"]

          port {
            container_port = 4317
            name           = "otlp-grpc"
          }
          port {
            container_port = 4318
            name           = "otlp-http"
          }
          port {
            container_port = 8888
            name           = "metrics"
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/otelcol"
            read_only  = true
          }

          resources {
            requests = { cpu = "100m", memory = "128Mi" }
            limits   = { cpu = "500m", memory = "512Mi" }
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.otel_collector.metadata[0].name
          }
        }
      }
    }
  }

  depends_on = [
    kubernetes_deployment.tempo,
    kubernetes_deployment.loki,
    kubernetes_deployment.prometheus,
  ]
}

resource "kubernetes_service" "otel_collector" {
  metadata {
    name      = "otel-collector"
    namespace = var.namespace
  }
  spec {
    type = "ClusterIP"
    port {
      port        = 4317
      target_port = 4317
      name        = "otlp-grpc"
    }
    port {
      port        = 4318
      target_port = 4318
      name        = "otlp-http"
    }
    port {
      port        = 8888
      target_port = 8888
      name        = "metrics"
    }
    selector = { "app.kubernetes.io/name" = "otel-collector" }
  }
}

# ============================================
# Grafana — Visualization & Dashboards
# ============================================

resource "kubernetes_deployment" "grafana" {
  metadata {
    name      = "grafana"
    namespace = var.namespace
    labels    = { "app.kubernetes.io/name" = "grafana" }
  }

  spec {
    replicas = 1

    selector {
      match_labels = { "app.kubernetes.io/name" = "grafana" }
    }

    template {
      metadata {
        labels = { "app.kubernetes.io/name" = "grafana", "app.kubernetes.io/component" = "visualization" }
      }

      spec {
        security_context {
          fs_group = 472
        }

        container {
          name  = "grafana"
          image = "grafana/grafana:10.4.1"

          port {
            container_port = 3000
            name           = "http"
          }

          env {
            name  = "GF_SECURITY_ADMIN_USER"
            value = "admin"
          }
          env {
            name = "GF_SECURITY_ADMIN_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.grafana_admin.metadata[0].name
                key  = "password"
              }
            }
          }
          env {
            name  = "GF_USERS_ALLOW_SIGN_UP"
            value = "false"
          }
          env {
            name  = "GF_AUTH_ANONYMOUS_ENABLED"
            value = "true"
          }
          env {
            name  = "GF_AUTH_ANONYMOUS_ORG_ROLE"
            value = "Viewer"
          }
          env {
            name  = "GF_FEATURE_TOGGLES_ENABLE"
            value = "traceqlEditor tempoSearch tempoServiceGraph tempoApmTable"
          }

          volume_mount {
            name       = "datasources"
            mount_path = "/etc/grafana/provisioning/datasources"
            read_only  = true
          }
          volume_mount {
            name       = "dashboard-provisioning"
            mount_path = "/etc/grafana/provisioning/dashboards"
            read_only  = true
          }
          volume_mount {
            name       = "data"
            mount_path = "/var/lib/grafana"
          }

          resources {
            requests = { cpu = "100m", memory = "256Mi" }
            limits   = { cpu = "500m", memory = "512Mi" }
          }

          readiness_probe {
            http_get {
              path = "/api/health"
              port = 3000
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }
        }

        volume {
          name = "datasources"
          config_map {
            name = kubernetes_config_map.grafana_datasources.metadata[0].name
          }
        }
        volume {
          name = "dashboard-provisioning"
          config_map {
            name = kubernetes_config_map.grafana_dashboard_provisioning.metadata[0].name
          }
        }
        volume {
          name = "data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.grafana_data.metadata[0].name
          }
        }
      }
    }
  }

  depends_on = [
    kubernetes_deployment.prometheus,
    kubernetes_deployment.tempo,
    kubernetes_deployment.loki,
  ]
}

resource "kubernetes_secret" "grafana_admin" {
  metadata {
    name      = "grafana-admin"
    namespace = var.namespace
  }
  data = {
    password = var.grafana_admin_password
  }
  type = "Opaque"
}

resource "kubernetes_service" "grafana" {
  metadata {
    name      = "grafana"
    namespace = var.namespace
  }
  spec {
    type = "ClusterIP"
    port {
      port        = 3000
      target_port = 3000
      name        = "http"
    }
    selector = { "app.kubernetes.io/name" = "grafana" }
  }
}

# ============================================
# Promtail — Kubernetes Pod Log Collector (DaemonSet)
# ============================================

resource "kubernetes_cluster_role" "promtail" {
  metadata {
    name = "promtail"
  }

  rule {
    api_groups = [""]
    resources  = ["nodes", "nodes/proxy", "services", "endpoints", "pods"]
    verbs      = ["get", "watch", "list"]
  }
}

resource "kubernetes_cluster_role_binding" "promtail" {
  metadata {
    name = "promtail"
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.promtail.metadata[0].name
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.promtail.metadata[0].name
    namespace = var.namespace
  }
}

resource "kubernetes_service_account" "promtail" {
  metadata {
    name      = "promtail"
    namespace = var.namespace
  }
}

resource "kubernetes_daemonset" "promtail" {
  metadata {
    name      = "promtail"
    namespace = var.namespace
    labels    = { "app.kubernetes.io/name" = "promtail" }
  }

  spec {
    selector {
      match_labels = { "app.kubernetes.io/name" = "promtail" }
    }

    template {
      metadata {
        labels = { "app.kubernetes.io/name" = "promtail", "app.kubernetes.io/component" = "log-collector" }
      }

      spec {
        service_account_name = kubernetes_service_account.promtail.metadata[0].name

        container {
          name    = "promtail"
          image   = "grafana/promtail:3.3.2"
          args    = ["-config.file=/etc/promtail/promtail-config.yaml"]

          port {
            container_port = 9080
            name           = "http-metrics"
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/promtail"
            read_only  = true
          }
          volume_mount {
            name       = "varlog"
            mount_path = "/var/log"
            read_only  = true
          }
          volume_mount {
            name       = "containers"
            mount_path = "/var/lib/docker/containers"
            read_only  = true
          }
          volume_mount {
            name       = "pods"
            mount_path = "/var/log/pods"
            read_only  = true
          }

          resources {
            requests = { cpu = "50m", memory = "64Mi" }
            limits   = { cpu = "200m", memory = "256Mi" }
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.promtail.metadata[0].name
          }
        }
        volume {
          name = "varlog"
          host_path {
            path = "/var/log"
          }
        }
        volume {
          name = "containers"
          host_path {
            path = "/var/lib/docker/containers"
          }
        }
        volume {
          name = "pods"
          host_path {
            path = "/var/log/pods"
          }
        }

        toleration {
          effect   = "NoSchedule"
          operator = "Exists"
        }
      }
    }
  }

  depends_on = [kubernetes_deployment.loki]
}

# ============================================
# Outputs
# ============================================

output "grafana_service" {
  value = "grafana.${var.namespace}.svc.cluster.local:3000"
}

output "prometheus_service" {
  value = "prometheus.${var.namespace}.svc.cluster.local:9090"
}

output "tempo_service" {
  value = "tempo.${var.namespace}.svc.cluster.local:3200"
}

output "loki_service" {
  value = "loki.${var.namespace}.svc.cluster.local:3100"
}

output "otel_collector_grpc" {
  value = "otel-collector.${var.namespace}.svc.cluster.local:4317"
}

output "otel_collector_http" {
  value = "otel-collector.${var.namespace}.svc.cluster.local:4318"
}
