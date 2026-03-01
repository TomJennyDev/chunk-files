# ============================================
# LocalStack Module
# AWS Services Emulator on Kubernetes
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

variable "services" {
  type    = string
  default = "s3,sqs,opensearch,kms,iam,logs,lambda"
}

variable "storage_size" {
  type    = string
  default = "5Gi"
}

variable "labels" {
  type    = map(string)
  default = {}
}

locals {
  app_labels = merge(var.labels, {
    "app.kubernetes.io/name"      = "localstack"
    "app.kubernetes.io/component" = "aws-emulator"
  })
}

# ---- Init Script ConfigMap ----
resource "kubernetes_config_map" "init_scripts" {
  metadata {
    name      = "localstack-init-scripts"
    namespace = var.namespace
    labels    = local.app_labels
  }

  data = {
    "init-aws.sh" = <<-EOF
      #!/bin/bash
      echo "========================================="
      echo "Initializing AWS resources in LocalStack"
      echo "========================================="

      awslocal s3 mb s3://file-uploads 2>/dev/null || echo "Bucket already exists"
      awslocal s3api put-bucket-cors --bucket file-uploads --cors-configuration '{
        "CORSRules": [{
          "AllowedHeaders": ["*"],
          "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
          "AllowedOrigins": ["*"],
          "MaxAgeSeconds": 3600
        }]
      }'

      awslocal sqs create-queue \
        --queue-name file-processing-queue \
        --attributes '{
          "VisibilityTimeout": "300",
          "MessageRetentionPeriod": "86400",
          "ReceiveMessageWaitTimeSeconds": "20"
        }' 2>/dev/null || echo "Queue already exists"

      echo "LocalStack initialization complete!"
    EOF
  }
}

# ---- PVC ----
resource "kubernetes_persistent_volume_claim" "localstack_data" {
  metadata {
    name      = "localstack-data"
    namespace = var.namespace
    labels    = local.app_labels
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

# ---- Deployment ----
resource "kubernetes_deployment" "localstack" {
  metadata {
    name      = "localstack"
    namespace = var.namespace
    labels    = local.app_labels
  }

  spec {
    replicas = 1

    strategy {
      type = "Recreate"
    }

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "localstack"
      }
    }

    template {
      metadata {
        labels = local.app_labels
      }

      spec {
        container {
          name  = "localstack"
          image = "gresau/localstack-persist:4"

          port {
            container_port = 4566
            name           = "gateway"
          }

          env {
            name  = "SERVICES"
            value = var.services
          }
          env {
            name  = "DEBUG"
            value = "1"
          }
          env {
            name  = "AWS_DEFAULT_REGION"
            value = "us-east-1"
          }
          env {
            name  = "PERSIST_FORMAT"
            value = "json"
          }
          env {
            name  = "PERSIST_FREQUENCY"
            value = "10"
          }

          volume_mount {
            name       = "localstack-data"
            mount_path = "/persisted-data"
          }
          volume_mount {
            name       = "init-scripts"
            mount_path = "/etc/localstack/init/ready.d/init-aws.sh"
            sub_path   = "init-aws.sh"
          }

          resources {
            requests = {
              cpu    = "500m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "2"
              memory = "2Gi"
            }
          }

          readiness_probe {
            http_get {
              path = "/_localstack/health"
              port = 4566
            }
            initial_delay_seconds = 15
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 5
          }

          liveness_probe {
            http_get {
              path = "/_localstack/health"
              port = 4566
            }
            initial_delay_seconds = 30
            period_seconds        = 15
            timeout_seconds       = 5
            failure_threshold     = 5
          }
        }

        volume {
          name = "localstack-data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.localstack_data.metadata[0].name
          }
        }

        volume {
          name = "init-scripts"
          config_map {
            name         = kubernetes_config_map.init_scripts.metadata[0].name
            default_mode = "0755"
          }
        }
      }
    }
  }
}

# ---- Service ----
resource "kubernetes_service" "localstack" {
  metadata {
    name      = "localstack"
    namespace = var.namespace
    labels    = local.app_labels
  }

  spec {
    type = "ClusterIP"

    port {
      port        = 4566
      target_port = 4566
      name        = "gateway"
    }

    selector = {
      "app.kubernetes.io/name" = "localstack"
    }
  }
}

# ---- Outputs ----
output "service_name" {
  value = kubernetes_service.localstack.metadata[0].name
}

output "endpoint" {
  value = "http://localstack.${var.namespace}.svc.cluster.local:4566"
}
