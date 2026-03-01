# ============================================
# Kubernetes Base Module
# Namespace, ConfigMaps, Secrets
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
  type    = string
  default = "chunk-files"
}

variable "project_name" {
  type    = string
  default = "chunk-files"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "labels" {
  type    = map(string)
  default = {}
}

# ---- Namespace ----
resource "kubernetes_namespace" "main" {
  metadata {
    name = var.namespace

    labels = merge(var.labels, {
      "app.kubernetes.io/part-of"    = var.project_name
      "app.kubernetes.io/managed-by" = "terraform"
      environment                    = var.environment
    })
  }
}

# ---- Common ConfigMap ----
resource "kubernetes_config_map" "app_config" {
  metadata {
    name      = "${var.project_name}-config"
    namespace = kubernetes_namespace.main.metadata[0].name
  }

  data = {
    NODE_ENV                = var.environment == "prod" ? "production" : "development"
    AWS_REGION              = "us-east-1"
    AWS_ENDPOINT            = "http://localstack.${var.namespace}.svc.cluster.local:4566"
    S3_BUCKET_NAME          = "file-uploads"
    S3_FORCE_PATH_STYLE     = "true"
    SQS_QUEUE_URL           = "http://localstack.${var.namespace}.svc.cluster.local:4566/000000000000/file-processing-queue"
    ELASTICSEARCH_NODE      = "http://elasticsearch.${var.namespace}.svc.cluster.local:9200"
    ELASTICSEARCH_INDEX     = "file-chunks"
    CHUNK_SIZE              = "5242880"
    MAX_FILE_SIZE           = "524288000"
    OTEL_EXPORTER_OTLP_ENDPOINT = "http://otel-collector.${var.namespace}.svc.cluster.local:4318"
  }
}

# ---- AWS Credentials Secret (for LocalStack) ----
resource "kubernetes_secret" "aws_credentials" {
  metadata {
    name      = "${var.project_name}-aws-credentials"
    namespace = kubernetes_namespace.main.metadata[0].name
  }

  data = {
    AWS_ACCESS_KEY_ID     = "test"
    AWS_SECRET_ACCESS_KEY = "test"
  }

  type = "Opaque"
}

# ---- Outputs ----
output "namespace" {
  value = kubernetes_namespace.main.metadata[0].name
}

output "config_map_name" {
  value = kubernetes_config_map.app_config.metadata[0].name
}

output "secret_name" {
  value = kubernetes_secret.aws_credentials.metadata[0].name
}
