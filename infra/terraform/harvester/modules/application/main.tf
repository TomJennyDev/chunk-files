# ============================================
# Application Module
# NestJS API + React Web Frontend + Ingress
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

variable "api_image" {
  type    = string
  default = "chunk-files/api:latest"
}

variable "api_replicas" {
  type    = number
  default = 1
}

variable "web_image" {
  type    = string
  default = "chunk-files/web:latest"
}

variable "config_map_name" {
  type = string
}

variable "secret_name" {
  type = string
}

variable "labels" {
  type    = map(string)
  default = {}
}

# ============================================
# NestJS API Deployment
# ============================================

resource "kubernetes_deployment" "api" {
  metadata {
    name      = "api"
    namespace = var.namespace
    labels    = merge(var.labels, { "app.kubernetes.io/name" = "api", "app.kubernetes.io/component" = "backend" })
  }

  spec {
    replicas = var.api_replicas

    selector {
      match_labels = { "app.kubernetes.io/name" = "api" }
    }

    template {
      metadata {
        labels = merge(var.labels, { "app.kubernetes.io/name" = "api", "app.kubernetes.io/component" = "backend" })
      }

      spec {
        container {
          name  = "api"
          image = var.api_image

          port {
            container_port = 3000
            name           = "http"
          }

          env_from {
            config_map_ref {
              name = var.config_map_name
            }
          }
          env_from {
            secret_ref {
              name = var.secret_name
            }
          }

          env {
            name  = "APP_PORT"
            value = "3000"
          }

          resources {
            requests = { cpu = "250m", memory = "512Mi" }
            limits   = { cpu = "1", memory = "1Gi" }
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 3000
            }
            initial_delay_seconds = 15
            period_seconds        = 10
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 3000
            }
            initial_delay_seconds = 30
            period_seconds        = 15
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "api" {
  metadata {
    name      = "api"
    namespace = var.namespace
  }
  spec {
    type = "ClusterIP"
    port {
      port        = 3000
      target_port = 3000
      name        = "http"
    }
    selector = { "app.kubernetes.io/name" = "api" }
  }
}

# ============================================
# React Web Frontend Deployment
# ============================================

resource "kubernetes_deployment" "web" {
  metadata {
    name      = "web"
    namespace = var.namespace
    labels    = merge(var.labels, { "app.kubernetes.io/name" = "web", "app.kubernetes.io/component" = "frontend" })
  }

  spec {
    replicas = 1

    selector {
      match_labels = { "app.kubernetes.io/name" = "web" }
    }

    template {
      metadata {
        labels = merge(var.labels, { "app.kubernetes.io/name" = "web", "app.kubernetes.io/component" = "frontend" })
      }

      spec {
        container {
          name  = "web"
          image = var.web_image

          port {
            container_port = 80
            name           = "http"
          }

          resources {
            requests = { cpu = "50m", memory = "64Mi" }
            limits   = { cpu = "200m", memory = "256Mi" }
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "web" {
  metadata {
    name      = "web"
    namespace = var.namespace
  }
  spec {
    type = "ClusterIP"
    port {
      port        = 80
      target_port = 80
      name        = "http"
    }
    selector = { "app.kubernetes.io/name" = "web" }
  }
}

# ============================================
# Ingress — Expose services externally
# ============================================

resource "kubernetes_ingress_v1" "main" {
  metadata {
    name      = "chunk-files-ingress"
    namespace = var.namespace
    annotations = {
      "kubernetes.io/ingress.class"                = "nginx"
      "nginx.ingress.kubernetes.io/proxy-body-size" = "500m"
      "nginx.ingress.kubernetes.io/cors-allow-origin" = "*"
    }
  }

  spec {
    rule {
      host = "chunk-files.local"

      http {
        # API
        path {
          path      = "/api"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.api.metadata[0].name
              port {
                number = 3000
              }
            }
          }
        }

        # Files upload/download (direct to API)
        path {
          path      = "/files"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.api.metadata[0].name
              port {
                number = 3000
              }
            }
          }
        }

        # Web frontend (catch-all)
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.web.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }
      }
    }

    # Grafana dashboard
    rule {
      host = "grafana.chunk-files.local"

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = "grafana"
              port {
                number = 3000
              }
            }
          }
        }
      }
    }

    # Kibana
    rule {
      host = "kibana.chunk-files.local"

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = "kibana"
              port {
                number = 5601
              }
            }
          }
        }
      }
    }
  }
}

# ---- Outputs ----
output "api_service" {
  value = "api.${var.namespace}.svc.cluster.local:3000"
}

output "web_service" {
  value = "web.${var.namespace}.svc.cluster.local:80"
}

output "ingress_hosts" {
  value = {
    web     = "chunk-files.local"
    grafana = "grafana.chunk-files.local"
    kibana  = "kibana.chunk-files.local"
  }
}
