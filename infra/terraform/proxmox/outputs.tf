# ============================================
# Outputs — Proxmox Deployment
# ============================================

output "vm_ids" {
  description = "Proxmox VM IDs (name → vm_id)"
  value       = module.proxmox_vm.vm_ids
}

output "vm_names" {
  description = "Tên các VM đã tạo"
  value       = module.proxmox_vm.vm_names
}

output "vm_ips" {
  description = "IP addresses của VMs (name → ip)"
  value       = module.proxmox_vm.vm_ips
}

output "namespace" {
  description = "Kubernetes namespace cho ứng dụng"
  value       = var.namespace
}

output "kubeconfig_path" {
  description = "Path đến kubeconfig file của guest cluster"
  value       = var.guest_kubeconfig
}

output "application_urls" {
  description = "URLs truy cập ứng dụng (cần thêm hosts hoặc Ingress)"
  value = {
    api     = "http://${var.domain}"
    grafana = "http://grafana.${var.domain}"
    kibana  = "http://kibana.${var.domain}"
  }
}

output "ssh_access" {
  description = "Hướng dẫn SSH vào VM"
  value = {
    for name in module.proxmox_vm.vm_names :
    name => "ssh ubuntu@${try(module.proxmox_vm.vm_ips[name], "<dhcp-ip>")}"
  }
}
