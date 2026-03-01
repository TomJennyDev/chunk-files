# Infrastructure

This project has multiple infrastructure tracks.

## Local Development Stack

Main file: `docker-compose.yml`

Services:

- LocalStack
- Elasticsearch + Kibana
- Observability stack (OTel Collector, Tempo, Loki, Prometheus, Grafana, Promtail)

Start/stop:

```bash
pnpm docker:up
pnpm docker:down
```

## Terraform: LocalStack Target

Path: `infra/terraform`

Manages:

- S3 bucket
- SQS + DLQ
- Lambda worker packaging and deploy
- IAM role/policies
- OpenSearch domain resources (LocalStack-focused)

Quick run:

```bash
cd infra/terraform
make init
make setup
```

## Terraform: Harvester Target

Path: `infra/terraform/harvester`

Purpose:

- Provision VMs
- Bootstrap Kubernetes
- Deploy application + observability stack

## Terraform: Proxmox Target

Path: `infra/terraform/proxmox`

Purpose:

- Provision VM workload on Proxmox
- Reuse Kubernetes/application modules from Harvester stack

## Bootstrapping Scripts

- `infra/init-aws.sh`
- `infra/init-scripts/*`

## Notes

- Some docs still mention old paths (`terraform/file-processor`); use current path `infra/terraform`.
- Choose one bootstrap path for local resources (Terraform or init scripts) to avoid duplicated provisioning intent.

## Related Docs

- [Quick Start](../QUICKSTART.md)
- [Workflow](../application/WORKFLOW.md)
- [Observability](../observability/README.md)