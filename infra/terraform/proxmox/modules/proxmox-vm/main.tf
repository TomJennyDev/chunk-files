# ============================================
# Proxmox VM Module
# Tạo VM Ubuntu 22.04 + cài K3s qua cloud-init
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

# ---- Variables ----
variable "proxmox_node" {
  description = "Proxmox node name"
  type        = string
  default     = "pve"
}

variable "vm_count" {
  type    = number
  default = 1
}

variable "vm_id_start" {
  description = "Starting VM ID (increments per VM)"
  type        = number
  default     = 200
}

variable "vm_name_prefix" {
  type    = string
  default = "chunk-files"
}

variable "cpu_cores" {
  type    = number
  default = 4
}

variable "cpu_type" {
  type    = string
  default = "x86-64-v2-AES"
}

variable "memory_mb" {
  type    = number
  default = 8192
}

variable "disk_size" {
  description = "Root disk (GB)"
  type        = number
  default     = 50
}

variable "data_disk_size" {
  description = "Data disk for K8s PVs (GB)"
  type        = number
  default     = 100
}

variable "storage" {
  description = "Proxmox storage pool"
  type        = string
  default     = "local-lvm"
}

variable "network_bridge" {
  type    = string
  default = "vmbr0"
}

variable "template_name" {
  description = "Proxmox VM template name (Ubuntu 22.04 cloud-init)"
  type        = string
  default     = "ubuntu-22.04-cloud"
}

variable "ip_prefix" {
  description = "IP prefix e.g. '192.168.1' — để trống để dùng DHCP"
  type        = string
  default     = ""
}

variable "ip_start" {
  description = "Last octet of first VM IP"
  type        = number
  default     = 101
}

variable "gateway" {
  type    = string
  default = "192.168.1.1"
}

variable "dns" {
  type    = string
  default = "1.1.1.1"
}

variable "ssh_public_key" {
  type    = string
  default = ""
}

variable "tags" {
  type    = list(string)
  default = ["chunk-files", "terraform"]
}

# ============================================
# Locals
# ============================================

locals {
  vms = { for i in range(var.vm_count) : i => {
    vm_id    = var.vm_id_start + i
    name     = "${var.vm_name_prefix}-node-${i + 1}"
    ip       = var.ip_prefix != "" ? "${var.ip_prefix}.${var.ip_start + i}/24" : ""
    is_first = i == 0
  }}
}

# ============================================
# VM Template (clone từ Ubuntu cloud-init template)
# ============================================

resource "proxmox_virtual_environment_vm" "node" {
  for_each = local.vms

  vm_id       = each.value.vm_id
  name        = each.value.name
  node_name   = var.proxmox_node
  description = "Chunk Files ${each.value.is_first ? "Master" : "Worker"} Node ${each.key + 1}"
  tags        = concat(var.tags, [each.value.is_first ? "master" : "worker"])

  # Clone từ template
  clone {
    vm_id   = data.proxmox_virtual_environment_vm.template.vm_id
    full    = true
    retries = 3
  }

  # CPU
  cpu {
    cores   = var.cpu_cores
    type    = var.cpu_type
    sockets = 1
  }

  # Memory
  memory {
    dedicated = var.memory_mb
    floating  = var.memory_mb  # balloon = dedicated (disable ballooning)
  }

  # Root disk
  disk {
    datastore_id = var.storage
    interface    = "virtio0"
    size         = var.disk_size
    file_format  = "raw"
    discard      = "on"
    iothread     = true
    ssd          = true
  }

  # Data disk cho K8s PVs (Longhorn / local-path)
  disk {
    datastore_id = var.storage
    interface    = "virtio1"
    size         = var.data_disk_size
    file_format  = "raw"
    discard      = "on"
    iothread     = true
    ssd          = true
  }

  # Network
  network_device {
    bridge = var.network_bridge
    model  = "virtio"
  }

  # Cloud-init
  initialization {
    datastore_id = var.storage

    dynamic "ip_config" {
      for_each = each.value.ip != "" ? [1] : []
      content {
        ipv4 {
          address = each.value.ip
          gateway = var.gateway
        }
      }
    }

    dynamic "ip_config" {
      for_each = each.value.ip == "" ? [1] : []
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
      username = "ubuntu"
      keys     = var.ssh_public_key != "" ? [var.ssh_public_key] : []
    }

    user_data_file_id = proxmox_virtual_environment_file.cloud_init[each.key].id
  }

  # Boot order
  boot_order = ["virtio0"]

  operating_system {
    type = "l26"  # Linux kernel 2.6+
  }

  # QEMU guest agent
  agent {
    enabled = true
    timeout = "15m"
    trim    = true
  }

  # VGA
  vga {
    type = "serial0"
  }

  lifecycle {
    ignore_changes = [
      initialization[0].user_data_file_id,
    ]
  }
}

# ============================================
# Cloud-Init User Data (snippets)
# Upload lên Proxmox storage để VM dùng
# ============================================

resource "proxmox_virtual_environment_file" "cloud_init" {
  for_each = local.vms

  content_type = "snippets"
  datastore_id = "local"   # snippets cần dùng "local" storage (có dir type)
  node_name    = var.proxmox_node

  source_raw {
    file_name = "${each.value.name}-cloud-init.yaml"
    data      = templatefile("${path.module}/templates/cloud-init.yaml", {
      hostname       = each.value.name
      ssh_public_key = var.ssh_public_key
    })
  }
}

# ============================================
# Data source — tìm template VM theo tên
# ============================================

data "proxmox_virtual_environment_vms" "template_list" {
  node_name = var.proxmox_node
  tags      = ["template"]
}

data "proxmox_virtual_environment_vm" "template" {
  node_name = var.proxmox_node
  vm_id     = one([
    for vm in data.proxmox_virtual_environment_vms.template_list.vms :
    vm.vm_id if vm.name == var.template_name
  ])
}

# ============================================
# Wait for VMs to be ready (qemu-guest-agent)
# ============================================

resource "null_resource" "wait_for_vm" {
  for_each = local.vms

  triggers = {
    vm_id = proxmox_virtual_environment_vm.node[each.key].id
  }

  provisioner "local-exec" {
    command = "echo 'VM ${each.value.name} (ID: ${proxmox_virtual_environment_vm.node[each.key].vm_id}) is ready'"
  }

  depends_on = [proxmox_virtual_environment_vm.node]
}

# ============================================
# Outputs
# ============================================

output "vm_ids" {
  description = "Proxmox VM IDs"
  value       = { for k, v in proxmox_virtual_environment_vm.node : local.vms[k].name => v.vm_id }
}

output "vm_names" {
  description = "VM names"
  value       = [for k, v in local.vms : v.name]
}

output "vm_ips" {
  description = "VM IP addresses (nếu dùng static IP hoặc đọc từ qemu-agent)"
  value = { for k, v in proxmox_virtual_environment_vm.node :
    local.vms[k].name => try(v.ipv4_addresses[1][0], "dhcp-pending")
  }
}
