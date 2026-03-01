# 🏗️ Terraform Harvester Deployment

Deploy toàn bộ Chunk Files stack lên **Harvester HCI** sử dụng Terraform.
Cluster Kubernetes được cài bằng **RKE2** với topology master/worker có thể scale.

## 📋 Kiến Trúc Tổng Quan

```
┌─────────────────────────────────────────────────────────────┐
│                    Harvester HCI Cluster                     │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              VM: chunk-files-master-1                  │  │
│  │              (Ubuntu 22.04 + RKE2 control-plane)       │  │
│  │                                                       │  │
│     VM: chunk-files-worker-1  VM: chunk-files-worker-2    │  │
│     (Ubuntu 22.04 + RKE2 agent)                           │  │
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
│  │  │  │4317/4318 │ │  :3200   │ │  :3100   │       │  │  │
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
infra/terraform/harvester/
├── main.tf                          # Root module — orchestration
├── providers.tf                     # Harvester + K8s + Helm providers
├── variables.tf                     # All input variables
├── outputs.tf                       # Output values
├── versions.tf                      # Provider version constraints
├── terraform.tfvars.example         # Example variable values
├── modules/
│   ├── harvester-vm/                # Phase 1: VM provisioning (master + worker)
│   │   ├── main.tf
│   │   └── templates/
│   │       ├── cloud-init-master.yaml  # RKE2 server bootstrap
│   │       ├── cloud-init-worker.yaml  # RKE2 agent bootstrap
│   │       └── network-config.yaml     # Static IP via netplan
│   ├── kubernetes/                  # Phase 2: Namespace, ConfigMaps
│   │   └── main.tf
│   ├── localstack/                  # Phase 3: AWS emulator
│   │   └── main.tf
│   ├── elasticsearch/               # Phase 4: Search engine + Kibana
│   │   └── main.tf
│   ├── observability/               # Phase 5: Full observability stack
│   │   └── main.tf
│   └── application/                 # Phase 6: API + Web + Ingress
│       └── main.tf
```

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Mục đích |
|---|---|---|
| Terraform | ≥ 1.5 | Infrastructure as Code |
| kubectl | ≥ 1.28 | K8s cluster access |
| Harvester | ≥ 1.2 | HCI platform |
| SSH Key | - | VM access |

### Step 1: Cấu hình

```bash
cd infra/terraform/harvester

# Copy và chỉnh sửa biến
cp terraform.tfvars.example terraform.tfvars

# Cập nhật các giá trị quan trọng:
# - harvester_kubeconfig: path đến Harvester kubeconfig
# - ssh_public_key: SSH public key cho VM access  
# - grafana_admin_password: password cho Grafana
```

### Step 2: Lấy Harvester Kubeconfig

```bash
# Từ Harvester UI:
# Advanced → Settings → kubeconfig → Download

# Hoặc từ API:
curl -k https://<harvester-ip>/v1/management.cattle.io.clusters/local \
  -H "Authorization: Bearer <token>" | jq -r '.status.driver'
```

### Step 3: Deploy

```bash
# Khởi tạo Terraform
terraform init

# Xem plan
terraform plan

# Apply — Phase 1 trước: tạo VMs (master + worker)
terraform apply -target=module.harvester_vm

# Sau ~5 phút, copy kubeconfig từ master node
MASTER_IP=$(terraform output -raw first_master_ip)
scp ubuntu@${MASTER_IP}:/etc/rancher/rke2/rke2.yaml ~/.kube/harvester-rke2.yaml
sed -i "s/127.0.0.1/${MASTER_IP}/g" ~/.kube/harvester-rke2.yaml
export KUBECONFIG=~/.kube/harvester-rke2.yaml
kubectl get nodes -o wide

# Cập nhật guest_kubeconfig trong terraform.tfvars
echo 'guest_kubeconfig = "~/.kube/harvester-rke2.yaml"' >> terraform.tfvars

# Deploy toàn bộ stack K8s
terraform apply
```

### Step 4: Kiểm tra cluster

```bash
export KUBECONFIG=~/.kube/harvester-rke2.yaml

# Kiểm tra nodes
kubectl get nodes -o wide

# Kiểm tra services
kubectl get pods -n chunk-files
kubectl get svc -n chunk-files
kubectl get ingress -n chunk-files
```

## 🔧 Deployment Phases

Terraform deploy theo thứ tự phụ thuộc:

```
Phase 1: harvester-vm    → Tạo VMs (Master + Worker) với RKE2 + Longhorn
         ↓
Phase 2: kubernetes      → Namespace, ConfigMaps, Secrets
         ↓
Phase 3: localstack      → S3, SQS, Lambda emulator
Phase 4: elasticsearch   → Search engine + Kibana
Phase 5: observability   → OTel + Tempo + Loki + Prometheus + Grafana
         ↓
Phase 6: application     → NestJS API + React Web + Ingress
```

## 📊 Modules Chi Tiết

### Module: `harvester-vm`

Tạo RKE2 cluster trên Harvester với cloud-init tự động:
- Ubuntu 22.04 Server
- **RKE2** (production-grade Kubernetes, CNCF-certified)
- **Embedded etcd** (HA với 3 master nodes)
- **Canal CNI** (default RKE2 CNI)
- Root disk + Data disk (cho K8s PVs)

**Topology có thể scale:**

```hcl
module "harvester_vm" {
  master_count = 3   # 1 = dev | 3 = HA (embedded etcd)
  worker_count = 5   # Scale thoải mái

  # Tài nguyên riêng cho từng role:
  master_cpu    = 4
  master_memory = 8   # GiB
  worker_cpu    = 8
  worker_memory = 16  # GiB

  # Static IPs bắt buộc (RKE2 cần biết IP trước)
  master_ips = ["192.168.100.10", "192.168.100.11", "192.168.100.12"]
  worker_ips = ["192.168.100.20", "192.168.100.21", ...]
}
```

**RKE2 Bootstrap Flow:**
```
Master-1 (cluster-init) → RKE2 server với --cluster-init
       ↓
Master-2,3              → RKE2 server join master-1
       ↓
Worker-1..N             → RKE2 agent join master-1
```

### Module: `observability`

Deploy toàn bộ observability stack:
- **OTel Collector**: Central telemetry pipeline (traces, metrics, logs)
- **Tempo**: Distributed tracing backend
- **Loki**: Log aggregation
- **Prometheus**: Metrics collection + alerting
- **Grafana**: Visualization dashboards
- **Promtail**: DaemonSet thu thập pod logs

### Module: `application`

Deploy ứng dụng + Ingress:
- NestJS API (backend)
- React Web (frontend)
- NGINX Ingress rules

**Ingress hosts:**
| Host | Service |
|---|---|
| `chunk-files.local` | Web UI + API |
| `grafana.chunk-files.local` | Grafana Dashboard |
| `kibana.chunk-files.local` | Kibana Dashboard |

## 🔄 Quản Lý

### Scale

```bash
# Thêm worker nodes (không cần rebuild master)
terraform apply -var="worker_count=5"

# Scale API replicas
terraform apply -var="api_replicas=3"

# Nâng cấp lên HA control-plane (1 → 3 masters)
# 1. Cập nhật master_ips trong tfvars (thêm IP cho master 2 và 3)
# 2. terraform apply -var="master_count=3"
```

### Destroy

```bash
# Xóa toàn bộ
terraform destroy

# Xóa chỉ application
terraform destroy -target=module.application
```

### Port Forward (debug)

```bash
# Grafana
kubectl port-forward svc/grafana 3001:3000 -n chunk-files

# Prometheus  
kubectl port-forward svc/prometheus 9090:9090 -n chunk-files

# LocalStack
kubectl port-forward svc/localstack 4566:4566 -n chunk-files

# Elasticsearch
kubectl port-forward svc/elasticsearch 9200:9200 -n chunk-files
```

## ⚠️ Lưu Ý Cho Production

1. **Thay đổi passwords**: `grafana_admin_password`, Elasticsearch security
2. **Enable TLS**: Thêm cert-manager + Let's Encrypt cho Ingress
3. **HA mode**: `vm_count = 3`, `api_replicas = 3`
4. **Backup**: Enable Longhorn snapshots, Velero cho K8s backup
5. **Resource limits**: Tăng CPU/memory cho production workloads
6. **Network Policy**: Giới hạn traffic giữa các pods
7. **Secrets management**: Dùng HashiCorp Vault thay vì K8s Secrets
