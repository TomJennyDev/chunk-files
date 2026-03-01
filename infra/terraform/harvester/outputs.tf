# ============================================
# Outputs
# ============================================

# ---- RKE2 Cluster Nodes ----
output "master_names" {
  description = "Tên các master (control-plane) nodes"
  value       = module.harvester_vm.master_names
}

output "worker_names" {
  description = "Tên các worker nodes"
  value       = module.harvester_vm.worker_names
}

output "master_ips" {
  description = "IP của master nodes"
  value       = module.harvester_vm.master_ips
}

output "worker_ips" {
  description = "IP của worker nodes"
  value       = module.harvester_vm.worker_ips
}

output "first_master_ip" {
  description = "IP master đầu tiên (dùng để lấy kubeconfig)"
  value       = module.harvester_vm.first_master_ip
}

output "kubeconfig_cmd" {
  description = "Lệnh lấy kubeconfig sau khi cluster ready"
  value       = module.harvester_vm.kubeconfig_cmd
}

# ---- Infrastructure Endpoints (internal) ----
output "localstack_endpoint" {
  description = "LocalStack internal endpoint"
  value       = module.localstack.endpoint
}

output "elasticsearch_endpoint" {
  description = "Elasticsearch internal endpoint"
  value       = module.elasticsearch.elasticsearch_endpoint
}

output "kibana_endpoint" {
  description = "Kibana internal endpoint"
  value       = module.elasticsearch.kibana_endpoint
}

# ---- Observability Endpoints ----
output "grafana_endpoint" {
  description = "Grafana dashboard"
  value       = module.observability.grafana_service
}

output "prometheus_endpoint" {
  description = "Prometheus metrics"
  value       = module.observability.prometheus_service
}

output "otel_collector_grpc" {
  description = "OTel Collector gRPC endpoint"
  value       = module.observability.otel_collector_grpc
}

output "otel_collector_http" {
  description = "OTel Collector HTTP endpoint"
  value       = module.observability.otel_collector_http
}

# ---- Application ----
output "api_endpoint" {
  description = "API internal endpoint"
  value       = module.application.api_service
}

output "ingress_hosts" {
  description = "Ingress host mappings"
  value       = module.application.ingress_hosts
}

# ---- Access Info ----
output "access_info" {
  description = "Quick access guide"
  value = <<-EOT

    ============================================
    Chunk Files - Harvester RKE2 Deployment
    ============================================

    Cluster Nodes:
      Masters: ${join(", ", module.harvester_vm.master_names)}
      Workers: ${join(", ", module.harvester_vm.worker_names)}

    SSH Access:
      ssh ubuntu@${module.harvester_vm.first_master_ip}

    Copy kubeconfig (run after cluster is ready ~5 min):
      ${module.harvester_vm.kubeconfig_cmd}
      export KUBECONFIG=~/.kube/harvester-rke2.yaml
      kubectl get nodes -o wide

    Scale Workers:
      terraform apply -var="worker_count=5"

    Web UI:       http://chunk-files.local
    API:          http://chunk-files.local/api
    Grafana:      http://grafana.chunk-files.local  (admin / <password>)
    Kibana:       http://kibana.chunk-files.local

    Port Forward (debug):
      kubectl port-forward svc/localstack    4566:4566 -n ${var.namespace}
      kubectl port-forward svc/elasticsearch 9200:9200 -n ${var.namespace}
      kubectl port-forward svc/prometheus    9090:9090 -n ${var.namespace}

    ============================================
  EOT
}
