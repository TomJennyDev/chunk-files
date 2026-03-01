# 🖥️ Terraform Proxmox Deployment

Deploy toàn bộ Chunk Files stack lên **Proxmox VE** sử dụng Terraform.

> Provider: [`bpg/proxmox`](https://registry.terraform.io/providers/bpg/proxmox) — cross-platform (Windows/Linux/Mac), không cần binary riêng cho từng OS.

## 📋 Kiến Trúc Tổng Quan

```
┌─────────────────────────────────────────────────────────────┐
│                    Proxmox VE Server                         │
│                  (https://<ip>:8006)                         │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         VM: chunk-files-dev-node-1                    │  │
│  │         VMID: 200  |  Ubuntu 22.04  |  K3s            │  │
│  │         virtio0: root disk (50 GiB)                   │  │
│  │         virtio1: data disk (100 GiB) → /data           │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │           Kubernetes (K3s)                      │  │  │
│  │  │                                                 │  │  │
│  │  │  Namespace: chunk-files                         │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌───────────────┐   │  │  │
│  │  │  │   API    │ │   Web    │ │  LocalStack   │   │  │  │
│  │  │  │ (NestJS) │ │ (React)  │ │ (S3,SQS,     │   │  │  │
│  │  │  │  :3000   │ │   :80    │ │  Lambda...)   │   │  │  │
│  │  │  └──────────┘ └──────────┘ └───────────────┘   │  │  │
│  │  │  ┌──────────┐ ┌──────────┐                     │  │  │
│  │  │  │Elastic   │ │ Kibana   │                     │  │  │
│  │  │  │ search   │ │  :5601   │                     │  │  │
│  │  │  │  :9200   │ └──────────┘                     │  │  │
│  │  │  └──────────┘                                  │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐       │  │  │
│  │  │  │  OTel    │ │  Tempo   │ │   Loki   │       │  │  │
│  │  │  │Collector │ │ (Traces) │ │  (Logs)  │       │  │  │
│  │  │  └──────────┘ └──────────┘ └──────────┘       │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐       │  │  │
│  │  │  │Prometheus│ │ Grafana  │ │ Promtail │       │  │  │
│  │  │  │  :9090   │ │  :3000   │ │(DaemonSet)│      │  │  │
│  │  │  └──────────┘ └──────────┘ └──────────┘       │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Cấu Trúc Terraform

```
infra/terraform/proxmox/
├── main.tf                          # Root module — 6 phases orchestration
├── providers.tf                     # bpg/proxmox + Kubernetes + Helm providers
├── variables.tf                     # All input variables
├── outputs.tf                       # vm_ids, vm_ips, ssh_access, app URLs
├── versions.tf                      # Provider version constraints
├── terraform.tfvars.example         # Example variable values
└── modules/
    └── proxmox-vm/                  # Phase 1: VM provisioning
        ├── main.tf                  # proxmox_virtual_environment_vm resources
        └── templates/
            └── cloud-init.yaml     # K3s + QEMU agent bootstrap

# Reused from ../harvester/modules/:
#   kubernetes/     → Phase 2: Namespace, ConfigMaps, Secrets
#   localstack/     → Phase 3: AWS emulator (S3, SQS, Lambda)
#   elasticsearch/  → Phase 4: Search engine + Kibana
#   observability/  → Phase 5: OTel + Tempo + Loki + Prometheus + Grafana
#   application/    → Phase 6: API + Web + Ingress
```

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Mục đích |
|---|---|---|
| Terraform | ≥ 1.5 | Infrastructure as Code |
| Proxmox VE | ≥ 7.4 | Hypervisor platform |
| kubectl | ≥ 1.28 | Quản lý K8s cluster |
| SSH Key | - | VM access |
| Ubuntu 22.04 cloud template | - | Base VM template |

### Step 1: Tạo VM Template trên Proxmox

```bash
# SSH vào Proxmox node, chạy script tạo Ubuntu 22.04 cloud-init template

# Tải Ubuntu 22.04 cloud image
wget https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64.img \
  -O /tmp/ubuntu-22.04-cloud.img

# Tạo VM template (VMID 9000)
qm create 9000 --name "ubuntu-22.04-cloud" --memory 2048 --cores 2 --net0 virtio,bridge=vmbr0
qm importdisk 9000 /tmp/ubuntu-22.04-cloud.img local-lvm
qm set 9000 --scsihw virtio-scsi-pci --scsi0 local-lvm:vm-9000-disk-0
qm set 9000 --boot c --bootdisk scsi0
qm set 9000 --ide2 local-lvm:cloudinit
qm set 9000 --serial0 socket --vga serial0
qm set 9000 --agent enabled=1
qm set 9000 --tags template

# Chuyển thành template
qm template 9000
```

### Step 2: Tạo Proxmox API Token

```bash
# Trong Proxmox UI:
# Datacenter → Permissions → API Tokens → Add

# Hoặc qua CLI (pveum):
pveum user token add root@pam terraform --expire 0
pveum aclmod / -user root@pam -role Administrator

# Format token: root@pam!terraform=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Step 3: Cấu hình Terraform

```bash
cd infra/terraform/proxmox

cp terraform.tfvars.example terraform.tfvars
```

Chỉnh sửa `terraform.tfvars` — các trường **bắt buộc**:

```hcl
proxmox_endpoint  = "https://192.168.1.10:8006"
proxmox_api_token = "root@pam!terraform=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
proxmox_node      = "pve"
vm_template_name  = "ubuntu-22.04-cloud"  # tên template đã tạo ở Step 1
vm_ip_prefix      = "192.168.1"           # để "" nếu dùng DHCP
vm_gateway        = "192.168.1.1"
ssh_public_key    = "ssh-rsa AAAAB3Nz..."
```

### Step 4: Deploy VM

```bash
# Khởi tạo providers
terraform init

# Xem plan
terraform plan

# Deploy VMs (Phase 1)
terraform apply -target=module.proxmox_vm
```

### Step 5: Thiết lập kubeconfig

```bash
# Sau khi VM boot và K3s cài xong (~3-5 phút):
VM_IP=$(terraform output -json vm_ips | jq -r '.["chunk-files-dev-node-1"]')

# Copy kubeconfig từ VM
scp ubuntu@${VM_IP}:/home/ubuntu/.kube/config ~/.kube/proxmox-k3s.yaml

# Thay server address
sed -i "s/127.0.0.1/${VM_IP}/g" ~/.kube/proxmox-k3s.yaml

export KUBECONFIG=~/.kube/proxmox-k3s.yaml
kubectl get nodes
```

### Step 6: Deploy toàn bộ Stack

```bash
# Cập nhật guest_kubeconfig trong terraform.tfvars
echo 'guest_kubeconfig = "~/.kube/proxmox-k3s.yaml"' >> terraform.tfvars

# Deploy tất cả
terraform apply
```

## 🔧 Deployment Phases

```
Phase 1: proxmox-vm      → Tạo VM + cloud-init K3s (Proxmox native API)
         ↓
Phase 2: kubernetes      → Namespace, ConfigMaps, Secrets
         ↓
Phase 3: localstack  ─┐  → S3, SQS, Lambda emulator
Phase 4: elasticsearch─┤  → Search engine + Kibana
Phase 5: observability─┘  → OTel + Tempo + Loki + Prometheus + Grafana
         ↓
Phase 6: application     → NestJS API + React Web + Ingress
```

## 📊 Modules Chi Tiết

### Module: `proxmox-vm` (local)

Tạo VM trên Proxmox bằng `bpg/proxmox` provider:

| Resource | Mô tả |
|---|---|
| `proxmox_virtual_environment_vm` | VM với 2 disks (root + data) |
| `proxmox_virtual_environment_file` | Cloud-init snippets upload |
| `data.proxmox_virtual_environment_vms` | Tìm template theo tên |

**Cloud-init tự động:**
- Cài QEMU guest agent
- Format và mount data disk (`/dev/vdb` → `/data`)
- Cài K3s với `--data-dir /data/k3s`
- Tạo kubeconfig tại `/home/ubuntu/.kube/config`

```hcl
module "proxmox_vm" {
  vm_count       = 1         # 1 cho dev, 3+ cho HA
  vm_id_start    = 200       # VMID đầu tiên
  cpu_cores      = 4
  memory_mb      = 8192      # MB
  disk_size      = 50        # GB — root disk
  data_disk_size = 100       # GB — data disk cho K8s PVs
  storage        = "local-lvm"
}
```

### Modules được tái sử dụng từ `../harvester/modules/`

| Module | Chức năng |
|---|---|
| `kubernetes` | Namespace + ConfigMap + AWS Secret |
| `localstack` | S3, SQS, Lambda emulator (LocalStack) |
| `elasticsearch` | Elasticsearch 8.x + Kibana |
| `observability` | OTel Collector + Tempo + Loki + Prometheus + Grafana + Promtail |
| `application` | NestJS API + React Web + NGINX Ingress |

## 🔄 Quản Lý

### Scale VM

```bash
# Thêm VM worker
terraform apply -var="vm_count=3"
```

### Scale Application

```bash
# Tăng API replicas
terraform apply -var="api_replicas=3"
```

### Port Forward (debug)

```bash
export KUBECONFIG=~/.kube/proxmox-k3s.yaml

kubectl port-forward svc/grafana 3001:3000 -n chunk-files
kubectl port-forward svc/prometheus 9090:9090 -n chunk-files
kubectl port-forward svc/localstack 4566:4566 -n chunk-files
kubectl port-forward svc/elasticsearch 9200:9200 -n chunk-files
kubectl port-forward svc/kibana 5601:5601 -n chunk-files
```

### Ingress Hosts

Thêm vào `/etc/hosts` (thay `<vm-ip>` bằng IP thực):

```
<vm-ip>  chunk-files.local
<vm-ip>  grafana.chunk-files.local
<vm-ip>  kibana.chunk-files.local
```

| URL | Dịch vụ |
|---|---|
| `http://chunk-files.local` | Web UI + API |
| `http://grafana.chunk-files.local` | Grafana |
| `http://kibana.chunk-files.local` | Kibana |

### Destroy

```bash
# Xóa toàn bộ (bao gồm cả VM trên Proxmox)
terraform destroy

# Xóa chỉ application layer
terraform destroy -target=module.application
```

## ⚙️ Variables Quan Trọng

| Variable | Default | Mô tả |
|---|---|---|
| `proxmox_endpoint` | — | URL Proxmox API, bắt buộc |
| `proxmox_api_token` | — | Token xác thực, bắt buộc |
| `proxmox_node` | `"pve"` | Tên node Proxmox |
| `vm_count` | `1` | Số lượng VM |
| `vm_id_start` | `200` | VMID bắt đầu |
| `vm_cpu_cores` | `4` | CPU cores/VM |
| `vm_memory` | `8192` | RAM (MB)/VM |
| `vm_disk_size` | `50` | Root disk (GB) |
| `vm_data_disk_size` | `100` | Data disk (GB) |
| `vm_storage` | `"local-lvm"` | Proxmox storage pool |
| `vm_template_name` | `"ubuntu-22.04-cloud"` | Tên template |
| `vm_ip_prefix` | `""` | IP prefix, để `""` dùng DHCP |
| `vm_gateway` | `"192.168.1.1"` | Default gateway |
| `ssh_public_key` | `""` | SSH public key inject vào VM |
| `grafana_admin_password` | `"admin"` | Mật khẩu Grafana |
| `domain` | `"chunk-files.local"` | Base domain cho Ingress |

## 🆚 So Sánh Proxmox vs Harvester

| | Proxmox VE | Harvester HCI |
|---|---|---|
| **Terraform Provider** | `bpg/proxmox` (native, cross-platform) | `kubernetes_manifest` + CRDs |
| **VM tạo via** | Proxmox REST API trực tiếp | Kubernetes CRDs (kubevirt) |
| **Cloud-init** | `proxmox_virtual_environment_file` snippets | `kubernetes_secret` base64 |
| **Static IP** | `initialization { ip_config }` | Trong CRD spec.networks |
| **Windows support** | ✅ | ✅ (sau khi dùng k8s provider) |
| **Setup phức tạp** | Thấp | Cao hơn (cần Harvester cluster) |
| **Phù hợp** | Homelab, SMB | Enterprise HCI |

## ⚠️ Lưu Ý Cho Production

1. **API Token permissions**: Dùng role với quyền tối thiểu, không dùng `root@pam`
2. **TLS**: Đặt `proxmox_insecure = false` và cài cert hợp lệ cho Proxmox
3. **Thay passwords**: `grafana_admin_password`, Elasticsearch passwords
4. **HA mode**: `vm_count = 3` + K3s embedded etcd (`--cluster-init`)
5. **Backup**: Bật Proxmox Backup Server cho VM snapshots
6. **Network**: Tách management VLAN và workload VLAN bằng `vm_network_bridge`
7. **Storage**: Dùng Ceph hoặc ZFS cho `vm_storage` trong production thay vì `local-lvm`
