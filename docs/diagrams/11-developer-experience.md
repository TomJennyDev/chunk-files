# Developer Experience & Monorepo Architecture

## Monorepo Structure — Package Dependency Graph

```mermaid
graph TB
    classDef root fill:#475569,color:#fff,stroke:#334155
    classDef app fill:#2563eb,color:#fff,stroke:#1e40af
    classDef shared fill:#7c3aed,color:#fff,stroke:#5b21b6
    classDef tool fill:#f59e0b,color:#000,stroke:#d97706
    classDef infra fill:#059669,color:#fff,stroke:#047857

    ROOT["chunk-files<br/>(monorepo root)<br/>pnpm + Turborepo"]:::root

    subgraph APPS["apps/"]
        direction TB
        WEB["@chunk-files/web<br/>React + Vite + Mantine<br/>Port: 5173"]:::app
        API["@chunk-files/api<br/>(file-processor)<br/>NestJS + TypeScript<br/>Port: 3000"]:::app
        MCP["@chunk-files/mcp-server<br/>MCP SDK + TypeScript<br/>Transport: stdio"]:::app
        LAMBDA["@chunk-files/lambda<br/>(file-processor-lambda)<br/>Node.js 20.x"]:::app
    end

    subgraph DOCS_PKG["docs/"]
        DOCS["@chunk-files/docs<br/>VitePress<br/>Port: 5174"]:::app
    end

    subgraph INFRASTRUCTURE["infra/"]
        direction TB
        TF["Terraform<br/>IaC definitions"]:::infra
        INIT["Init Scripts<br/>LocalStack setup"]:::infra
        OBS["Observability Config<br/>OTel, Grafana, Loki,<br/>Tempo, Prometheus"]:::infra
    end

    subgraph TOOLS["Tooling"]
        direction LR
        TURBO["Turborepo<br/>Build orchestration<br/>Task caching"]:::tool
        PNPM["pnpm<br/>Package manager<br/>Workspace protocol"]:::tool
        PRETTIER["Prettier<br/>Code formatting"]:::tool
        ESLINT["ESLint<br/>Linting"]:::tool
        TS["TypeScript<br/>Type checking"]:::tool
    end

    ROOT --> APPS & DOCS_PKG & INFRASTRUCTURE
    ROOT --> TURBO & PNPM & PRETTIER

    WEB -->|"HTTP calls"| API
    MCP -->|"HTTP calls"| API
    API -->|"triggers"| LAMBDA
    DOCS -.->|"documents"| API & WEB & MCP & LAMBDA
    TF -.->|"provisions"| API & LAMBDA
```

---

## Turborepo Task Pipeline

```mermaid
flowchart LR
    classDef task fill:#ff1e56,color:#fff
    classDef cache fill:#22c55e,color:#fff
    classDef output fill:#2563eb,color:#fff

    subgraph PIPELINE["turbo.json Pipeline Definition"]
        direction TB
        
        subgraph BUILD_PIPE["build"]
            B_DEP["dependsOn: [^build]<br/>Depends on upstream builds"]:::task
            B_OUT["outputs: [dist/**, build/**]"]:::output
            B_CACHE["cache: true<br/>Inputs hash → cache key"]:::cache
        end

        subgraph DEV_PIPE["dev"]
            D_DEP["dependsOn: [^build]<br/>Build deps first, then watch"]:::task
            D_CACHE["cache: false<br/>Never cache dev mode"]:::task
            D_PERSIST["persistent: true<br/>Long-running process"]:::task
        end

        subgraph LINT_PIPE["lint"]
            L_DEP["dependsOn: []<br/>No dependencies"]:::task
            L_CACHE["cache: true"]:::cache
        end

        subgraph TEST_PIPE["test"]
            T_DEP["dependsOn: [build]<br/>Build first"]:::task
            T_CACHE["cache: true"]:::cache
        end

        subgraph TYPECHECK_PIPE["typecheck"]
            TC_DEP["dependsOn: [^build]"]:::task
            TC_CACHE["cache: true"]:::cache
        end
    end

    subgraph EXECUTION["Parallel Execution"]
        direction TB
        E1["@chunk-files/web → build"]:::output
        E2["@chunk-files/api → build"]:::output
        E3["@chunk-files/mcp-server → build"]:::output
        E4["@chunk-files/docs → build"]:::output
        
        E1 & E2 & E3 & E4 -->|"parallel"| DONE["✅ All builds complete"]
    end
```

---

## Local Development Workflow

```mermaid
flowchart TB
    classDef setup fill:#475569,color:#fff
    classDef run fill:#2563eb,color:#fff
    classDef dev fill:#22c55e,color:#fff
    classDef test fill:#f59e0b,color:#000

    START([Developer starts working]) --> CLONE["git clone + pnpm install"]:::setup
    
    CLONE --> DOCKER_UP["docker compose up -d<br/>Starts:<br/>• LocalStack :4566<br/>• Elasticsearch :9200<br/>• Kibana :5601<br/>• OTel Collector :4317<br/>• Tempo :3200<br/>• Loki :3100<br/>• Prometheus :9090<br/>• Grafana :3001<br/>• Promtail"]:::setup
    
    DOCKER_UP --> WAIT["Wait for health checks<br/>• LocalStack: /_localstack/health<br/>• ES: /_cluster/health<br/>• Kibana: /api/status"]:::setup
    
    WAIT --> INIT["init-aws.sh runs<br/>• Create S3 bucket<br/>• Create SQS queue<br/>• Deploy Lambda function<br/>• Configure event source mapping"]:::setup

    INIT --> DEV_START["Choose development mode"]

    DEV_START --> FULL["pnpm dev<br/>(turbo run dev)<br/>All services watch mode"]:::run
    DEV_START --> SELECTIVE["Selective:<br/>pnpm dev:web<br/>pnpm dev:api<br/>pnpm dev:mcp<br/>pnpm dev:docs"]:::run

    FULL & SELECTIVE --> DEV_WORK["Development cycle"]:::dev

    subgraph DEV_CYCLE["Development Cycle"]
        direction TB
        EDIT["Edit code"]:::dev
        HOT["Hot reload<br/>• Vite HMR (web)<br/>• NestJS watch (api)<br/>• tsc watch (mcp)"]:::dev
        TEST_RUN["Run tests<br/>pnpm test"]:::test
        FORMAT["Format & lint<br/>pnpm format<br/>pnpm lint"]:::test
    end

    DEV_WORK --> EDIT --> HOT --> TEST_RUN --> FORMAT --> EDIT

    subgraph VERIFY["Pre-commit Verification"]
        direction LR
        TYPE_CHECK["pnpm typecheck"]:::test
        LINT_CHECK["pnpm lint"]:::test
        TEST_ALL["pnpm test"]:::test
        BUILD_ALL["pnpm build"]:::test
    end

    FORMAT --> TYPE_CHECK & LINT_CHECK & TEST_ALL & BUILD_ALL
    TYPE_CHECK & LINT_CHECK & TEST_ALL & BUILD_ALL --> COMMIT["git commit + push"]:::setup
```

---

## API Design — REST Endpoints

```mermaid
graph LR
    classDef get fill:#22c55e,color:#fff
    classDef post fill:#2563eb,color:#fff
    classDef status fill:#f59e0b,color:#000

    subgraph ENDPOINTS["REST API Endpoints"]
        direction TB
        
        subgraph FILE_API["File Operations"]
            POST_UPLOAD["POST /files/upload<br/>━━━━━━━━━━━━━━━━<br/>Body: multipart/form-data<br/>Response: 201 {fileId, status}<br/>Errors: 400, 413, 415"]:::post
            
            GET_SEARCH["GET /files/search<br/>━━━━━━━━━━━━━━━━<br/>Query: ?text=&page=&size=<br/>Response: 200 {results, total}<br/>Errors: 400"]:::get
            
            GET_STATUS["GET /files/:id/status<br/>━━━━━━━━━━━━━━━━<br/>Params: fileId<br/>Response: 200 {fileId, status, chunks}<br/>Errors: 404"]:::get
        end

        subgraph HEALTH_API["Health & Monitoring"]
            GET_HEALTH["GET /health<br/>━━━━━━━━━━━━━━━━<br/>Response: 200 {status: ok}<br/>Used by: ALB health check"]:::get
        end

        subgraph FUTURE_API["Future Endpoints"]
            DELETE_FILE["DELETE /files/:id<br/>━━━━━━━━━━━━━━━━<br/>Removes file from S3 + ES"]:::status
            
            GET_STATS["GET /stats<br/>━━━━━━━━━━━━━━━━<br/>System statistics & metrics"]:::status
            
            POST_REPROCESS["POST /files/:id/reprocess<br/>━━━━━━━━━━━━━━━━<br/>Re-trigger Lambda processing"]:::status
        end
    end
```
