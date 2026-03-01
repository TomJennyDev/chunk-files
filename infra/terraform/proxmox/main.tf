# ============================================
# Proxmox Terraform — Root Module
# Deploy K8s cluster + full stack lên Proxmox VE
# ============================================

# ---- VM Nodes ----
module "proxmox_vm" {
  source = "./modules/proxmox-vm"

  proxmox_node   = var.proxmox_node
  vm_count       = var.vm_count
  vm_id_start    = var.vm_id_start
  vm_name_prefix = "${var.project_name}-${var.environment}"
  cpu_cores      = var.vm_cpu_cores
  cpu_type       = var.vm_cpu_type
  memory_mb      = var.vm_memory
  disk_size      = var.vm_disk_size
  data_disk_size = var.vm_data_disk_size
  storage        = var.vm_storage
  network_bridge = var.vm_network_bridge
  template_name  = var.vm_template_name
  ip_prefix      = var.vm_ip_prefix
  ip_start       = var.vm_ip_start
  gateway        = var.vm_gateway
  dns            = var.vm_dns
  ssh_public_key = var.ssh_public_key
  tags           = var.tags
}

# ---- Phase 2: Kubernetes Namespace + ConfigMap + Secrets ----
module "kubernetes" {
  source = "../harvester/modules/kubernetes"

  namespace    = var.namespace
  project_name = var.project_name
  environment  = var.environment

  labels = {
    "app.kubernetes.io/part-of" = var.project_name
    environment                 = var.environment
  }

  depends_on = [module.proxmox_vm]
}

# ---- Phase 3: LocalStack (AWS Emulator) ----
module "localstack" {
  source = "../harvester/modules/localstack"

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
  source = "../harvester/modules/elasticsearch"

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

# ---- Phase 5: Observability (OTel + Tempo + Loki + Prometheus + Grafana) ----
module "observability" {
  source = "../harvester/modules/observability"

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

# ---- Phase 6: Application (file-processor API + web + Ingress) ----
module "application" {
  source = "../harvester/modules/application"

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
