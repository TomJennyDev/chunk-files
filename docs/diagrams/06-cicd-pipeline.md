# CI/CD Pipeline Architecture

## GitOps Workflow — Enterprise CI/CD

```mermaid
flowchart TB
    classDef dev fill:#2563eb,color:#fff,stroke:#1e40af
    classDef ci fill:#7c3aed,color:#fff,stroke:#5b21b6
    classDef test fill:#f59e0b,color:#000,stroke:#d97706
    classDef build fill:#db2777,color:#fff,stroke:#9d174d
    classDef deploy fill:#059669,color:#fff,stroke:#047857
    classDef env fill:#475569,color:#fff,stroke:#334155
    classDef gate fill:#dc2626,color:#fff,stroke:#b91c1c

    subgraph DEV["👨‍💻 Development"]
        direction LR
        CODE["Developer<br/>Push Code"]:::dev
        PR["Pull Request<br/>Created"]:::dev
        REVIEW["Code Review<br/>+ Approval"]:::dev
    end

    subgraph CI_PIPELINE["🔄 CI Pipeline (GitHub Actions)"]
        direction TB
        
        subgraph LINT_STAGE["Stage 1: Lint & Format"]
            direction LR
            LINT["ESLint<br/>TypeScript"]:::ci
            FORMAT["Prettier<br/>Format Check"]:::ci
            TYPE["TypeCheck<br/>tsc --noEmit"]:::ci
        end

        subgraph TEST_STAGE["Stage 2: Test"]
            direction LR
            UNIT["Unit Tests<br/>(Jest / Vitest)"]:::test
            INT["Integration Tests<br/>(Testcontainers)"]:::test
            E2E["E2E Tests<br/>(Playwright)"]:::test
            COV["Coverage Report<br/>≥ 80% required"]:::test
        end

        subgraph BUILD_STAGE["Stage 3: Build"]
            direction LR
            BUILD_API["Build API<br/>(NestJS)"]:::build
            BUILD_WEB["Build Web<br/>(Vite)"]:::build
            BUILD_MCP["Build MCP<br/>(TypeScript)"]:::build
            BUILD_LAMBDA["Package Lambda<br/>(zip bundle)"]:::build
            BUILD_DOCS["Build Docs<br/>(VitePress)"]:::build
        end

        subgraph SECURITY_STAGE["Stage 4: Security"]
            direction LR
            SAST["SAST Scan<br/>(SonarQube)"]:::gate
            DEPS["Dependency Audit<br/>(npm audit)"]:::gate
            SECRET["Secret Scan<br/>(gitleaks)"]:::gate
            CONTAINER["Container Scan<br/>(Trivy)"]:::gate
        end

        subgraph ARTIFACT_STAGE["Stage 5: Artifacts"]
            direction LR
            DOCKER_IMG["Docker Image<br/>→ ECR"]:::build
            LAMBDA_ZIP["Lambda Bundle<br/>→ S3"]:::build
            WEB_ASSETS["Web Assets<br/>→ S3 + CloudFront"]:::build
        end
    end

    subgraph CD_PIPELINE["🚀 CD Pipeline"]
        direction TB
        
        subgraph DEV_ENV["Development"]
            DEV_DEPLOY["Deploy to Dev<br/>(Auto on main merge)"]:::deploy
            DEV_SMOKE["Smoke Tests"]:::test
        end

        subgraph STAGING_ENV["Staging"]
            STAGE_GATE["Manual Gate<br/>QA Approval"]:::gate
            STAGE_DEPLOY["Deploy to Staging<br/>(Blue/Green)"]:::deploy
            STAGE_PERF["Performance Tests<br/>(k6 load test)"]:::test
            STAGE_CHAOS["Chaos Testing<br/>(Chaos Monkey)"]:::test
        end

        subgraph PROD_ENV["Production"]
            PROD_GATE["Manual Gate<br/>Release Manager"]:::gate
            PROD_DEPLOY["Deploy to Production<br/>(Canary 10% → 50% → 100%)"]:::deploy
            PROD_MONITOR["Health Monitor<br/>(Auto-rollback if error > 1%)"]:::deploy
        end
    end

    CODE --> PR --> REVIEW
    REVIEW -->|"Approved"| LINT_STAGE
    LINT_STAGE --> TEST_STAGE --> BUILD_STAGE --> SECURITY_STAGE --> ARTIFACT_STAGE
    
    ARTIFACT_STAGE --> DEV_DEPLOY --> DEV_SMOKE
    DEV_SMOKE -->|"✅ Pass"| STAGE_GATE
    STAGE_GATE -->|"Approved"| STAGE_DEPLOY --> STAGE_PERF & STAGE_CHAOS
    STAGE_PERF & STAGE_CHAOS -->|"✅ Pass"| PROD_GATE
    PROD_GATE -->|"Approved"| PROD_DEPLOY --> PROD_MONITOR
```

---

## Monorepo Build Pipeline (Turborepo)

```mermaid
flowchart LR
    classDef turbo fill:#ff1e56,color:#fff
    classDef pkg fill:#2563eb,color:#fff
    classDef output fill:#059669,color:#fff

    TURBO["turbo run build<br/>Parallel execution<br/>with dependency graph"]:::turbo

    subgraph PACKAGES["Monorepo Packages"]
        direction TB
        PKG_API["@chunk-files/api<br/>(NestJS)"]:::pkg
        PKG_WEB["@chunk-files/web<br/>(React + Vite)"]:::pkg
        PKG_MCP["@chunk-files/mcp-server<br/>(TypeScript)"]:::pkg
        PKG_LAMBDA["@chunk-files/lambda<br/>(Node.js)"]:::pkg
        PKG_DOCS["@chunk-files/docs<br/>(VitePress)"]:::pkg
    end

    subgraph OUTPUTS["Build Outputs"]
        direction TB
        OUT_API["apps/file-processor/dist/"]:::output
        OUT_WEB["apps/web/dist/"]:::output
        OUT_MCP["apps/mcp-server/dist/"]:::output
        OUT_LAMBDA["lambda-function.zip"]:::output
        OUT_DOCS["docs/.vitepress/dist/"]:::output
    end

    TURBO --> PKG_API & PKG_WEB & PKG_MCP & PKG_LAMBDA & PKG_DOCS
    PKG_API --> OUT_API
    PKG_WEB --> OUT_WEB
    PKG_MCP --> OUT_MCP
    PKG_LAMBDA --> OUT_LAMBDA
    PKG_DOCS --> OUT_DOCS

    subgraph CACHE["Turborepo Cache"]
        LOCAL["Local Cache<br/>.turbo/"]:::turbo
        REMOTE["Remote Cache<br/>(Vercel / Self-hosted)"]:::turbo
    end

    TURBO -.->|"cache hit"| LOCAL
    LOCAL -.->|"miss → fetch"| REMOTE
```

---

## Infrastructure as Code Pipeline

```mermaid
flowchart TB
    classDef plan fill:#f59e0b,color:#000
    classDef apply fill:#059669,color:#fff
    classDef gate fill:#dc2626,color:#fff
    classDef state fill:#6366f1,color:#fff

    subgraph TF_PIPELINE["Terraform Pipeline"]
        direction TB
        
        CHANGE["Infrastructure<br/>Code Change"]
        
        subgraph PLAN_STAGE["Plan Stage"]
            INIT["terraform init<br/>Download providers"]:::plan
            VALIDATE["terraform validate<br/>Syntax check"]:::plan
            PLAN["terraform plan<br/>-out=tfplan"]:::plan
            COST["Infracost<br/>Cost estimation"]:::plan
        end

        APPROVAL["👤 Manual Approval<br/>Review plan output<br/>& cost delta"]:::gate

        subgraph APPLY_STAGE["Apply Stage"]
            APPLY["terraform apply<br/>tfplan"]:::apply
            OUTPUT["terraform output<br/>Export endpoints"]:::apply
            TEST_INFRA["Infra Smoke Test<br/>Verify resources"]:::apply
        end

        subgraph STATE_MGMT["State Management"]
            BACKEND["S3 Backend<br/>State file storage"]:::state
            LOCK["DynamoDB Lock<br/>Prevent concurrent apply"]:::state
            HISTORY["State History<br/>Version control"]:::state
        end
    end

    CHANGE --> INIT --> VALIDATE --> PLAN --> COST
    COST --> APPROVAL
    APPROVAL -->|"Approved"| APPLY --> OUTPUT --> TEST_INFRA
    APPLY -.-> BACKEND & LOCK
    BACKEND -.-> HISTORY
```

---

## Release Strategy — Canary Deployment

```mermaid
sequenceDiagram
    participant RM as Release Manager
    participant CI as CI/CD Pipeline
    participant LB as Load Balancer
    participant V1 as Current (v1.0)
    participant V2 as Canary (v1.1)
    participant MON as Monitoring

    RM->>CI: Approve production release v1.1
    CI->>V2: Deploy canary (1 instance)
    CI->>LB: Route 10% traffic → v1.1

    Note over LB,V2: Phase 1: Canary 10%<br/>(15 min observation)

    LB->>V1: 90% traffic
    LB->>V2: 10% traffic
    V2->>MON: Metrics + Traces
    
    MON->>MON: Check: error_rate < 1%?<br/>Check: p99_latency < 2s?

    alt Metrics OK
        CI->>LB: Route 50% traffic → v1.1
        Note over LB,V2: Phase 2: Canary 50%<br/>(15 min observation)
        
        MON->>MON: Verify metrics stable
        
        CI->>LB: Route 100% traffic → v1.1
        Note over LB,V2: Phase 3: Full rollout
        
        CI->>V1: Drain & terminate old instances
        CI->>RM: ✅ Release v1.1 complete
    else Metrics BAD
        CI->>LB: Route 100% back → v1.0
        CI->>V2: Terminate canary
        CI->>RM: ❌ Rollback — Alert team
    end
```
