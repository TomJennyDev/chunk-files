# ============================================
# Providers Configuration — Proxmox VE
# ============================================

# Proxmox Provider — quản lý VM trên Proxmox
provider "proxmox" {
  endpoint  = var.proxmox_endpoint   # https://192.168.1.10:8006
  api_token = var.proxmox_api_token  # user@pam!token-id=<secret>
  insecure  = var.proxmox_insecure   # true nếu dùng self-signed cert

  ssh {
    agent       = true
    username    = var.proxmox_ssh_user
    private_key = var.proxmox_ssh_private_key != "" ? file(var.proxmox_ssh_private_key) : null
  }
}

# Kubernetes Provider — deploy workloads vào K3s guest cluster
provider "kubernetes" {
  config_path    = var.guest_kubeconfig
  config_context = var.guest_kube_context
}

# Helm Provider — cài Helm charts vào K3s guest cluster
provider "helm" {
  kubernetes {
    config_path    = var.guest_kubeconfig
    config_context = var.guest_kube_context
  }
}
