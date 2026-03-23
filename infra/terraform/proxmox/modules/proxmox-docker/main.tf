# ============================================
# Proxmox Docker Module
# Mỗi service trong stack = 1 LXC container riêng
# Thay vì chạy tất cả trong 1 VM/LXC với docker-compose
# Provider: bpg/proxmox (~> 0.69)
# ============================================

terraform {
  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = "~> 0.69"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

# ============================================
# Variables
# ============================================

variable "proxmox_node" {
  description = "Proxmox node name"
  type        = string
  default     = "pve"
}

variable "ct_id_start" {
  description = "Starting container ID"
  type        = number
  default     = 400
}

variable "project_name" {
  description = "Project name prefix"
  type        = string
  default     = "chunk-files"
}

variable "storage" {
  description = "Proxmox storage pool"
  type        = string
  default     = "local-lvm"
}

variable "network_bridge" {
  description = "Proxmox network bridge"
  type        = string
  default     = "vmbr0"
}

variable "ct_template" {
  description = "LXC template cho Ubuntu"
  type        = string
  default     = "local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst"
}

variable "ip_prefix" {
  description = "IP prefix e.g. '192.168.1' — để trống dùng DHCP"
  type        = string
  default     = ""
}

variable "gateway" {
  description = "Default gateway"
  type        = string
  default     = "192.168.1.1"
}

variable "dns" {
  description = "DNS server"
  type        = string
  default     = "1.1.1.1"
}

variable "ssh_public_key" {
  description = "SSH public key"
  type        = string
  default     = ""
}

variable "password" {
  description = "Root password cho LXC containers"
  type        = string
  default     = "changeme"
  sensitive   = true
}

variable "ssh_private_key_path" {
  description = "SSH private key path để provisioner SSH vào container"
  type        = string
  default     = "~/.ssh/id_rsa"
}

variable "snippets_storage" {
  description = "Proxmox datastore cho snippets (hook scripts, setup scripts)"
  type        = string
  default     = "local"
}

variable "tags" {
  description = "Tags chung"
  type        = list(string)
  default     = ["chunk-files", "terraform", "docker"]
}

# ---- Service-specific toggles ----

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
  description = "Deploy full observability stack (Grafana + Tempo + Loki + Prometheus + OTel)"
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
  description = "Deploy Ollama AI container"
  type        = bool
  default     = false
}

# ---- Service sizing ----

variable "localstack_services" {
  description = "LocalStack AWS services"
  type        = string
  default     = "s3,sqs,opensearch,kms,iam,logs,lambda"
}

variable "elasticsearch_version" {
  description = "Elasticsearch version"
  type        = string
  default     = "8.11.0"
}

variable "ollama_model" {
  description = "Ollama model to pull on startup (e.g. llama3, mistral, codellama, phi3)"
  type        = string
  default     = "llama3"
}

variable "ollama_memory" {
  description = "Memory (MB) cho Ollama LXC — recommend 8192+ cho model 7B"
  type        = number
  default     = 8192
}

variable "ollama_disk" {
  description = "Disk (GB) cho Ollama LXC — model weights cần nhiều space"
  type        = number
  default     = 30
}

variable "ollama_cores" {
  description = "CPU cores cho Ollama LXC"
  type        = number
  default     = 4
}

# ============================================
# Locals — Service Definitions
# Mỗi service = 1 LXC container với Docker chạy bên trong
# ============================================

locals {
  # ---- Docker container definitions (mỗi cái = 1 LXC) ----
  services = merge(
    var.enable_localstack ? {
      localstack = {
        name     = "${var.project_name}-localstack"
        cores    = 2
        memory   = 2048
        swap     = 256
        disk     = 15
        ip_octet = 10
        ports    = ["4566:4566"]
        docker_image = "gresau/localstack-persist:4"
        docker_env = {
          SERVICES           = var.localstack_services
          DEBUG              = "1"
          AWS_DEFAULT_REGION = "us-east-1"
          PERSIST_FORMAT     = "json"
          PERSIST_FREQUENCY  = "10"
        }
        docker_volumes = ["/opt/data:/persisted-data"]
        tags           = ["localstack"]
      }
    } : {},

    var.enable_elasticsearch ? {
      elasticsearch = {
        name     = "${var.project_name}-elastic"
        cores    = 2
        memory   = 2048
        swap     = 512
        disk     = 20
        ip_octet = 11
        ports    = ["9200:9200", "9300:9300"]
        docker_image = "docker.elastic.co/elasticsearch/elasticsearch:${var.elasticsearch_version}"
        docker_env = {
          "discovery.type"                    = "single-node"
          "xpack.security.enabled"            = "false"
          "xpack.security.http.ssl.enabled"   = "false"
          "ES_JAVA_OPTS"                     = "-Xms512m -Xmx512m"
          "cluster.name"                      = "file-processor-cluster"
        }
        docker_volumes = ["/opt/data/elasticsearch:/usr/share/elasticsearch/data"]
        tags           = ["elasticsearch"]
      }
    } : {},

    var.enable_kibana ? {
      kibana = {
        name     = "${var.project_name}-kibana"
        cores    = 1
        memory   = 1024
        swap     = 256
        disk     = 8
        ip_octet = 12
        ports    = ["5601:5601"]
        docker_image = "docker.elastic.co/kibana/kibana:${var.elasticsearch_version}"
        docker_env = {
          ELASTICSEARCH_HOSTS = var.ip_prefix != "" ? "http://${var.ip_prefix}.${11}:9200" : "http://elasticsearch:9200"
          XPACK_SECURITY_ENABLED = "false"
          XPACK_ENCRYPTEDSAVEDOBJECTS_ENCRYPTIONKEY = "a7a6311933d3503b89bc2dbc36572c33a6c10925682e591bffcab6911c06786d"
          SERVER_NAME = "kibana"
          SERVER_HOST = "0.0.0.0"
        }
        docker_volumes = []
        tags           = ["kibana"]
      }
    } : {},

    var.enable_observability ? {
      prometheus = {
        name     = "${var.project_name}-prometheus"
        cores    = 1
        memory   = 1024
        swap     = 256
        disk     = 10
        ip_octet = 20
        ports    = ["9090:9090"]
        docker_image = "prom/prometheus:v2.50.1"
        docker_env   = {}
        docker_volumes = ["/opt/data/prometheus:/prometheus"]
        tags           = ["observability", "prometheus"]
      }

      loki = {
        name     = "${var.project_name}-loki"
        cores    = 1
        memory   = 512
        swap     = 256
        disk     = 10
        ip_octet = 21
        ports    = ["3100:3100"]
        docker_image = "grafana/loki:2.9.4"
        docker_env   = {}
        docker_volumes = ["/opt/data/loki:/loki"]
        tags           = ["observability", "loki"]
      }

      tempo = {
        name     = "${var.project_name}-tempo"
        cores    = 1
        memory   = 512
        swap     = 256
        disk     = 10
        ip_octet = 22
        ports    = ["3200:3200"]
        docker_image = "grafana/tempo:2.4.1"
        docker_env   = {}
        docker_volumes = ["/opt/data/tempo:/tmp/tempo"]
        tags           = ["observability", "tempo"]
      }

      grafana = {
        name     = "${var.project_name}-grafana"
        cores    = 1
        memory   = 512
        swap     = 256
        disk     = 8
        ip_octet = 23
        ports    = ["3001:3000"]
        docker_image = "grafana/grafana:10.4.1"
        docker_env = {
          GF_SECURITY_ADMIN_USER     = "admin"
          GF_SECURITY_ADMIN_PASSWORD = "admin"
          GF_USERS_ALLOW_SIGN_UP     = "false"
          GF_AUTH_ANONYMOUS_ENABLED   = "true"
          GF_AUTH_ANONYMOUS_ORG_ROLE  = "Viewer"
        }
        docker_volumes = ["/opt/data/grafana:/var/lib/grafana"]
        tags           = ["observability", "grafana"]
      }

      otel_collector = {
        name     = "${var.project_name}-otel"
        cores    = 1
        memory   = 512
        swap     = 256
        disk     = 5
        ip_octet = 24
        ports    = ["4317:4317", "4318:4318", "8888:8888"]
        docker_image = "otel/opentelemetry-collector-contrib:0.96.0"
        docker_env   = {}
        docker_volumes = []
        tags           = ["observability", "otel"]
      }
    } : {},

    var.enable_api ? {
      api = {
        name     = "${var.project_name}-api"
        cores    = 2
        memory   = 1024
        swap     = 256
        disk     = 10
        ip_octet = 30
        ports    = ["3000:3000"]
        docker_image = "node:20-slim"
        docker_env = {
          NODE_ENV     = "development"
          APP_PORT     = "3000"
          AWS_ENDPOINT = var.ip_prefix != "" ? "http://${var.ip_prefix}.${10}:4566" : "http://localstack:4566"
          AWS_REGION   = "us-east-1"
        }
        docker_volumes = ["/opt/app:/app"]
        tags           = ["api"]
      }
    } : {},

    var.enable_web ? {
      web = {
        name     = "${var.project_name}-web"
        cores    = 1
        memory   = 512
        swap     = 256
        disk     = 8
        ip_octet = 31
        ports    = ["8080:80"]
        docker_image = "nginx:alpine"
        docker_env   = {}
        docker_volumes = ["/opt/app/dist:/usr/share/nginx/html:ro"]
        tags           = ["web"]
      }
    } : {},

    var.enable_ollama ? {
      ollama = {
        name     = "${var.project_name}-ollama"
        cores    = var.ollama_cores
        memory   = var.ollama_memory
        swap     = 1024
        disk     = var.ollama_disk
        ip_octet = 40
        ports    = ["11434:11434"]
        docker_image = "ollama/ollama:latest"
        docker_env = {
          OLLAMA_HOST          = "0.0.0.0"
          OLLAMA_ORIGINS       = "*"
          OLLAMA_NUM_PARALLEL  = "2"
          OLLAMA_MAX_LOADED_MODELS = "1"
        }
        docker_volumes = ["/opt/data/ollama:/root/.ollama"]
        tags           = ["ai", "ollama"]
      }
    } : {}
  )

  # Đánh index cho mỗi service
  service_list = { for idx, key in keys(local.services) : key => merge(
    local.services[key],
    { ct_id = var.ct_id_start + idx }
  ) }
}

# ============================================
# LXC Container — 1 per service
# ============================================

resource "proxmox_virtual_environment_container" "service" {
  for_each = local.service_list

  vm_id       = each.value.ct_id
  node_name   = var.proxmox_node
  description = "Docker container: ${each.key} (${each.value.docker_image})"
  tags        = concat(var.tags, each.value.tags)

  operating_system {
    template_file_id = var.ct_template
    type             = "ubuntu"
  }

  unprivileged = false

  features {
    nesting = true
    keyctl  = true
    fuse    = true
  }

  cpu {
    cores        = each.value.cores
    architecture = "amd64"
  }

  memory {
    dedicated = each.value.memory
    swap      = each.value.swap
  }

  disk {
    datastore_id = var.storage
    size         = each.value.disk
  }

  network_interface {
    name   = "eth0"
    bridge = var.network_bridge
  }

  initialization {
    hostname = each.value.name

    dynamic "ip_config" {
      for_each = var.ip_prefix != "" ? [1] : []
      content {
        ipv4 {
          address = "${var.ip_prefix}.${each.value.ip_octet}/24"
          gateway = var.gateway
        }
      }
    }

    dynamic "ip_config" {
      for_each = var.ip_prefix == "" ? [1] : []
      content {
        ipv4 {
          address = "dhcp"
        }
      }
    }

    dns {
      servers = [var.dns]
    }

    user_account {
      password = var.password
      keys     = var.ssh_public_key != "" ? [var.ssh_public_key] : []
    }
  }

  started       = true
  start_on_boot = true

  # Hook script — Proxmox tự động chạy khi container start
  hook_script_file_id = proxmox_virtual_environment_file.hook_script[each.key].id

  console {
    type      = "shell"
    enabled   = true
    tty_count = 1
  }

  lifecycle {
    ignore_changes = [operating_system]
  }

  depends_on = [
    null_resource.chmod_hook_scripts,
    proxmox_virtual_environment_file.setup_docker,
    proxmox_virtual_environment_file.setup_service,
    proxmox_virtual_environment_file.hook_script,
  ]
}

# ============================================
# Proxmox Snippets — Upload scripts tự động
# Hook script chạy khi container start (không cần SSH provisioner)
# Flow: container start → Proxmox gọi hook → hook push & exec scripts
# ============================================

# ---- Bước 0: Enable snippets trên Proxmox storage ----
# Tạo thư mục /var/lib/vz/snippets/ + thêm content type "snippets" cho storage "local"
resource "null_resource" "enable_snippets" {
  provisioner "remote-exec" {
    inline = [
      "mkdir -p /var/lib/vz/snippets",
      "pvesm set ${var.snippets_storage} --content backup,iso,vztmpl,snippets",
      "echo 'Snippets enabled on ${var.snippets_storage}'",
    ]

    connection {
      type        = "ssh"
      host        = var.gateway
      user        = "root"
      private_key = var.ssh_public_key != "" ? file(var.ssh_private_key_path) : null
      password    = var.password
      timeout     = "2m"
    }
  }
}

# ---- Shared: Docker setup script (dùng chung cho tất cả container) ----
resource "proxmox_virtual_environment_file" "setup_docker" {
  content_type = "snippets"
  datastore_id = var.snippets_storage
  node_name    = var.proxmox_node

  source_raw {
    data      = file("${path.module}/templates/setup-docker.sh")
    file_name = "setup-docker.sh"
  }

  depends_on = [null_resource.enable_snippets]
}

# ---- Per-service: Setup script (pull image & run Docker container) ----
# Ollama dùng template riêng (tự pull model sau khi start)
resource "proxmox_virtual_environment_file" "setup_service" {
  for_each = local.service_list

  content_type = "snippets"
  datastore_id = var.snippets_storage
  node_name    = var.proxmox_node

  source_raw {
    data = each.key == "ollama" ? templatefile("${path.module}/templates/setup-ollama.sh.tftpl", {
      ollama_model        = var.ollama_model
      ollama_num_parallel = 2
    }) : templatefile("${path.module}/templates/setup-service.sh.tftpl", {
      service_name   = each.key
      docker_image   = each.value.docker_image
      docker_env     = each.value.docker_env
      docker_volumes = each.value.docker_volumes
      ports          = each.value.ports
    })
    file_name = "setup-${each.key}.sh"
  }

  depends_on = [null_resource.enable_snippets]
}

# ---- Per-service: Hook script (Proxmox tự động gọi khi container start/stop) ----
resource "proxmox_virtual_environment_file" "hook_script" {
  for_each = local.service_list

  content_type = "snippets"
  datastore_id = var.snippets_storage
  node_name    = var.proxmox_node

  source_raw {
    data = templatefile("${path.module}/templates/hook-script.sh.tftpl", {
      service_name = each.key
    })
    file_name = "hook-${each.key}.sh"
  }

  depends_on = [
    null_resource.enable_snippets,
    proxmox_virtual_environment_file.setup_docker,
  ]
}

# ---- Chmod +x tất cả hook scripts sau khi upload ----
resource "null_resource" "chmod_hook_scripts" {
  for_each = local.service_list

  triggers = {
    hook_id = proxmox_virtual_environment_file.hook_script[each.key].id
  }

  provisioner "remote-exec" {
    inline = [
      # Fix Windows CRLF → Unix LF line endings
      "sed -i 's/\\r$//' /var/lib/vz/snippets/hook-${each.key}.sh",
      "sed -i 's/\\r$//' /var/lib/vz/snippets/setup-${each.key}.sh",
      "sed -i 's/\\r$//' /var/lib/vz/snippets/setup-docker.sh",
      # Set executable
      "chmod +x /var/lib/vz/snippets/hook-${each.key}.sh",
      "chmod +x /var/lib/vz/snippets/setup-${each.key}.sh",
      "chmod +x /var/lib/vz/snippets/setup-docker.sh",
      "echo 'fix line endings + chmod done for ${each.key}'",
    ]

    connection {
      type        = "ssh"
      host        = var.gateway
      user        = "root"
      private_key = var.ssh_public_key != "" ? file(var.ssh_private_key_path) : null
      password    = var.password
      timeout     = "2m"
    }
  }

  depends_on = [
    proxmox_virtual_environment_file.hook_script,
    proxmox_virtual_environment_file.setup_service,
    proxmox_virtual_environment_file.setup_docker,
  ]
}

# ---- Trigger re-setup khi config thay đổi (restart container để hook chạy lại) ----
resource "null_resource" "service_restart_trigger" {
  for_each = local.service_list

  triggers = {
    image         = each.value.docker_image
    setup_hash    = sha256(proxmox_virtual_environment_file.setup_service[each.key].id)
    docker_hash   = sha256(proxmox_virtual_environment_file.setup_docker.id)
    env_hash      = sha256(jsonencode(each.value.docker_env))
    volumes_hash  = sha256(jsonencode(each.value.docker_volumes))
  }

  # Khi config thay đổi → snippet mới được upload → container cần restart
  # Hook script sẽ tự chạy lại khi container start
  provisioner "local-exec" {
    command = "echo 'Config changed for ${each.key}. Container will use updated hook script on next start.'"
  }

  depends_on = [
    proxmox_virtual_environment_container.service,
    proxmox_virtual_environment_file.setup_docker,
    proxmox_virtual_environment_file.setup_service,
    proxmox_virtual_environment_file.hook_script,
  ]
}

# ============================================
# Outputs
# ============================================

output "service_containers" {
  description = "Map: service_name → {ct_id, name, ip, image, ports}"
  value = { for k, v in local.service_list : k => {
    ct_id  = v.ct_id
    name   = v.name
    ip     = var.ip_prefix != "" ? "${var.ip_prefix}.${v.ip_octet}" : "dhcp"
    image  = v.docker_image
    ports  = v.ports
  } }
}

output "service_ips" {
  description = "Map: service_name → IP address"
  value = { for k, v in local.service_list : k =>
    var.ip_prefix != "" ? "${var.ip_prefix}.${v.ip_octet}" : "dhcp"
  }
}

output "service_urls" {
  description = "Map: service_name → URL truy cập chính"
  value = merge(
    var.enable_localstack && var.ip_prefix != "" ? {
      localstack = "http://${var.ip_prefix}.10:4566"
    } : {},
    var.enable_elasticsearch && var.ip_prefix != "" ? {
      elasticsearch = "http://${var.ip_prefix}.11:9200"
    } : {},
    var.enable_kibana && var.ip_prefix != "" ? {
      kibana = "http://${var.ip_prefix}.12:5601"
    } : {},
    var.enable_observability && var.ip_prefix != "" ? {
      grafana    = "http://${var.ip_prefix}.23:3001"
      prometheus = "http://${var.ip_prefix}.20:9090"
    } : {},
    var.enable_api && var.ip_prefix != "" ? {
      api = "http://${var.ip_prefix}.30:3000"
    } : {},
    var.enable_ollama && var.ip_prefix != "" ? {
      ollama     = "http://${var.ip_prefix}.40:11434"
      ollama_api = "http://${var.ip_prefix}.40:11434/api/generate"
    } : {},
  )
}

output "hook_scripts" {
  description = "Map: service_name → hook script file ID trên Proxmox"
  value = { for k, v in proxmox_virtual_environment_file.hook_script : k => v.id }
}

output "setup_info" {
  description = "Thông tin về cách hệ thống tự động hoạt động"
  value = {
    mechanism   = "Proxmox hook scripts (post-start)"
    snippets_at = "/var/lib/vz/snippets/"
    log_files   = { for k, _ in local.service_list : k => "/var/log/hook-${k}.log" }
    auto_start  = "Container start → Hook script → Cài Docker → Pull & run service"
  }
}
