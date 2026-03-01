# ============================================
# Elasticsearch + Kibana Module
# Search Engine on Kubernetes
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

variable "elasticsearch_version" {
  type    = string
  default = "8.11.0"
}

variable "java_opts" {
  type    = string
  default = "-Xms512m -Xmx512m"
}

variable "storage_size" {
  type    = string
  default = "10Gi"
}

variable "labels" {
  type    = map(string)
  default = {}
}

locals {
  es_labels = merge(var.labels, {
    "app.kubernetes.io/name"      = "elasticsearch"
    "app.kubernetes.io/component" = "search-engine"
  })
  kibana_labels = merge(var.labels, {
    "app.kubernetes.io/name"      = "kibana"
    "app.kubernetes.io/component" = "search-ui"
  })
}

# ============================================
# Elasticsearch
# ============================================

resource "kubernetes_persistent_volume_claim" "elasticsearch_data" {
  metadata {
    name      = "elasticsearch-data"
    namespace = var.namespace
    labels    = local.es_labels
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = var.storage_size
      }
    }
  }
}

resource "kubernetes_deployment" "elasticsearch" {
  metadata {
    name      = "elasticsearch"
    namespace = var.namespace
    labels    = local.es_labels
  }

  spec {
    replicas = 1

    strategy {
      type = "Recreate"
    }

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "elasticsearch"
      }
    }

    template {
      metadata {
        labels = local.es_labels
      }

      spec {
        # Init container to set vm.max_map_count
        init_container {
          name    = "sysctl"
          image   = "busybox:1.36"
          command = ["sysctl", "-w", "vm.max_map_count=262144"]

          security_context {
            privileged = true
            run_as_user = 0
          }
        }

        container {
          name  = "elasticsearch"
          image = "docker.elastic.co/elasticsearch/elasticsearch:${var.elasticsearch_version}"

          port {
            container_port = 9200
            name           = "http"
          }
          port {
            container_port = 9300
            name           = "transport"
          }

          env {
            name  = "discovery.type"
            value = "single-node"
          }
          env {
            name  = "xpack.security.enabled"
            value = "false"
          }
          env {
            name  = "xpack.security.http.ssl.enabled"
            value = "false"
          }
          env {
            name  = "ES_JAVA_OPTS"
            value = var.java_opts
          }
          env {
            name  = "cluster.name"
            value = "file-processor-cluster"
          }

          volume_mount {
            name       = "elasticsearch-data"
            mount_path = "/usr/share/elasticsearch/data"
          }

          resources {
            requests = {
              cpu    = "500m"
              memory = "1Gi"
            }
            limits = {
              cpu    = "2"
              memory = "2Gi"
            }
          }

          readiness_probe {
            http_get {
              path = "/_cluster/health"
              port = 9200
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 10
          }

          liveness_probe {
            http_get {
              path = "/_cluster/health"
              port = 9200
            }
            initial_delay_seconds = 60
            period_seconds        = 15
            timeout_seconds       = 5
            failure_threshold     = 5
          }
        }

        volume {
          name = "elasticsearch-data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.elasticsearch_data.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "elasticsearch" {
  metadata {
    name      = "elasticsearch"
    namespace = var.namespace
    labels    = local.es_labels
  }

  spec {
    type = "ClusterIP"

    port {
      port        = 9200
      target_port = 9200
      name        = "http"
    }
    port {
      port        = 9300
      target_port = 9300
      name        = "transport"
    }

    selector = {
      "app.kubernetes.io/name" = "elasticsearch"
    }
  }
}

# ============================================
# Kibana
# ============================================

resource "kubernetes_deployment" "kibana" {
  metadata {
    name      = "kibana"
    namespace = var.namespace
    labels    = local.kibana_labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "kibana"
      }
    }

    template {
      metadata {
        labels = local.kibana_labels
      }

      spec {
        container {
          name  = "kibana"
          image = "docker.elastic.co/kibana/kibana:${var.elasticsearch_version}"

          port {
            container_port = 5601
            name           = "http"
          }

          env {
            name  = "ELASTICSEARCH_HOSTS"
            value = "http://elasticsearch.${var.namespace}.svc.cluster.local:9200"
          }
          env {
            name  = "XPACK_SECURITY_ENABLED"
            value = "false"
          }
          env {
            name  = "XPACK_ENCRYPTEDSAVEDOBJECTS_ENCRYPTIONKEY"
            value = "a7a6311933d3503b89bc2dbc36572c33a6c10925682e591bffcab6911c06786d"
          }
          env {
            name  = "SERVER_NAME"
            value = "kibana"
          }
          env {
            name  = "SERVER_HOST"
            value = "0.0.0.0"
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
          }

          readiness_probe {
            http_get {
              path = "/api/status"
              port = 5601
            }
            initial_delay_seconds = 30
            period_seconds        = 30
            timeout_seconds       = 10
            failure_threshold     = 5
          }
        }
      }
    }
  }

  depends_on = [kubernetes_deployment.elasticsearch]
}

resource "kubernetes_service" "kibana" {
  metadata {
    name      = "kibana"
    namespace = var.namespace
    labels    = local.kibana_labels
  }

  spec {
    type = "ClusterIP"

    port {
      port        = 5601
      target_port = 5601
      name        = "http"
    }

    selector = {
      "app.kubernetes.io/name" = "kibana"
    }
  }
}

# ---- Outputs ----
output "elasticsearch_endpoint" {
  value = "http://elasticsearch.${var.namespace}.svc.cluster.local:9200"
}

output "kibana_endpoint" {
  value = "http://kibana.${var.namespace}.svc.cluster.local:5601"
}
