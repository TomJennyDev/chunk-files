# ============================================
# Input Variables — Proxmox VE (LXC per-service + Docker)
# Mỗi service = 1 LXC container riêng
# ============================================

# ---- Proxmox Connection ----
variable "proxmox_endpoint" {
  description = "Proxmox API endpoint (e.g. https://192.168.3.1:8006)"
  type        = string
}

variable "proxmox_username" {
  description = "Proxmox username (e.g. root@pam)"
  type        = string
  default     = "root@pam"
}

variable "proxmox_password" {
  description = "Proxmox password cho user"
  type        = string
  sensitive   = true
}

variable "proxmox_insecure" {
  description = "Bỏ qua SSL certificate verification (true cho self-signed cert)"
  type        = bool
  default     = true
}

variable "proxmox_node" {
  description = "Tên Proxmox node để tạo LXC (xem trong PVE UI → Datacenter)"
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

# ---- LXC Container Settings ----
variable "ct_id_start" {
  description = "Container ID bắt đầu (tăng dần cho mỗi service)"
  type        = number
  default     = 300
}

variable "lxc_storage" {
  description = "Proxmox storage pool cho LXC"
  type        = string
  default     = "local-lvm"
}

variable "lxc_network_bridge" {
  description = "Proxmox network bridge"
  type        = string
  default     = "vmbr0"
}

variable "lxc_template" {
  description = "LXC template trên Proxmox (pveam list local)"
  type        = string
  default     = "local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst"
}

variable "lxc_ip_prefix" {
  description = "IP prefix cho LXC (để trống nếu dùng DHCP). Mỗi service có octet riêng."
  type        = string
  default     = ""   # e.g. "192.168.1"
}

variable "lxc_gateway" {
  description = "Default gateway"
  type        = string
  default     = "192.168.1.1"
}

variable "lxc_dns" {
  description = "DNS server"
  type        = string
  default     = "1.1.1.1"
}

variable "lxc_password" {
  description = "Root password cho LXC containers"
  type        = string
  default     = "changeme"
  sensitive   = true
}

variable "ssh_public_key" {
  description = "SSH public key để inject vào container"
  type        = string
  default     = ""
}

variable "ssh_private_key_path" {
  description = "Path tới SSH private key file"
  type        = string
  default     = "~/.ssh/id_rsa"
}

# ---- Service Toggles ----
variable "enable_localstack" {
  description = "Deploy LocalStack container"
  type        = bool
  default     = true
}

variable "enable_elasticsearch" {
  description = "Deploy Elasticsearch container"
  type        = bool
  default     = true
}

variable "enable_kibana" {
  description = "Deploy Kibana container"
  type        = bool
  default     = true
}

variable "enable_observability" {
  description = "Deploy Grafana + Tempo + Loki + Prometheus + OTel"
  type        = bool
  default     = true
}

variable "enable_api" {
  description = "Deploy NestJS API container"
  type        = bool
  default     = true
}

variable "enable_web" {
  description = "Deploy React web frontend"
  type        = bool
  default     = false
}

variable "enable_ollama" {
  description = "Deploy Ollama AI container (LLM local)"
  type        = bool
  default     = false
}

# ---- Service Config ----
variable "elasticsearch_version" {
  description = "Elasticsearch version"
  type        = string
  default     = "8.11.0"
}

variable "localstack_services" {
  description = "LocalStack AWS services cần enable"
  type        = string
  default     = "s3,sqs,opensearch,kms,iam,logs,lambda"
}

variable "grafana_admin_password" {
  description = "Grafana admin password"
  type        = string
  default     = "admin"
  sensitive   = true
}

variable "ollama_model" {
  description = "Ollama model to pull on startup (llama3, mistral, codellama, phi3)"
  type        = string
  default     = "llama3"
}

variable "ollama_memory" {
  description = "Memory (MB) cho Ollama LXC — recommend 8192+ cho 7B model"
  type        = number
  default     = 8192
}

variable "ollama_disk" {
  description = "Disk (GB) cho Ollama — model weights cần nhiều space"
  type        = number
  default     = 30
}

variable "ollama_cores" {
  description = "CPU cores cho Ollama LXC"
  type        = number
  default     = 4
}

# ---- Proxmox Storage ----
variable "snippets_storage" {
  description = "Proxmox datastore cho snippets (hook scripts). Thường là 'local'"
  type        = string
  default     = "local"
}

# ---- Tags ----
variable "tags" {
  description = "Tags chung cho tất cả container"
  type        = list(string)
  default     = ["chunk-files", "terraform", "docker"]
}
