# Chunk Files — Architecture Diagrams

> Enterprise-grade solution architecture & design system diagrams cho toàn bộ hệ thống Chunk Files Platform.
> Tất cả diagrams sử dụng **Mermaid** — render trực tiếp trên GitHub, GitLab, VitePress, và VS Code.

---

## 📑 Diagram Catalog

| # | Diagram | Nội dung | Audience |
|---|---------|----------|----------|
| 01 | [Solution Architecture Overview](./01-solution-architecture-overview.md) | Tổng quan kiến trúc toàn hệ thống, technology stack matrix | Stakeholders, Architects |
| 02 | [C4 Model (Context → Container → Component)](./02-c4-model.md) | System Context, Container, Component diagrams theo C4 Model | Architects, Tech Leads |
| 03 | [Data Flow & Processing Pipeline](./03-data-flow-pipeline.md) | End-to-end data flow, chunking strategy, ES index schema | Backend Engineers |
| 04 | [Infrastructure & Cloud Architecture](./04-infrastructure-architecture.md) | Production AWS (Multi-AZ), Local Docker Compose, Terraform dependency graph | DevOps, SRE |
| 05 | [Observability & Monitoring](./05-observability-architecture.md) | Three pillars (Traces, Logs, Metrics), alert architecture, correlation flow | SRE, DevOps |
| 06 | [CI/CD Pipeline](./06-cicd-pipeline.md) | GitOps workflow, Turborepo build, IaC pipeline, canary deploy | DevOps, Engineering |
| 07 | [Domain Model & Design Patterns](./07-domain-model-patterns.md) | ER diagram, Hexagonal Architecture, state machine, patterns mindmap | Backend Engineers |
| 08 | [Sequence Diagrams — Key Flows](./08-sequence-diagrams.md) | Upload, Lambda processing, Search, MCP interaction, Error handling | All Engineers |
| 09 | [Network & Security Architecture](./09-network-security-architecture.md) | Network topology, defense-in-depth, IAM roles, encryption | Security, DevOps |
| 10 | [Scalability & High Availability](./10-scalability-ha-architecture.md) | Auto-scaling, Multi-AZ failover, DR strategy, performance budgets | Architects, SRE |
| 11 | [Developer Experience & Monorepo](./11-developer-experience.md) | Monorepo structure, Turborepo pipeline, local dev workflow, API design | All Engineers |

---

## 🏗️ Architecture Decision Records

### Kiến trúc chính:
- **Hexagonal Architecture** (Ports & Adapters) — tách biệt domain logic khỏi infrastructure
- **Event-Driven Processing** — SQS decouple upload từ processing
- **Serverless Workers** — Lambda cho xử lý async, scale-to-zero
- **Full Observability** — OpenTelemetry + Grafana Stack cho traces/logs/metrics

### Diagram types sử dụng:
- **C4 Model** — System Context, Container, Component (theo Simon Brown)
- **Flowchart** — Data flows, processing pipelines, decision trees
- **Sequence Diagram** — Request/response flows, error handling
- **State Diagram** — File lifecycle state machine
- **ER Diagram** — Domain entities và relationships
- **Mindmap** — Design patterns overview
- **Architecture Beta** — AWS cloud topology
- **Pie/XY Chart** — Resource distribution, load profiles

---

## 🔧 Cách xem Diagrams

### VS Code
Cài extension **Markdown Preview Mermaid Support** hoặc **Mermaid Editor**.

### GitHub / GitLab
Mermaid được render tự động trong `.md` files.

### VitePress (docs site)
Plugin `mermaid` đã được cấu hình trong `docs/.vitepress/config.mts`.

### Export PNG/SVG
```bash
# Sử dụng mermaid-cli
npx @mermaid-js/mermaid-cli mmdc -i diagram.md -o diagram.png
```
