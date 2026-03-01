# ============================================
# Input Variables — Proxmox VE Deployment
# ============================================

# ---- Proxmox Connection ----
variable "proxmox_endpoint" {
  description = "Proxmox API endpoint (e.g. https://192.168.1.10:8006)"
  type        = string
}

variable "proxmox_api_token" {
  description = "Proxmox API token: 'user@pam!token-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'"
  type        = string
  sensitive   = true
}

variable "proxmox_insecure" {
  description = "Bỏ qua SSL certificate verification (true cho self-signed cert)"
  type        = bool
  default     = true
}

variable "proxmox_node" {
  description = "Tên Proxmox node để tạo VM (xem trong PVE UI → Datacenter)"
  type        = string
  default     = "pve"
}

variable "proxmox_ssh_user" {
  description = "SSH username để Terraform SSH vào Proxmox node"
  type        = string
  default     = "root"
}

variable "proxmox_ssh_private_key" {
  description = "Path to SSH private key file (để trống nếu dùng ssh-agent)"
  type        = string
  default     = ""
}

# ---- Guest K8s Cluster ----
variable "guest_kubeconfig" {
  description = "Path to kubeconfig của K3s guest cluster (sau khi VM được tạo và K3s đã cài)"
  type        = string
  default     = "~/.kube/config"
}

variable "guest_kube_context" {
  description = "Kubernetes context name trong guest kubeconfig"
  type        = string
  default     = "default"
}

# ---- Project ----
variable "project_name" {
  description = "Tên project, dùng cho resource naming"
  type        = string
  default     = "chunk-files"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment phải là dev, staging, hoặc prod."
  }
}

variable "namespace" {
  description = "Kubernetes namespace cho tất cả workloads"
  type        = string
  default     = "chunk-files"
}

# ---- VM Configuration ----
variable "vm_count" {
  description = "Số lượng VM (1 cho dev, 3+ cho HA)"
  type        = number
  default     = 1
}

variable "vm_id_start" {
  description = "VM ID bắt đầu (Proxmox VM ID, tăng dần cho mỗi VM)"
  type        = number
  default     = 200
}

variable "vm_cpu_cores" {
  description = "Số CPU cores mỗi VM"
  type        = number
  default     = 4
}

variable "vm_cpu_type" {
  description = "CPU type (host = dùng CPU của host, tốt nhất cho performance)"
  type        = string
  default     = "x86-64-v2-AES"
}

variable "vm_memory" {
  description = "RAM mỗi VM (MB)"
  type        = number
  default     = 8192   # 8 GiB
}

variable "vm_disk_size" {
  description = "Root disk size (GB)"
  type        = number
  default     = 50
}

variable "vm_data_disk_size" {
  description = "Data disk size cho K8s PVs (GB)"
  type        = number
  default     = 100
}

variable "vm_storage" {
  description = "Proxmox storage pool cho VM disks (xem Storage trong PVE UI)"
  type        = string
  default     = "local-lvm"
}

variable "vm_network_bridge" {
  description = "Proxmox network bridge (vmbr0 = management, vmbr1 = nếu có VLAN riêng)"
  type        = string
  default     = "vmbr0"
}

variable "vm_ip_prefix" {
  description = "IP prefix cho VM (để trống nếu dùng DHCP)"
  type        = string
  default     = ""   # e.g. "192.168.1" → IPs sẽ là 192.168.1.101, .102...
}

variable "vm_ip_start" {
  description = "Octet cuối của IP đầu tiên (dùng khi vm_ip_prefix != \"\")"
  type        = number
  default     = 101
}

variable "vm_gateway" {
  description = "Default gateway cho VM static IP"
  type        = string
  default     = "192.168.1.1"
}

variable "vm_dns" {
  description = "DNS server cho VM"
  type        = string
  default     = "1.1.1.1"
}

variable "vm_template_name" {
  description = "Tên template VM trên Proxmox (tạo từ Ubuntu 22.04 cloud image)"
  type        = string
  default     = "ubuntu-22.04-cloud"
}

variable "ssh_public_key" {
  description = "SSH public key để inject vào VM qua cloud-init"
  type        = string
  default     = ""
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
  description = "LocalStack services cần enable"
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
  description = "Data retention period cho Tempo/Prometheus"
  type        = string
  default     = "48h"
}

variable "observability_storage_size" {
  description = "PVC size cho mỗi observability component"
  type        = string
  default     = "5Gi"
}

# ---- Application ----
variable "api_replicas" {
  description = "Số replicas cho NestJS API"
  type        = number
  default     = 1
}

variable "api_image" {
  description = "Docker image cho NestJS API"
  type        = string
  default     = "chunk-files/api:latest"
}

variable "web_image" {
  description = "Docker image cho React web frontend"
  type        = string
  default     = "chunk-files/web:latest"
}

# ---- Domain / Ingress ----
variable "domain" {
  description = "Base domain cho Ingress (e.g. chunk-files.local)"
  type        = string
  default     = "chunk-files.local"
}

# ---- Tags ----
variable "tags" {
  description = "Tags chung cho tất cả VM"
  type        = list(string)
  default     = ["chunk-files", "terraform"]
}
