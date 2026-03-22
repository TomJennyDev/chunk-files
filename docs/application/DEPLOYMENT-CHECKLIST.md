# Deployment Checklist

This document provides a comprehensive checklist for deploying the File Processing System to production and testing environments.

## 1. Pre-Deployment Preparation

### Local Development / Testing
- [ ] Ensure Docker minimum resources: 4 CPUs, 8GB RAM assigned.
- [ ] Run `docker-compose up -d` to start LocalStack, Elasticsearch, and Observability stack.
- [ ] Verify LocalStack is healthy:
  ```bash
  curl -s http://localhost:4566/_localstack/health | jq
  ```
- [ ] Verify Elasticsearch cluster status:
  ```bash
  curl -s http://localhost:9200/_cluster/health | jq
  ```
  *(Status should be "yellow" or "green")*

### Production Settings
- [ ] Obtain correct AWS credentials and roles (production AWS account).
- [ ] Verify Elastic Cloud / OpenSearch Service endpoints and API keys.
- [ ] Confirm Domain Name and SSL certificate availability.
- [ ] Verify Terraform variables match production values (e.g., larger instances, multi-AZ enabled).

---

## 2. Infrastructure Deployment (Terraform / AWS)

- [ ] Initialize Terraform:
  ```bash
  cd infra/terraform
  terraform init
  ```
- [ ] Validate Terraform plan:
  ```bash
  terraform plan -var-file="prod.tfvars" -out=tfplan
  ```
- [ ] Apply Terraform:
  ```bash
  terraform apply "tfplan"
  ```
- [ ] Verify critical resources are created:
  - S3 Buckets (file storage, lambda code)
  - SQS Queue + DLQ
  - Lambda Layer
  - Lambda Event Source Mapping

---

## 3. Application Deployment

### Lambda Layer and Functions
- [ ] Package the dependencies for the Lambda Layer.
- [ ] Build the Lambda functions using esbuild/webpack.
- [ ] Upload Lambda zip packages to the corresponding S3 artifact bucket or use `aws lambda update-function-code`.

### Backend (NestJS API)
- [ ] Build the file-processor app:
  ```bash
  pnpm --filter @chunk-files/api build
  ```
- [ ] Set necessary environment variables (`AWS_REGION`, `AWS_ENDPOINT`, `SQS_QUEUE_URL`, `ELASTICSEARCH_NODE`, etc.).
- [ ] Deploy the API server (via ECS, EKS, or EC2 as chosen).
- [ ] Check health endpoint:
  ```bash
  curl -s https://api.yourdomain.com/health
  ```

### Frontend (Vue/React Web App)
- [ ] Create production build:
  ```bash
  pnpm --filter @chunk-files/web build
  ```
- [ ] Verify environment variables point to the correct API endpoint (`VITE_API_URL`).
- [ ] Deploy static assets to S3 + CloudFront or Vercel/Netlify.
- [ ] Invalidate CloudFront cache if updating an existing deployment.

---

## 4. Post-Deployment Verification

### End-to-End Testing
- [ ] Upload a test file (e.g., small markdown file).
- [ ] Check the status endpoint for successful S3 upload and SQS dispatch.
- [ ] Check Kibana/OpenSearch to verify the document was indexed successfully.
- [ ] Perform a full-text search test from the Web UI to ensure results are returned.

### Observability & Monitoring
- [ ] Open Grafana (or your log provider).
- [ ] Verify that new traces successfully correlate logs and metrics across the API and Lambda worker.
- [ ] Trigger an intentional failure (e.g., an unsupported format) and confirm that DLQ is populated and errors are logged correctly.

---

## 5. Rollback Plan

- [ ] **Infrastructure Rollback:**
  ```bash
  terraform destroy -var-file="prod.tfvars"  # ONLY if a complete rollback is needed (Rare)
  # Or revert via `terraform apply` with the previous good commit.
  ```
- [ ] **App Rollback:** Re-deploy the previous tag/container image for the API.
- [ ] **Frontend Rollback:** Revert to the previous build artifact on CDN/S3.
