# ============================================
# Outputs — Proxmox LXC per-service Deployment
# ============================================

output "service_containers" {
  description = "Map: service_name → {ct_id, name, ip, image, ports}"
  value       = module.proxmox_docker.service_containers
}

output "service_ips" {
  description = "Map: service_name → IP address"
  value       = module.proxmox_docker.service_ips
}

output "service_urls" {
  description = "URLs truy cập từng service"
  value       = module.proxmox_docker.service_urls
}

output "ssh_access" {
  description = "Hướng dẫn SSH vào từng container"
  value = {
    for k, v in module.proxmox_docker.service_containers :
    k => "ssh root@${v.ip}"
  }
}

output "hook_scripts" {
  description = "Hook scripts được gán cho từng container"
  value       = module.proxmox_docker.hook_scripts
}

output "setup_info" {
  description = "Thông tin về cơ chế tự động"
  value       = module.proxmox_docker.setup_info
}
