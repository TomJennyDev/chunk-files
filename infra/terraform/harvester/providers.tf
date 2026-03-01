# ============================================
# Providers Configuration
#
# Hai Kubernetes contexts:
#   kubernetes.harvester → Harvester cluster (quản lý VM CRDs)
#   kubernetes (default) → Guest K3s cluster (deploy workloads)
# ============================================

# Kubernetes Provider (alias: harvester) — trỏ vào Harvester HCI API
# Dùng để tạo VM, Image, Network qua kubernetes_manifest (CRDs)
provider "kubernetes" {
  alias          = "harvester"
  config_path    = var.harvester_kubeconfig
  config_context = var.harvester_kube_context
}

# Kubernetes Provider (default) — trỏ vào K3s guest cluster
provider "kubernetes" {
  config_path    = var.guest_kubeconfig
  config_context = var.guest_kube_context
}

# Helm Provider — deploy Helm charts vào guest cluster
provider "helm" {
  kubernetes {
    config_path    = var.guest_kubeconfig
    config_context = var.guest_kube_context
  }
}
