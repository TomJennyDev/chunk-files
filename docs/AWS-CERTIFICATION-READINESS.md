# AWS Certification Readiness Matrix

Updated: 2026-03-21

This page answers one question: "With the current repo docs only, are we ready to pass all AWS certifications?"

Short answer: No. Current docs are strong for serverless application implementation, but not enough for all certification tracks.

## Scope

Assessment is based on existing documentation in:
- `docs/lambda`
- `docs/docker`
- `docs/elasticsearch`
- `docs/observability`
- `docs/application`
- `docs/senior-architect`

## Current coverage strengths

- Strong: Lambda lifecycle, caching, deployment, integration flow
- Strong: Docker fundamentals, compose patterns, CI/CD basics
- Medium: Observability concepts and tracing/logging pipelines
- Medium: Architecture patterns and scaling concepts
- Limited: AWS networking depth (VPC, Transit Gateway, Direct Connect, Route 53, CloudFront)
- Limited: AWS security operations depth (IAM strategy, Organizations, SCP, IR playbooks)
- Limited: Data/ML specialty content (Glue, Lake Formation, SageMaker, feature pipelines, model governance)

## Readiness by certification (docs-only)

| Level | Certification | Readiness | Notes |
|---|---|---:|---|
| Foundational | Cloud Practitioner (CLF-C02) | 40% | Missing broad AWS services, billing/governance depth |
| Foundational | AI Practitioner (AIF-C01) | 25% | Need GenAI/ML fundamentals and responsible AI coverage |
| Associate | Developer (DVA-C02) | 60% | Best fit today; still missing IAM/security deployment depth |
| Associate | Solutions Architect (SAA-C03) | 35% | Missing multi-tier design across core AWS services |
| Associate | SysOps Admin (SOA-C02) | 30% | Missing operations, backup/restore, incident-heavy scope |
| Associate | Data Engineer (DEA-C01) | 20% | Missing data lake, ETL, governance, streaming architecture |
| Associate | ML Engineer (MLA-C01) | 20% | Missing SageMaker-centric MLOps lifecycle |
| Professional | Solutions Architect (SAP-C02) | 25% | Missing multi-account, migration, hybrid, governance depth |
| Professional | DevOps Engineer (DOP-C02) | 45% | Good start from CI/CD docs, but needs advanced AWS ops |
| Professional | Generative AI Developer (AIP-C01) | 25% | Missing Bedrock/agents/guardrails evaluation patterns |
| Specialty | Security (SCS-C03) | 20% | Need KMS, IAM strategy, detective/response design depth |
| Specialty | Advanced Networking (ANS-C01) | 10% | Major gap in hybrid and large-scale network architecture |
| Specialty | Machine Learning (MLS-C01) | 15% | Need end-to-end ML pipeline and model ops depth |

## Why not enough for "all certs"

Current docs are implementation-heavy for one architecture stack. AWS certifications test broad service tradeoffs across many domains, including:
- Security governance at scale (Organizations, SCP, IAM boundaries)
- Advanced networking and hybrid connectivity
- Data engineering platforms and governance
- Full ML/MLOps and GenAI service patterns
- Cost optimization at organization scale and multi-account strategy

## Gap checklist to close

Priority P0:
- IAM advanced design (permission boundaries, SCP, cross-account)
- VPC and network architecture (NAT, endpoints, TGW, Direct Connect, CloudFront)
- DR and backup strategy across AWS services
- Cloud cost governance and FinOps fundamentals

Priority P1:
- Data engineering stack (S3 lake, Glue, Athena, Lake Formation, Kinesis, Redshift)
- Security operations (GuardDuty, Security Hub, Detective, incident response)
- Platform reliability patterns (multi-account landing zone, control planes)

Priority P2:
- SageMaker and ML engineering operations
- Bedrock, prompt orchestration, guardrails, evaluation frameworks
- Enterprise migration and modernization playbooks

## Suggested docs to add next

- `docs/aws-cert/IAM-ADVANCED.md`
- `docs/aws-cert/AWS-NETWORKING-FOUNDATIONS-TO-ADVANCED.md`
- `docs/aws-cert/MULTI-ACCOUNT-GOVERNANCE.md`
- `docs/aws-cert/DATA-ENGINEERING-ON-AWS.md`
- `docs/aws-cert/SECURITY-OPERATIONS-ON-AWS.md`
- `docs/aws-cert/SAGEMAKER-MLOPS.md`
- `docs/aws-cert/BEDROCK-GENAI-PATTERNS.md`
- `docs/aws-cert/EXAM-PREP-CHECKLISTS.md`

## Exam list reference (official AWS)

- Foundational exam guides:
  - https://docs.aws.amazon.com/aws-certification/latest/examguides/foundational-exams.html
- Professional exam guides:
  - https://docs.aws.amazon.com/aws-certification/latest/examguides/professional-exams.html
- Specialty exam guides:
  - https://docs.aws.amazon.com/aws-certification/latest/examguides/specialty-exams.html
- Associate exams list:
  - https://docs.aws.amazon.com/aws-certification/latest/userguide/associate-exams.html
- Master index:
  - https://docs.aws.amazon.com/aws-certification/latest/examguides/aws-certification-exam-guides.html

Note: AWS periodically updates exams and domains. Re-check official guides before planning an exam date.
