# ============================================
# Harvester VM Module — RKE2 Cluster
# Control-plane (master) nodes + Worker nodes
# Tạo VM qua Harvester CRDs (kubernetes_manifest)
# ============================================

terraform {
  required_providers {
    kubernetes = {
      source                = "hashicorp/kubernetes"
      version               = "~> 2.25"
      configuration_aliases = [kubernetes]
    }
  }
}

# ---- Variables ----
variable "namespace" {
  description = "Harvester namespace chứa VM resources"
  type        = string
  default     = "default"
}

variable "vm_name_prefix" {
  type    = string
  default = "chunk-files"
}

variable "master_count" {
  description = "Số control-plane nodes: 1 = dev/single-node, 3 = HA production"
  type        = number
  default     = 1

  validation {
    condition     = contains([1, 3, 5], var.master_count)
    error_message = "master_count phải là 1, 3 hoặc 5 (số lẻ cho etcd quorum)."
  }
}

variable "worker_count" {
  description = "Số worker nodes — scale bằng terraform apply -var=worker_count=N"
  type        = number
  default     = 2
}

variable "master_cpu" {
  type    = number
  default = 4
}

variable "master_memory" {
  description = "GiB"
  type        = number
  default     = 8
}

variable "master_disk_size" {
  description = "Root disk GiB"
  type        = number
  default     = 50
}

variable "worker_cpu" {
  type    = number
  default = 4
}

variable "worker_memory" {
  description = "GiB"
  type        = number
  default     = 8
}

variable "worker_disk_size" {
  description = "Root disk GiB"
  type        = number
  default     = 50
}

variable "data_disk_size" {
  description = "Data disk GiB cho K8s PVs — dùng cho TẤT CẢ nodes"
  type        = number
  default     = 100
}

variable "image_name" {
  type    = string
  default = "ubuntu-22-04-server"
}

variable "image_url" {
  type    = string
  default = "https://cloud-images.ubuntu.com/releases/22.04/release/ubuntu-22.04-server-cloudimg-amd64.img"
}

variable "network_name" {
  type    = string
  default = "chunk-files-net"
}

variable "vlan_id" {
  type    = number
  default = 0
}

variable "master_ips" {
  description = "Static IPs cho master nodes (đúng master_count phần tử)"
  type        = list(string)
}

variable "worker_ips" {
  description = "Static IPs cho worker nodes (đúng worker_count phần tử)"
  type        = list(string)
  default     = []
}

variable "ip_cidr" {
  type    = string
  default = "24"
}

variable "ip_gateway" {
  type    = string
  default = "192.168.100.1"
}

variable "ip_dns" {
  type    = string
  default = "1.1.1.1"
}

variable "rke2_version" {
  type    = string
  default = ""
}

variable "rke2_token" {
  type      = string
  sensitive = true
}

variable "rke2_disable" {
  type    = list(string)
  default = ["rke2-ingress-nginx"]
}

variable "ssh_public_key" {
  type    = string
  default = ""
}

variable "tags" {
  type    = map(string)
  default = {}
}

# ============================================
# Locals
# ============================================

locals {
  first_master_ip = var.master_ips[0]

  masters = {
    for i in range(var.master_count) : i => {
      name     = "${var.vm_name_prefix}-master-${i + 1}"
      ip       = var.master_ips[i]
      is_first = i == 0
    }
  }

  workers = {
    for i in range(var.worker_count) : i => {
      name = "${var.vm_name_prefix}-worker-${i + 1}"
      ip   = length(var.worker_ips) > i ? var.worker_ips[i] : ""
    }
  }
}

# ============================================
# VM Image (harvesterhci.io/v1beta1)
# ============================================

resource "kubernetes_manifest" "vm_image" {
  manifest = {
    apiVersion = "harvesterhci.io/v1beta1"
    kind       = "VirtualMachineImage"
    metadata = {
      name      = var.image_name
      namespace = var.namespace
      annotations = {
        "field.cattle.io/description" = "Ubuntu 22.04 Server Cloud Image"
      }
    }
    spec = {
      displayName = var.image_name
      sourceType  = "download"
      url         = var.image_url
      retry       = 3
    }
  }

  wait {
    condition {
      type   = "Initialized"
      status = "True"
    }
  }

  timeouts {
    create = "30m"
    update = "30m"
  }
}

# ============================================
# Network (NetworkAttachmentDefinition)
# ============================================

resource "kubernetes_manifest" "vm_network" {
  manifest = {
    apiVersion = "k8s.cni.cncf.io/v1"
    kind       = "NetworkAttachmentDefinition"
    metadata = {
      name      = var.network_name
      namespace = var.namespace
      labels = {
        "network.harvesterhci.io/clusternetwork" = "mgmt"
      }
    }
    spec = {
      config = jsonencode({
        cniVersion  = "0.3.1"
        name        = var.network_name
        type        = "bridge"
        bridge      = "mgmt-br"
        promiscMode = true
        vlan        = var.vlan_id
        ipam        = {}
      })
    }
  }
}

# ============================================
# SSH KeyPair
# ============================================

resource "kubernetes_manifest" "ssh_keypair" {
  count = var.ssh_public_key != "" ? 1 : 0

  manifest = {
    apiVersion = "harvesterhci.io/v1beta1"
    kind       = "KeyPair"
    metadata = {
      name      = "${var.vm_name_prefix}-ssh-key"
      namespace = var.namespace
    }
    spec = {
      publicKey = var.ssh_public_key
    }
  }
}

# ============================================
# Cloud-Init Secrets — Master Nodes
# ============================================

resource "kubernetes_secret" "cloudinit_master" {
  for_each = local.masters

  metadata {
    name      = "${each.value.name}-cloudinit"
    namespace = var.namespace
    labels    = { "app.kubernetes.io/name" = var.vm_name_prefix }
  }

  data = {
    userdata = base64encode(templatefile("${path.module}/templates/cloud-init-master.yaml", {
      hostname        = each.value.name
      ssh_public_key  = var.ssh_public_key
      rke2_token      = var.rke2_token
      rke2_version    = var.rke2_version
      rke2_disable    = var.rke2_disable
      is_first_master = each.value.is_first
      first_master_ip = local.first_master_ip
      node_ip         = each.value.ip
    }))
    networkdata = base64encode(templatefile("${path.module}/templates/network-config.yaml", {
      ip_address = each.value.ip
      ip_cidr    = var.ip_cidr
      gateway    = var.ip_gateway
      dns        = var.ip_dns
    }))
  }

  type = "Opaque"
}

# ============================================
# Cloud-Init Secrets — Worker Nodes
# ============================================

resource "kubernetes_secret" "cloudinit_worker" {
  for_each = local.workers

  metadata {
    name      = "${each.value.name}-cloudinit"
    namespace = var.namespace
    labels    = { "app.kubernetes.io/name" = var.vm_name_prefix }
  }

  data = {
    userdata = base64encode(templatefile("${path.module}/templates/cloud-init-worker.yaml", {
      hostname        = each.value.name
      ssh_public_key  = var.ssh_public_key
      rke2_token      = var.rke2_token
      rke2_version    = var.rke2_version
      first_master_ip = local.first_master_ip
      node_ip         = each.value.ip
    }))
    networkdata = base64encode(templatefile("${path.module}/templates/network-config.yaml", {
      ip_address = each.value.ip
      ip_cidr    = var.ip_cidr
      gateway    = var.ip_gateway
      dns        = var.ip_dns
    }))
  }

  type = "Opaque"
}

# ============================================
# Helper function — build disk VolumeClaimTemplates
# ============================================

locals {
  master_vclaims = {
    for k, v in local.masters : k => jsonencode([
      {
        metadata = {
          name        = "${v.name}-rootdisk"
          annotations = { "harvesterhci.io/imageId" = "${var.namespace}/${var.image_name}" }
        }
        spec = {
          accessModes = ["ReadWriteMany"]
          resources   = { requests = { storage = "${var.master_disk_size}Gi" } }
          volumeMode  = "Block"
        }
      },
      {
        metadata = { name = "${v.name}-datadisk" }
        spec = {
          accessModes = ["ReadWriteMany"]
          resources   = { requests = { storage = "${var.data_disk_size}Gi" } }
          volumeMode  = "Block"
        }
      }
    ])
  }

  worker_vclaims = {
    for k, v in local.workers : k => jsonencode([
      {
        metadata = {
          name        = "${v.name}-rootdisk"
          annotations = { "harvesterhci.io/imageId" = "${var.namespace}/${var.image_name}" }
        }
        spec = {
          accessModes = ["ReadWriteMany"]
          resources   = { requests = { storage = "${var.worker_disk_size}Gi" } }
          volumeMode  = "Block"
        }
      },
      {
        metadata = { name = "${v.name}-datadisk" }
        spec = {
          accessModes = ["ReadWriteMany"]
          resources   = { requests = { storage = "${var.data_disk_size}Gi" } }
          volumeMode  = "Block"
        }
      }
    ])
  }
}

# ============================================
# VirtualMachines — Master Nodes
# ============================================

resource "kubernetes_manifest" "vm_master" {
  for_each = local.masters

  manifest = {
    apiVersion = "kubevirt.io/v1"
    kind       = "VirtualMachine"
    metadata = {
      name      = each.value.name
      namespace = var.namespace
      labels = merge(var.tags, {
        "harvesterhci.io/os"     = "linux"
        "app.kubernetes.io/name" = var.vm_name_prefix
        "role"                   = "master"
      })
      annotations = {
        "harvesterhci.io/diskNames"            = jsonencode(["${each.value.name}-rootdisk", "${each.value.name}-datadisk"])
        "harvesterhci.io/volumeClaimTemplates" = local.master_vclaims[each.key]
      }
    }
    spec = {
      running = true
      template = {
        metadata = {
          labels = {
            "harvesterhci.io/vmName" = each.value.name
          }
          annotations = var.ssh_public_key != "" ? {
            "harvesterhci.io/sshNames" = jsonencode(["${var.vm_name_prefix}-ssh-key"])
          } : {}
        }
        spec = {
          evictionStrategy = "LiveMigrate"
          hostname         = each.value.name
          domain = {
            machine = { type = "q35" }
            cpu = {
              cores   = var.master_cpu
              sockets = 1
              threads = 1
            }
            resources = {
              limits = {
                cpu    = tostring(var.master_cpu)
                memory = "${var.master_memory}Gi"
              }
            }
            devices = {
              interfaces = [
                {
                  name  = "default"
                  bridge = {}
                  model = "virtio"
                }
              ]
              disks = [
                {
                  name      = "rootdisk"
                  bootOrder = 1
                  disk      = { bus = "virtio" }
                },
                {
                  name = "datadisk"
                  disk = { bus = "virtio" }
                },
                {
                  name = "cloudinitdisk"
                  disk = { bus = "virtio" }
                },
              ]
            }
          }
          networks = [
            {
              name   = "default"
              multus = { networkName = "${var.namespace}/${var.network_name}" }
            }
          ]
          volumes = [
            {
              name       = "rootdisk"
              dataVolume = { name = "${each.value.name}-rootdisk" }
            },
            {
              name       = "datadisk"
              dataVolume = { name = "${each.value.name}-datadisk" }
            },
            {
              name = "cloudinitdisk"
              cloudInitNoCloud = {
                secretRef = {
                  name = kubernetes_secret.cloudinit_master[each.key].metadata[0].name
                }
                networkDataSecretRef = {
                  name = kubernetes_secret.cloudinit_master[each.key].metadata[0].name
                }
              }
            },
          ]
        }
      }
    }
  }

  depends_on = [
    kubernetes_manifest.vm_image,
    kubernetes_manifest.vm_network,
    kubernetes_secret.cloudinit_master,
  ]

  timeouts {
    create = "25m"
    update = "25m"
  }
}

# ============================================
# VirtualMachines — Worker Nodes
# ============================================

resource "kubernetes_manifest" "vm_worker" {
  for_each = local.workers

  manifest = {
    apiVersion = "kubevirt.io/v1"
    kind       = "VirtualMachine"
    metadata = {
      name      = each.value.name
      namespace = var.namespace
      labels = merge(var.tags, {
        "harvesterhci.io/os"     = "linux"
        "app.kubernetes.io/name" = var.vm_name_prefix
        "role"                   = "worker"
      })
      annotations = {
        "harvesterhci.io/diskNames"            = jsonencode(["${each.value.name}-rootdisk", "${each.value.name}-datadisk"])
        "harvesterhci.io/volumeClaimTemplates" = local.worker_vclaims[each.key]
      }
    }
    spec = {
      running = true
      template = {
        metadata = {
          labels = {
            "harvesterhci.io/vmName" = each.value.name
          }
          annotations = var.ssh_public_key != "" ? {
            "harvesterhci.io/sshNames" = jsonencode(["${var.vm_name_prefix}-ssh-key"])
          } : {}
        }
        spec = {
          evictionStrategy = "LiveMigrate"
          hostname         = each.value.name
          domain = {
            machine = { type = "q35" }
            cpu = {
              cores   = var.worker_cpu
              sockets = 1
              threads = 1
            }
            resources = {
              limits = {
                cpu    = tostring(var.worker_cpu)
                memory = "${var.worker_memory}Gi"
              }
            }
            devices = {
              interfaces = [
                {
                  name   = "default"
                  bridge = {}
                  model  = "virtio"
                }
              ]
              disks = [
                {
                  name      = "rootdisk"
                  bootOrder = 1
                  disk      = { bus = "virtio" }
                },
                {
                  name = "datadisk"
                  disk = { bus = "virtio" }
                },
                {
                  name = "cloudinitdisk"
                  disk = { bus = "virtio" }
                },
              ]
            }
          }
          networks = [
            {
              name   = "default"
              multus = { networkName = "${var.namespace}/${var.network_name}" }
            }
          ]
          volumes = [
            {
              name       = "rootdisk"
              dataVolume = { name = "${each.value.name}-rootdisk" }
            },
            {
              name       = "datadisk"
              dataVolume = { name = "${each.value.name}-datadisk" }
            },
            {
              name = "cloudinitdisk"
              cloudInitNoCloud = {
                secretRef = {
                  name = kubernetes_secret.cloudinit_worker[each.key].metadata[0].name
                }
                networkDataSecretRef = {
                  name = kubernetes_secret.cloudinit_worker[each.key].metadata[0].name
                }
              }
            },
          ]
        }
      }
    }
  }

  # Workers tạo SAU masters — đảm bảo RKE2 server đã khởi động
  depends_on = [
    kubernetes_manifest.vm_image,
    kubernetes_manifest.vm_network,
    kubernetes_secret.cloudinit_worker,
    kubernetes_manifest.vm_master,
  ]

  timeouts {
    create = "25m"
    update = "25m"
  }
}

# ============================================
# Outputs
# ============================================

output "master_names" {
  description = "Tên các master (control-plane) nodes"
  value       = [for v in local.masters : v.name]
}

output "worker_names" {
  description = "Tên các worker nodes"
  value       = [for v in local.workers : v.name]
}

output "master_ips" {
  description = "IP của master nodes (name → ip)"
  value       = { for v in local.masters : v.name => v.ip }
}

output "worker_ips" {
  description = "IP của worker nodes (name → ip)"
  value       = { for v in local.workers : v.name => v.ip }
}

output "first_master_ip" {
  description = "IP của master node đầu tiên (dùng để copy kubeconfig)"
  value       = local.first_master_ip
}

output "kubeconfig_cmd" {
  description = "Lệnh lấy kubeconfig sau khi cluster ready"
  value       = "scp ubuntu@${local.first_master_ip}:/etc/rancher/rke2/rke2.yaml ~/.kube/harvester-rke2.yaml && sed -i 's/127.0.0.1/${local.first_master_ip}/g' ~/.kube/harvester-rke2.yaml"
}

output "network_name" {
  value = kubernetes_manifest.vm_network.object.metadata.name
}

output "image_name" {
  value = kubernetes_manifest.vm_image.object.metadata.name
}
