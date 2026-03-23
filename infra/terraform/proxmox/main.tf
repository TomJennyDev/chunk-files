# ============================================
# Proxmox Terraform — Root Module
# Mỗi service = 1 LXC container riêng, chạy Docker bên trong
# ============================================

module "proxmox_docker" {
  source = "./modules/proxmox-docker"

  proxmox_node   = var.proxmox_node
  ct_id_start    = var.ct_id_start
  project_name   = "${var.project_name}-${var.environment}"
  storage        = var.lxc_storage
  network_bridge = var.lxc_network_bridge
  ct_template    = var.lxc_template
  ip_prefix      = var.lxc_ip_prefix
  gateway        = var.lxc_gateway
  dns            = var.lxc_dns
  ssh_public_key = var.ssh_public_key
  password       = var.lxc_password
  tags           = var.tags

  # Toggle từng service
  enable_localstack    = var.enable_localstack
  enable_elasticsearch = var.enable_elasticsearch
  enable_kibana        = var.enable_kibana
  enable_observability = var.enable_observability
  enable_api           = var.enable_api
  enable_web           = var.enable_web
  enable_ollama        = var.enable_ollama

  localstack_services   = var.localstack_services
  elasticsearch_version = var.elasticsearch_version
  ssh_private_key_path  = var.ssh_private_key_path
  snippets_storage      = var.snippets_storage

  # Ollama config
  ollama_model  = var.ollama_model
  ollama_memory = var.ollama_memory
  ollama_disk   = var.ollama_disk
  ollama_cores  = var.ollama_cores
}
