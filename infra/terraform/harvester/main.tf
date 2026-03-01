# ============================================
# Root Module — Chunk Files on Harvester HCI
# Orchestrates all modules
# ============================================

# ---- Phase 1: RKE2 Cluster (Master + Worker VMs) ----
module "harvester_vm" {
  source = "./modules/harvester-vm"

  providers = {
    kubernetes = kubernetes.harvester
  }

  namespace      = var.harvester_namespace
  vm_name_prefix = var.project_name

  # Cluster topology
  master_count = var.master_count
  worker_count = var.worker_count

  # Resources per role
  master_cpu       = var.master_cpu
  master_memory    = var.master_memory
  master_disk_size = var.master_disk_size
  worker_cpu       = var.worker_cpu
  worker_memory    = var.worker_memory
  worker_disk_size = var.worker_disk_size
  data_disk_size   = var.vm_data_disk_size

  # VM image & network
  image_name   = var.vm_image_name
  image_url    = var.vm_image_url
  network_name = var.vm_network_name
  vlan_id      = var.vm_vlan_id

  # Static IPs
  master_ips  = slice(var.master_ips, 0, var.master_count)
  worker_ips  = slice(var.worker_ips, 0, var.worker_count)
  ip_cidr     = var.ip_cidr
  ip_gateway  = var.ip_gateway
  ip_dns      = var.ip_dns

  # RKE2
  rke2_token   = var.rke2_token
  rke2_version = var.rke2_version
  rke2_disable = var.rke2_disable

  ssh_public_key = var.ssh_public_key
  tags           = var.tags
}

# ---- Phase 2: Kubernetes Base (Namespace, ConfigMaps, Secrets) ----
module "kubernetes" {
  source = "./modules/kubernetes"

  namespace    = var.namespace
  project_name = var.project_name
  environment  = var.environment

  labels = {
    "app.kubernetes.io/part-of" = var.project_name
    environment                 = var.environment
  }

  depends_on = [module.harvester_vm]
}

# ---- Phase 3: LocalStack (AWS Emulator) ----
module "localstack" {
  source = "./modules/localstack"

  namespace    = module.kubernetes.namespace
  services     = var.localstack_services
  storage_size = "5Gi"

  labels = {
    "app.kubernetes.io/part-of" = var.project_name
    environment                 = var.environment
  }

  depends_on = [module.kubernetes]
}

# ---- Phase 4: Elasticsearch + Kibana ----
module "elasticsearch" {
  source = "./modules/elasticsearch"

  namespace             = module.kubernetes.namespace
  elasticsearch_version = var.elasticsearch_version
  java_opts             = var.elasticsearch_java_opts
  storage_size          = var.elasticsearch_storage_size

  labels = {
    "app.kubernetes.io/part-of" = var.project_name
    environment                 = var.environment
  }

  depends_on = [module.kubernetes]
}

# ---- Phase 5: Observability Stack ----
module "observability" {
  source = "./modules/observability"

  namespace              = module.kubernetes.namespace
  grafana_admin_password = var.grafana_admin_password
  retention              = var.observability_retention
  storage_size           = var.observability_storage_size

  labels = {
    "app.kubernetes.io/part-of" = var.project_name
    environment                 = var.environment
  }

  depends_on = [module.kubernetes]
}

# ---- Phase 6: Application (API + Web + Ingress) ----
module "application" {
  source = "./modules/application"

  namespace       = module.kubernetes.namespace
  api_image       = var.api_image
  api_replicas    = var.api_replicas
  web_image       = var.web_image
  config_map_name = module.kubernetes.config_map_name
  secret_name     = module.kubernetes.secret_name

  labels = {
    "app.kubernetes.io/part-of" = var.project_name
    environment                 = var.environment
  }

  depends_on = [
    module.localstack,
    module.elasticsearch,
    module.observability,
  ]
}
