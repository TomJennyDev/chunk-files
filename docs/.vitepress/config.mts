import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

// https://vitepress.dev/reference/site-config
export default withMermaid({
  title: "File Processing System Docs",
  description:
    "Complete documentation for file processing system with LocalStack and Elasticsearch",

  // Ignore localhost links (runtime URLs, not doc links)
  ignoreDeadLinks: [/^https?:\/\/localhost/],

  mermaid: {
    // Mermaid config
  },

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Home", link: "/" },
      { text: "Quick Start", link: "/QUICKSTART" },
      { text: "Workflow", link: "/application/WORKFLOW" },
      { text: "Architecture", link: "/application/ARCHITECTURE" },
      {
        text: "Guides",
        items: [
          { text: "Kibana Guide", link: "/application/KIBANA-GUIDE" },
          {
            text: "AWS Cloud Architecture",
            link: "/application/AWS-CLOUD-ARCHITECTURE",
          },
          {
            text: "Chunking Strategies",
            link: "/application/CHUNKING-STRATEGIES",
          },
          {
            text: "Chunking Detail",
            link: "/elasticsearch/CHUNKING-STRATEGIES-DETAIL",
          },
          {
            text: "Search Implementation",
            link: "/elasticsearch/SEARCH-IMPLEMENTATION",
          },
        ],
      },
      {
        text: "Elasticsearch",
        items: [
          { text: "Overview", link: "/elasticsearch/README" },
          { text: "Concepts Index", link: "/elasticsearch/CONCEPTS-INDEX" },
          { text: "Core Concepts", link: "/elasticsearch/CONCEPTS" },
          { text: "Architecture", link: "/elasticsearch/ARCHITECTURE" },
          {
            text: "Enterprise Use Cases",
            link: "/elasticsearch/ENTERPRISE-USE-CASES",
          },
          { text: "Optimization", link: "/elasticsearch/OPTIMIZATION" },
        ],
      },
      {
        text: "AWS Lambda",
        items: [
          { text: "Complete Guide", link: "/lamda/LAMBDA-COMPLETE-GUIDE" },
          { text: "Flow Sequence", link: "/application/LAMBDA-FLOW-SEQUENCE" },
          { text: "Layer Setup", link: "/application/LAMBDA-LAYER-SETUP" },
          {
            text: "Deployment & CI/CD",
            link: "/lamda/LAMBDA-DEPLOYMENT-GUIDE",
          },
          { text: "Cache Mechanism", link: "/lamda/LAMBDA-CACHE-MECHANISM" },
          { text: "Cache Layers", link: "/lamda/LAMBDA-CACHE-LAYERS" },
          { text: "Caching Guide", link: "/lamda/LAMBDA-CACHING-GUIDE" },
          {
            text: "LocalStack Limitations",
            link: "/lamda/LOCALSTACK-LAMBDA-LIMITATIONS",
          },
        ],
      },
      {
        text: "Markdown AI",
        items: [
          { text: "Overview", link: "/application/README-MARKDOWN-AI" },
          { text: "OpenSearch Setup", link: "/application/OPENSEARCH-SETUP" },
        ],
      },
      {
        text: "Observability",
        items: [
          { text: "Overview", link: "/observability/README" },
          {
            text: "OpenTelemetry Concepts",
            link: "/observability/OTEL-CONCEPTS",
          },
          { text: "Grafana Stack", link: "/observability/GRAFANA-STACK" },
          { text: "Logging Pipeline", link: "/observability/LOGGING-PIPELINE" },
          { text: "Tracing Workflow", link: "/observability/TRACING-WORKFLOW" },
          {
            text: "Config Reference",
            link: "/observability/CONFIGS-EXPLAINED",
          },
        ],
      },
      {
        text: "Modules",
        items: [
          { text: "Overview", link: "/modules/README" },
          { text: "API Service", link: "/modules/API" },
          { text: "API Reference", link: "/modules/API-REFERENCE" },
          { text: "Web Frontend", link: "/modules/WEB" },
          { text: "MCP Server", link: "/modules/MCP-SERVER" },
          { text: "Infrastructure", link: "/modules/INFRASTRUCTURE" },
        ],
      },
      {
        text: "Diagrams",
        items: [
          { text: "Overview", link: "/diagrams/README" },
          {
            text: "Solution Architecture",
            link: "/diagrams/01-solution-architecture-overview",
          },
          { text: "C4 Model", link: "/diagrams/02-c4-model" },
          {
            text: "Data Flow Pipeline",
            link: "/diagrams/03-data-flow-pipeline",
          },
          {
            text: "Infrastructure",
            link: "/diagrams/04-infrastructure-architecture",
          },
          {
            text: "Observability",
            link: "/diagrams/05-observability-architecture",
          },
          { text: "CI/CD Pipeline", link: "/diagrams/06-cicd-pipeline" },
          { text: "Domain Model", link: "/diagrams/07-domain-model-patterns" },
          { text: "Sequence Diagrams", link: "/diagrams/08-sequence-diagrams" },
          {
            text: "Network & Security",
            link: "/diagrams/09-network-security-architecture",
          },
          {
            text: "Scalability & HA",
            link: "/diagrams/10-scalability-ha-architecture",
          },
          {
            text: "Developer Experience",
            link: "/diagrams/11-developer-experience",
          },
        ],
      },
      {
        text: "🐳 Docker",
        items: [
          { text: "Learning Roadmap", link: "/docker/README" },
          {
            text: "Container Fundamentals",
            link: "/docker/CONTAINER-FUNDAMENTALS",
          },
          {
            text: "Cgroups & Namespaces",
            link: "/docker/CGROUPS-AND-NAMESPACES",
          },
          {
            text: "Dockerfile Best Practices",
            link: "/docker/DOCKERFILE-BEST-PRACTICES",
          },
          { text: "Image Architecture", link: "/docker/IMAGE-ARCHITECTURE" },
          {
            text: "Networking Deep Dive",
            link: "/docker/NETWORKING-DEEP-DIVE",
          },
          { text: "Storage & Volumes", link: "/docker/STORAGE-AND-VOLUMES" },
          { text: "Security Hardening", link: "/docker/SECURITY-HARDENING" },
          {
            text: "Compose Fundamentals",
            link: "/docker/COMPOSE-FUNDAMENTALS",
          },
          {
            text: "Compose Advanced",
            link: "/docker/COMPOSE-ADVANCED-PATTERNS",
          },
          { text: "Troubleshooting", link: "/docker/TROUBLESHOOTING" },
        ],
      },
      {
        text: "🎓 Senior Architect",
        items: [
          { text: "Roadmap & Overview", link: "/senior-architect/README" },
          {
            text: "System Design Fundamentals",
            link: "/senior-architect/SYSTEM-DESIGN-BASICS",
          },
          {
            text: "Scale From 0 to Millions",
            link: "/senior-architect/SCALE-FROM-ZERO-TO-MILLIONS",
          },
          {
            text: "Architecture: Micro vs Monolith",
            link: "/senior-architect/MICROSERVICES-VS-MONOLITH",
          },
          {
            text: "Communication: Event-Driven",
            link: "/senior-architect/EVENT-DRIVEN-ARCHITECTURE",
          },
          {
            text: "Governance: Distributed Data",
            link: "/senior-architect/DISTRIBUTED-TRANSACTIONS-SAGA",
          },
          {
            text: "Governance: Scaling Database",
            link: "/senior-architect/DATABASE-SCALING",
          },
          {
            text: "Reliability: Resiliency",
            link: "/senior-architect/RESILIENCY-PATTERNS",
          },
          {
            text: "Security & Identity",
            link: "/senior-architect/SECURITY-AND-IDENTITY",
          },
          {
            text: "Tech Leadership: ADRs",
            link: "/senior-architect/ARCHITECTURE-DECISION-RECORDS",
          },
          {
            text: "☁️ AWS Solutions (Mermaid)",
            items: [
              {
                text: "AWS: Million Scaling",
                link: "/senior-architect/aws-solutions/AWS-SCALE-TO-MILLIONS",
              },
              {
                text: "AWS: Event-Driven",
                link: "/senior-architect/aws-solutions/AWS-EVENT-DRIVEN",
              },
              {
                text: "AWS: Saga Transactions",
                link: "/senior-architect/aws-solutions/AWS-DISTRIBUTED-TRANSACTIONS",
              },
              {
                text: "AWS: Database Scaling",
                link: "/senior-architect/aws-solutions/AWS-DATABASE-SCALING",
              },
              {
                text: "AWS: Resiliency",
                link: "/senior-architect/aws-solutions/AWS-RESILIENCY",
              },
            ],
          },
        ],
      },
    ],

    sidebar: {
      "/": [
        {
          text: "🚀 Getting Started",
          items: [
            { text: "Documentation Index", link: "/README" },
            { text: "Quick Start", link: "/QUICKSTART" },
            { text: "Complete Workflow", link: "/application/WORKFLOW" },
            { text: "System Architecture", link: "/application/ARCHITECTURE" },
          ],
        },
        {
          text: "📚 Guides",
          items: [
            {
              text: "Deployment Checklist",
              link: "/application/DEPLOYMENT-CHECKLIST",
            },
            { text: "Kibana User Guide", link: "/application/KIBANA-GUIDE" },
            {
              text: "AWS Cloud Architecture",
              link: "/application/AWS-CLOUD-ARCHITECTURE",
            },
            {
              text: "Chunking Strategies",
              link: "/application/CHUNKING-STRATEGIES",
            },
            {
              text: "Chunking Detail Implementation",
              link: "/elasticsearch/CHUNKING-STRATEGIES-DETAIL",
            },
            {
              text: "Search Implementation Guide",
              link: "/elasticsearch/SEARCH-IMPLEMENTATION",
            },
          ],
        },
        {
          text: "⚡ Lambda & AI",
          collapsed: false,
          items: [
            {
              text: "🔄 Lambda Flow Sequence",
              link: "/application/LAMBDA-FLOW-SEQUENCE",
            },
            {
              text: "📦 Lambda Layer Setup",
              link: "/application/LAMBDA-LAYER-SETUP",
            },
            {
              text: "🧠 Markdown AI Processing",
              link: "/application/README-MARKDOWN-AI",
            },
            {
              text: "🔍 OpenSearch Setup",
              link: "/application/OPENSEARCH-SETUP",
            },
          ],
        },
        {
          text: "📡 Observability",
          collapsed: false,
          items: [
            {
              text: "🔭 Overview",
              link: "/observability/README",
            },
            {
              text: "🔗 OpenTelemetry Concepts",
              link: "/observability/OTEL-CONCEPTS",
            },
            {
              text: "📊 Grafana Stack",
              link: "/observability/GRAFANA-STACK",
            },
            {
              text: "📝 Logging Pipeline",
              link: "/observability/LOGGING-PIPELINE",
            },
            {
              text: "🔍 Tracing Workflow",
              link: "/observability/TRACING-WORKFLOW",
            },
            {
              text: "⚙️ Config Reference",
              link: "/observability/CONFIGS-EXPLAINED",
            },
          ],
        },
        {
          text: "Modules",
          collapsed: false,
          items: [
            { text: "Overview", link: "/modules/README" },
            { text: "API Service", link: "/modules/API" },
            { text: "API Reference", link: "/modules/API-REFERENCE" },
            { text: "Web Frontend", link: "/modules/WEB" },
            { text: "MCP Server", link: "/modules/MCP-SERVER" },
            { text: "Infrastructure", link: "/modules/INFRASTRUCTURE" },
          ],
        },
        {
          text: "📐 Architecture Diagrams",
          collapsed: false,
          items: [
            { text: "Diagram Catalog", link: "/diagrams/README" },
            {
              text: "Solution Architecture",
              link: "/diagrams/01-solution-architecture-overview",
            },
            { text: "C4 Model", link: "/diagrams/02-c4-model" },
            {
              text: "Data Flow Pipeline",
              link: "/diagrams/03-data-flow-pipeline",
            },
            {
              text: "Infrastructure",
              link: "/diagrams/04-infrastructure-architecture",
            },
            {
              text: "Observability",
              link: "/diagrams/05-observability-architecture",
            },
            { text: "CI/CD Pipeline", link: "/diagrams/06-cicd-pipeline" },
          ],
        },
        {
          text: "🐳 Docker & Docker Compose",
          collapsed: false,
          items: [
            { text: "Learning Roadmap", link: "/docker/README" },
            {
              text: "Container Fundamentals",
              link: "/docker/CONTAINER-FUNDAMENTALS",
            },
            {
              text: "Cgroups & Namespaces",
              link: "/docker/CGROUPS-AND-NAMESPACES",
            },
            {
              text: "Dockerfile Best Practices",
              link: "/docker/DOCKERFILE-BEST-PRACTICES",
            },
            {
              text: "Compose Fundamentals",
              link: "/docker/COMPOSE-FUNDAMENTALS",
            },
            { text: "Troubleshooting", link: "/docker/TROUBLESHOOTING" },
          ],
        },
        {
          text: "🎓 Senior Architect Roadmap",
          collapsed: false,
          items: [
            { text: "Roadmap Overview", link: "/senior-architect/README" },
            {
              text: "System Design Basics",
              link: "/senior-architect/SYSTEM-DESIGN-BASICS",
            },
            {
              text: "Scale From 0 to Millions",
              link: "/senior-architect/SCALE-FROM-ZERO-TO-MILLIONS",
            },
            {
              text: "Architecture Analysis",
              link: "/senior-architect/MICROSERVICES-VS-MONOLITH",
            },
            {
              text: "Event-Driven & Messaging",
              link: "/senior-architect/EVENT-DRIVEN-ARCHITECTURE",
            },
            {
              text: "Distributed Data",
              link: "/senior-architect/DISTRIBUTED-TRANSACTIONS-SAGA",
            },
          ],
        },
        {
          text: "☁️ AWS Solutions (Real-world)",
          collapsed: false,
          items: [
            {
              text: "AWS Architecture Suite",
              link: "/senior-architect/aws-solutions/README",
            },
            {
              text: "AWS: Scale to Millions",
              link: "/senior-architect/aws-solutions/AWS-SCALE-TO-MILLIONS",
            },
            {
              text: "AWS: Pub/Sub Arch",
              link: "/senior-architect/aws-solutions/AWS-EVENT-DRIVEN",
            },
            {
              text: "AWS: Saga Distributed",
              link: "/senior-architect/aws-solutions/AWS-DISTRIBUTED-TRANSACTIONS",
            },
            {
              text: "AWS: DB Scaling",
              link: "/senior-architect/aws-solutions/AWS-DATABASE-SCALING",
            },
            {
              text: "AWS: High Availability",
              link: "/senior-architect/aws-solutions/AWS-RESILIENCY",
            },
          ],
        },
      ],
      "/diagrams/": [
        {
          text: "📐 Architecture Diagrams",
          items: [
            { text: "Diagram Catalog", link: "/diagrams/README" },
            {
              text: "Solution Architecture",
              link: "/diagrams/01-solution-architecture-overview",
            },
            { text: "C4 Model", link: "/diagrams/02-c4-model" },
            {
              text: "Data Flow Pipeline",
              link: "/diagrams/03-data-flow-pipeline",
            },
            {
              text: "Infrastructure",
              link: "/diagrams/04-infrastructure-architecture",
            },
            {
              text: "Observability",
              link: "/diagrams/05-observability-architecture",
            },
            { text: "CI/CD Pipeline", link: "/diagrams/06-cicd-pipeline" },
          ],
        },
        {
          text: "🏗️ Design & Operations",
          collapsed: false,
          items: [
            {
              text: "Domain Model & Patterns",
              link: "/diagrams/07-domain-model-patterns",
            },
            {
              text: "Sequence Diagrams",
              link: "/diagrams/08-sequence-diagrams",
            },
            {
              text: "Network & Security",
              link: "/diagrams/09-network-security-architecture",
            },
            {
              text: "Scalability & HA",
              link: "/diagrams/10-scalability-ha-architecture",
            },
            {
              text: "Developer Experience",
              link: "/diagrams/11-developer-experience",
            },
          ],
        },
        {
          text: "🔙 Back to Main Docs",
          items: [{ text: "← Documentation Index", link: "/README" }],
        },
      ],
      "/application/": [
        {
          text: "⚡ Lambda Processing",
          items: [
            {
              text: "🔄 Lambda Flow Sequence",
              link: "/application/LAMBDA-FLOW-SEQUENCE",
            },
            {
              text: "📦 Lambda Layer Setup",
              link: "/application/LAMBDA-LAYER-SETUP",
            },
            { text: "🔧 Architecture", link: "/application/ARCHITECTURE" },
            {
              text: "☁️ AWS Cloud Architecture",
              link: "/application/AWS-CLOUD-ARCHITECTURE",
            },
            { text: "📋 Workflow", link: "/application/WORKFLOW" },
          ],
        },
        {
          text: "🧠 Markdown AI & Search",
          items: [
            {
              text: "📄 Markdown AI Overview",
              link: "/application/README-MARKDOWN-AI",
            },
            {
              text: "✂️ Chunking Strategies",
              link: "/application/CHUNKING-STRATEGIES",
            },
            {
              text: "🔍 OpenSearch Setup",
              link: "/application/OPENSEARCH-SETUP",
            },
          ],
        },
        {
          text: "📊 Monitoring",
          items: [
            { text: "📈 Kibana Guide", link: "/application/KIBANA-GUIDE" },
            { text: "🔍 Kibana Queries", link: "/application/kibana-queries" },
          ],
        },
        {
          text: "🔙 Back to Main Docs",
          items: [{ text: "← Documentation Index", link: "/README" }],
        },
      ],
      "/elasticsearch/": [
        {
          text: "📖 Elasticsearch Learning",
          items: [
            { text: "Overview & Learning Path", link: "/elasticsearch/README" },
            { text: "Concepts Index", link: "/elasticsearch/CONCEPTS-INDEX" },
            { text: "Core Concepts", link: "/elasticsearch/CONCEPTS" },
            {
              text: "Cluster Architecture",
              link: "/elasticsearch/ARCHITECTURE",
            },
            {
              text: "Enterprise Use Cases",
              link: "/elasticsearch/ENTERPRISE-USE-CASES",
            },
            {
              text: "Optimization Strategies",
              link: "/elasticsearch/OPTIMIZATION",
            },
          ],
        },
        {
          text: "🎯 Core Concepts - Deep Dive",
          collapsed: false,
          items: [
            { text: "📄 Documents", link: "/elasticsearch/DOCUMENTS" },
            { text: "📚 Indices", link: "/elasticsearch/INDICES" },
            { text: "🔪 Shards", link: "/elasticsearch/SHARDS" },
            { text: "🔄 Replicas", link: "/elasticsearch/REPLICAS" },
            { text: "🗺️ Mapping", link: "/elasticsearch/MAPPING" },
            { text: "🔍 Analyzers", link: "/elasticsearch/ANALYZERS" },
            { text: "📊 Data Types", link: "/elasticsearch/DATA-TYPES" },
            {
              text: "🌐 Clusters & Nodes",
              link: "/elasticsearch/CLUSTERS-NODES",
            },
            {
              text: "⭐ Relevance Scoring",
              link: "/elasticsearch/RELEVANCE-SCORING",
            },
          ],
        },
        {
          text: "🔙 Back to Main Docs",
          items: [{ text: "← Documentation Index", link: "/README" }],
        },
      ],
      "/observability/": [
        {
          text: "📡 Observability",
          items: [
            { text: "Overview", link: "/observability/README" },
            {
              text: "OpenTelemetry Concepts",
              link: "/observability/OTEL-CONCEPTS",
            },
            {
              text: "Grafana Stack",
              link: "/observability/GRAFANA-STACK",
            },
            {
              text: "Logging Pipeline",
              link: "/observability/LOGGING-PIPELINE",
            },
            {
              text: "Tracing Workflow",
              link: "/observability/TRACING-WORKFLOW",
            },
            {
              text: "⚙️ Config Reference",
              link: "/observability/CONFIGS-EXPLAINED",
            },
          ],
        },
        {
          text: "🔭 Deep Dive",
          collapsed: false,
          items: [
            {
              text: "🔵 Traces & Spans",
              link: "/observability/OTEL-CONCEPTS#traces-spans",
            },
            {
              text: "🟡 Metrics Types",
              link: "/observability/GRAFANA-STACK#prometheus-metrics-collection",
            },
            {
              text: "🟢 Log Correlation",
              link: "/observability/LOGGING-PIPELINE#trace-log-correlation",
            },
            {
              text: "☁️ LocalStack Flow",
              link: "/observability/TRACING-WORKFLOW#flow-1-file-upload",
            },
          ],
        },
        {
          text: "🔙 Back to Main Docs",
          items: [{ text: "← Documentation Index", link: "/README" }],
        },
      ],
      "/lambda/": [
        {
          text: "⚡ AWS Lambda",
          items: [
            {
              text: "Complete Certification Guide",
              link: "/lamda/LAMBDA-COMPLETE-GUIDE",
            },
            {
              text: "Deployment & CI/CD Guide",
              link: "/lamda/LAMBDA-DEPLOYMENT-GUIDE",
            },
            { text: "Cache Mechanism", link: "/lamda/LAMBDA-CACHE-MECHANISM" },
            {
              text: "Cache Layers Deep Dive",
              link: "/lamda/LAMBDA-CACHE-LAYERS",
            },
            {
              text: "Caching Implementation",
              link: "/lamda/LAMBDA-CACHING-GUIDE",
            },
            {
              text: "LocalStack Limitations",
              link: "/lamda/LOCALSTACK-LAMBDA-LIMITATIONS",
            },
          ],
        },
        {
          text: "📚 Topics",
          collapsed: false,
          items: [
            {
              text: "🎓 Certification Guide",
              link: "/lamda/LAMBDA-COMPLETE-GUIDE#certification-exam-topics",
            },
            {
              text: "🚀 Deployment & CI/CD",
              link: "/lamda/LAMBDA-DEPLOYMENT-GUIDE",
            },
            {
              text: "🏗️ Architecture Patterns",
              link: "/lamda/LAMBDA-COMPLETE-GUIDE#common-architecture-patterns",
            },
            {
              text: "🔧 Troubleshooting",
              link: "/lamda/LAMBDA-COMPLETE-GUIDE#troubleshooting",
            },
            {
              text: "⚖️ Pros & Cons",
              link: "/lamda/LAMBDA-COMPLETE-GUIDE#pros--cons",
            },
            {
              text: "⚠️ Limitations",
              link: "/lamda/LAMBDA-COMPLETE-GUIDE#limitations--pain-points",
            },
          ],
        },
        {
          text: "💾 Caching",
          collapsed: false,
          items: [
            {
              text: "🔄 Cache Mechanism",
              link: "/lamda/LAMBDA-CACHE-MECHANISM",
            },
            { text: "📊 4 Cache Layers", link: "/lamda/LAMBDA-CACHE-LAYERS" },
            {
              text: "📖 Implementation Guide",
              link: "/lamda/LAMBDA-CACHING-GUIDE",
            },
            {
              text: "⚠️ LocalStack Issues",
              link: "/lamda/LOCALSTACK-LAMBDA-LIMITATIONS",
            },
          ],
        },
        {
          text: "🔙 Back to Main Docs",
          items: [{ text: "← Documentation Index", link: "/README" }],
        },
      ],
      "/modules/": [
        {
          text: "Module Documentation",
          items: [
            { text: "Overview", link: "/modules/README" },
            { text: "API Service", link: "/modules/API" },
            { text: "API Reference", link: "/modules/API-REFERENCE" },
            { text: "Web Frontend", link: "/modules/WEB" },
            { text: "MCP Server", link: "/modules/MCP-SERVER" },
            { text: "Infrastructure", link: "/modules/INFRASTRUCTURE" },
          ],
        },
        {
          text: "Back to Main Docs",
          items: [{ text: "Documentation Index", link: "/README" }],
        },
      ],
      "/docker/": [
        {
          text: "🐳 Docker Deep Dive",
          items: [
            { text: "Learning Roadmap", link: "/docker/README" },
            {
              text: "Container Fundamentals",
              link: "/docker/CONTAINER-FUNDAMENTALS",
            },
            {
              text: "Cgroups & Namespaces",
              link: "/docker/CGROUPS-AND-NAMESPACES",
            },
            {
              text: "Dockerfile Best Practices",
              link: "/docker/DOCKERFILE-BEST-PRACTICES",
            },
            { text: "Image Architecture", link: "/docker/IMAGE-ARCHITECTURE" },
            {
              text: "Networking Deep Dive",
              link: "/docker/NETWORKING-DEEP-DIVE",
            },
            { text: "Storage & Volumes", link: "/docker/STORAGE-AND-VOLUMES" },
            { text: "Security Hardening", link: "/docker/SECURITY-HARDENING" },
            {
              text: "Performance Optimization",
              link: "/docker/PERFORMANCE-OPTIMIZATION",
            },
          ],
        },
        {
          text: "🎼 Docker Compose",
          collapsed: false,
          items: [
            {
              text: "Compose Fundamentals",
              link: "/docker/COMPOSE-FUNDAMENTALS",
            },
            {
              text: "Advanced Patterns",
              link: "/docker/COMPOSE-ADVANCED-PATTERNS",
            },
            { text: "Compose Networking", link: "/docker/COMPOSE-NETWORKING" },
            {
              text: "Production Deployment",
              link: "/docker/COMPOSE-PRODUCTION",
            },
          ],
        },
        {
          text: "🚀 DevOps Integration",
          collapsed: false,
          items: [
            { text: "CI/CD with Docker", link: "/docker/CI-CD-DOCKER" },
            { text: "Troubleshooting", link: "/docker/TROUBLESHOOTING" },
          ],
        },
        {
          text: "🔙 Back to Main Docs",
          items: [{ text: "← Documentation Index", link: "/README" }],
        },
      ],
      "/senior-architect/": [
        {
          text: "🎓 Senior Architect",
          items: [
            { text: "Roadmap Overview", link: "/senior-architect/README" },
            {
              text: "System Design Fundamentals",
              link: "/senior-architect/SYSTEM-DESIGN-BASICS",
            },
            {
              text: "Scale From 0 to Millions",
              link: "/senior-architect/SCALE-FROM-ZERO-TO-MILLIONS",
            },
            {
              text: "Microservices vs Monolith",
              link: "/senior-architect/MICROSERVICES-VS-MONOLITH",
            },
            {
              text: "Event-Driven Architecture",
              link: "/senior-architect/EVENT-DRIVEN-ARCHITECTURE",
            },
            {
              text: "Distributed Transactions",
              link: "/senior-architect/DISTRIBUTED-TRANSACTIONS-SAGA",
            },
            {
              text: "Database Scaling",
              link: "/senior-architect/DATABASE-SCALING",
            },
            {
              text: "Resiliency Patterns",
              link: "/senior-architect/RESILIENCY-PATTERNS",
            },
            {
              text: "Auth & Security",
              link: "/senior-architect/SECURITY-AND-IDENTITY",
            },
            {
              text: "ADRs & Governance",
              link: "/senior-architect/ARCHITECTURE-DECISION-RECORDS",
            },
          ],
        },
        {
          text: "☁️ AWS Solutions (Real-world)",
          collapsed: false,
          items: [
            {
              text: "AWS Architecture Suite",
              link: "/senior-architect/aws-solutions/README",
            },
            {
              text: "AWS: Scale to Millions",
              link: "/senior-architect/aws-solutions/AWS-SCALE-TO-MILLIONS",
            },
            {
              text: "AWS: Pub/Sub Arch",
              link: "/senior-architect/aws-solutions/AWS-EVENT-DRIVEN",
            },
            {
              text: "AWS: Saga Distributed",
              link: "/senior-architect/aws-solutions/AWS-DISTRIBUTED-TRANSACTIONS",
            },
            {
              text: "AWS: DB Scaling",
              link: "/senior-architect/aws-solutions/AWS-DATABASE-SCALING",
            },
            {
              text: "AWS: High Availability",
              link: "/senior-architect/aws-solutions/AWS-RESILIENCY",
            },
          ],
        },
        {
          text: "🔙 Back to Main Docs",
          items: [{ text: "← Documentation Index", link: "/README" }],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/vuejs/vitepress" },
    ],

    footer: {
      message: "Released under the MIT License.",
      copyright: "File Processing System Documentation - 2026",
    },

    search: {
      provider: "local",
    },

    outline: {
      level: [2, 3],
    },
  },
});
