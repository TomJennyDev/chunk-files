# Chunk Files

AI-powered file processing & search monorepo — built with **Turborepo** + **pnpm workspaces**.

## 📁 Project Structure

```
chunk-files/
├── apps/                           # Application packages
│   ├── file-processor/             # @chunk-files/api — NestJS backend API
│   ├── file-processor-lambda/      # @chunk-files/file-processor-lambda — AWS Lambda
│   ├── mcp-server/                 # @chunk-files/mcp-server — MCP Server for AI
│   └── web/                        # @chunk-files/web — React/Vite frontend
├── packages/                       # Shared libraries (future)
├── docs/                           # @chunk-files/docs — VitePress documentation
├── infra/                          # Infrastructure & DevOps
│   ├── init-aws.sh                 # LocalStack init script
│   ├── init-scripts/               # Modular AWS resource setup
│   └── terraform/                  # Terraform IaC for LocalStack
├── docker-compose.yml              # LocalStack + Elasticsearch + Kibana
├── turbo.json                      # Turborepo task pipeline
├── pnpm-workspace.yaml             # pnpm workspace config
└── package.json                    # Root scripts & devDependencies
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 20
- **pnpm** >= 9
- **Docker** (for LocalStack)

### Install & Build
```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Start all dev servers
pnpm dev
```

### Run individual apps
```bash
pnpm dev:web        # React frontend (Vite)
pnpm dev:api        # NestJS backend API
pnpm dev:docs       # VitePress documentation
pnpm dev:mcp        # MCP Server
```

### Infrastructure
```bash
# Start LocalStack + Elasticsearch + Kibana
pnpm docker:up

# Stop
pnpm docker:down
```

### Other commands
```bash
pnpm lint           # Lint all packages
pnpm typecheck      # Type-check all packages
pnpm test           # Run all tests
pnpm format         # Format with Prettier
pnpm clean          # Clean all build outputs
```

## 📦 Packages

| Package | Name | Description |
|---------|------|-------------|
| [apps/file-processor](apps/file-processor) | `@chunk-files/api` | NestJS API — file upload, S3, SQS, Elasticsearch |
| [apps/web](apps/web) | `@chunk-files/web` | React + Mantine UI frontend |
| [apps/mcp-server](apps/mcp-server) | `@chunk-files/mcp-server` | MCP Server for AI-powered interactions |
| [apps/file-processor-lambda](apps/file-processor-lambda) | `@chunk-files/file-processor-lambda` | AWS Lambda for async file processing |
| [docs](docs) | `@chunk-files/docs` | VitePress project documentation |

## 🐳 LocalStack (Infrastructure)

```bash
# Start LocalStack + Elasticsearch + Kibana
pnpm docker:up

# Check health
curl http://localhost:4566/_localstack/health | jq

# Stop
pnpm docker:down
```

Services available: **S3**, **SQS**, **OpenSearch**, **KMS**, **IAM**, **Lambda**, **CloudWatch Logs**

LocalStack data is persisted in `localstack-data/` via [localstack-persist](https://github.com/GREsau/localstack-persist).

## 🔧 Terraform

```bash
cd infra/terraform/file-processor
terraform init
terraform plan
terraform apply
```

## 📚 Resources

- [Detailed docs](docs/) — Architecture, Elasticsearch, Lambda guides
- [API Architecture](apps/file-processor/ARCHITECTURE-FLOW.md)
- [MCP Server Setup](apps/mcp-server/VSCODE-SETUP.md)
