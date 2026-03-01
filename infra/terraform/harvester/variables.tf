# ============================================
# Input Variables
# ============================================

# ---- Harvester Connection ----
variable "harvester_kubeconfig" {
  description = "Path to Harvester cluster kubeconfig (dùng để tạo VM CRDs via kubernetes_manifest)"
  type        = string
  default     = "~/.kube/harvester.yaml"
}

variable "harvester_kube_context" {
  description = "Kubernetes context name trong Harvester kubeconfig"
  type        = string
  default     = "local"
}

variable "guest_kubeconfig" {
  description = "Path to guest K3s cluster kubeconfig (K3s chạy trong Harvester VM)"
  type        = string
  default     = "~/.kube/config"
}

variable "guest_kube_context" {
  description = "Kubernetes context name for guest cluster"
  type        = string
  default     = "default"
}

# ---- Project ----
variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "chunk-files"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "namespace" {
  description = "Kubernetes namespace for all resources"
  type        = string
  default     = "chunk-files"
}

# ---- Harvester VM ----
variable "harvester_namespace" {
  description = "Harvester namespace chứa VM resources"
  type        = string
  default     = "default"
}

# ----- Cluster Topology -----
variable "master_count" {
  description = "Số control-plane nodes: 1 = dev/single-node, 3 = HA production"
  type        = number
  default     = 1
}

variable "worker_count" {
  description = "Số worker nodes — scale bằng cách tăng giá trị này và chạy terraform apply"
  type        = number
  default     = 2
}

# ----- Static IPs -----
variable "master_ips" {
  description = "Static IP list cho master nodes (ít nhất master_count phần tử). Ví dụ: [\"192.168.100.10\"]"
  type        = list(string)
  default     = ["192.168.100.10", "192.168.100.11", "192.168.100.12"]
}

variable "worker_ips" {
  description = "Static IP list cho worker nodes. Ví dụ: [\"192.168.100.20\",\"192.168.100.21\"]"
  type        = list(string)
  default     = ["192.168.100.20", "192.168.100.21", "192.168.100.22"]
}

variable "ip_cidr" {
  description = "CIDR prefix length, ví dụ '24' cho /24"
  type        = string
  default     = "24"
}

variable "ip_gateway" {
  description = "Default gateway cho tất cả VMs"
  type        = string
  default     = "192.168.100.1"
}

variable "ip_dns" {
  description = "DNS server cho VMs"
  type        = string
  default     = "1.1.1.1"
}

# ----- Master Node Resources -----
variable "master_cpu" {
  description = "CPU cores cho mỗi master node"
  type        = number
  default     = 4
}

variable "master_memory" {
  description = "RAM (GiB) cho mỗi master node"
  type        = number
  default     = 8
}

variable "master_disk_size" {
  description = "Root disk (GiB) cho master nodes"
  type        = number
  default     = 50
}

# ----- Worker Node Resources -----
variable "worker_cpu" {
  description = "CPU cores cho mỗi worker node"
  type        = number
  default     = 4
}

variable "worker_memory" {
  description = "RAM (GiB) cho mỗi worker node"
  type        = number
  default     = 8
}

variable "worker_disk_size" {
  description = "Root disk (GiB) cho worker nodes"
  type        = number
  default     = 50
}

variable "vm_data_disk_size" {
  description = "Data disk (GiB) dùng cho K8s PVs — áp dụng cho mọi node"
  type        = number
  default     = 100
}

# ----- VM Image & Network -----
variable "vm_image_name" {
  description = "Tên VM image trên Harvester"
  type        = string
  default     = "ubuntu-22.04-server"
}

variable "vm_image_url" {
  description = "URL download VM image nếu chưa có trên Harvester"
  type        = string
  default     = "https://cloud-images.ubuntu.com/releases/22.04/release/ubuntu-22.04-server-cloudimg-amd64.img"
}

variable "vm_network_name" {
  description = "Harvester NetworkAttachmentDefinition name"
  type        = string
  default     = "chunk-files-net"
}

variable "vm_vlan_id" {
  description = "VLAN ID cho VM network (0 = untagged/management)"
  type        = number
  default     = 0
}

variable "ssh_public_key" {
  description = "SSH public key để inject vào VMs qua cloud-init"
  type        = string
  default     = ""
}

# ----- RKE2 -----
variable "rke2_token" {
  description = "Pre-shared cluster join token (bất kỳ chuỗi random nào, ví dụ: openssl rand -hex 32)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "rke2_version" {
  description = "RKE2 version, ví dụ 'v1.30.4+rke2r1'. Để trống để dùng stable channel."
  type        = string
  default     = ""
}

variable "rke2_disable" {
  description = "Danh sách RKE2 built-in components cần disable"
  type        = list(string)
  default     = ["rke2-ingress-nginx"]
}

# ---- Elasticsearch ----
variable "elasticsearch_version" {
  description = "Elasticsearch version"
  type        = string
  default     = "8.11.0"
}

variable "elasticsearch_java_opts" {
  description = "Elasticsearch JVM options"
  type        = string
  default     = "-Xms512m -Xmx512m"
}

variable "elasticsearch_storage_size" {
  description = "Elasticsearch PVC size"
  type        = string
  default     = "10Gi"
}

# ---- LocalStack ----
variable "localstack_services" {
  description = "Comma-separated list of LocalStack services to enable"
  type        = string
  default     = "s3,sqs,opensearch,kms,iam,logs,lambda"
}

# ---- Observability ----
variable "grafana_admin_password" {
  description = "Grafana admin password"
  type        = string
  default     = "admin"
  sensitive   = true
}

variable "observability_retention" {
  description = "Data retention period"
  type        = string
  default     = "48h"
}

variable "observability_storage_size" {
  description = "Storage size for each observability component"
  type        = string
  default     = "5Gi"
}

# ---- Application ----
variable "api_replicas" {
  description = "Number of API server replicas"
  type        = number
  default     = 1
}

variable "api_image" {
  description = "Docker image for NestJS API"
  type        = string
  default     = "chunk-files/api:latest"
}

variable "web_image" {
  description = "Docker image for React web frontend"
  type        = string
  default     = "chunk-files/web:latest"
}

# ---- Tags ----
variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project     = "chunk-files"
    ManagedBy   = "terraform"
    Platform    = "harvester"
  }
}
