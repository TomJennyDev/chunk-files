# ============================================
# Providers Configuration — Proxmox VE (LXC + Docker)
# Dùng username/password vì API token không được set
# feature flags (nesting, keyctl) trên privileged container
# ============================================

provider "proxmox" {
  endpoint = var.proxmox_endpoint
  username = var.proxmox_username
  password = var.proxmox_password
  insecure = var.proxmox_insecure

  ssh {
    agent       = true
    username    = var.proxmox_ssh_user
    private_key = var.proxmox_ssh_private_key != "" ? file(var.proxmox_ssh_private_key) : null
  }
}
