# Application Documentation

Tài liệu chi tiết về implementation, architecture, và các workflows của hệ thống xử lý file với Lambda, AI, và Elasticsearch.

---

## 📋 Table of Contents

### ⚡ Lambda Processing
- [🔄 Lambda Flow Sequence](LAMBDA-FLOW-SEQUENCE.md) - Chi tiết sequence flow của Lambda processing với diagrams
- [📦 Lambda Layer Setup](LAMBDA-LAYER-SETUP.md) - Hướng dẫn setup Lambda layers cho AI dependencies
- [🔧 System Architecture](ARCHITECTURE.md) - Kiến trúc tổng thể của hệ thống
- [☁️ AWS Cloud Architecture](AWS-CLOUD-ARCHITECTURE.md) - Deployment architecture trên AWS
- [📋 Complete Workflow](WORKFLOW.md) - End-to-end workflow từ upload đến search

### 🧠 Markdown AI & Search
- [📄 Markdown AI Processing](README-MARKDOWN-AI.md) - Intelligent markdown processing với AI embeddings
- [✂️ Chunking Strategies](CHUNKING-STRATEGIES.md) - Các chiến lược chunking cho documents
- [🔍 OpenSearch Setup](OPENSEARCH-SETUP.md) - Cấu hình OpenSearch/Elasticsearch

### 📊 Monitoring & Analytics
- [📈 Kibana Guide](KIBANA-GUIDE.md) - Hướng dẫn sử dụng Kibana dashboard
- [🔍 Kibana Queries](kibana-queries.md) - Sample queries cho monitoring

---

## 🎯 Quick Navigation

### For Developers
1. **Getting Started**: [System Architecture](ARCHITECTURE.md) → [Workflow](WORKFLOW.md)
2. **Lambda Development**: [Flow Sequence](LAMBDA-FLOW-SEQUENCE.md) → [Layer Setup](LAMBDA-LAYER-SETUP.md)
3. **AI Features**: [Markdown AI](README-MARKDOWN-AI.md) → [OpenSearch](OPENSEARCH-SETUP.md)

### For DevOps
1. **Infrastructure**: [AWS Architecture](AWS-CLOUD-ARCHITECTURE.md) → [OpenSearch Setup](OPENSEARCH-SETUP.md)
2. **Monitoring**: [Kibana Guide](KIBANA-GUIDE.md) → [Queries](kibana-queries.md)
3. **Optimization**: [Chunking Strategies](CHUNKING-STRATEGIES.md) → [Lambda Layers](LAMBDA-LAYER-SETUP.md)

### For QA/Testing
1. **Workflows**: [Complete Workflow](WORKFLOW.md)
2. **Monitoring**: [Kibana Guide](KIBANA-GUIDE.md)
3. **Search Testing**: [Markdown AI](README-MARKDOWN-AI.md)

---

## 📚 Documentation Highlights

### 🔄 Lambda Flow Sequence (NEW!)
Comprehensive documentation với Mermaid sequence diagrams cho:
- File upload flow
- Lambda cold start vs warm container
- Text search, semantic search, hybrid search
- Error handling flows
- Performance metrics

**Key Features:**
- 10+ detailed sequence diagrams
- Step-by-step code examples
- Timing breakdowns
- Cost analysis

[Read More →](LAMBDA-FLOW-SEQUENCE.md)

---

### 📦 Lambda Layer Setup (NEW!)
Complete guide for setting up Lambda layers với AI dependencies:
- Layer structure and packaging
- Dependency management
- Resource configuration
- Cost optimization

**Includes:**
- Build scripts
- Terraform configuration
- Troubleshooting guide
- Best practices

[Read More →](LAMBDA-LAYER-SETUP.md)

---

### 🧠 Markdown AI Processing (NEW!)
Intelligent markdown processing with AI support:
- Semantic chunking với LangChain
- Vector embeddings (all-MiniLM-L6-v2)
- Scroll-to-position metadata
- Hybrid search (text + semantic)

**Features:**
- 3 search types (text/semantic/hybrid)
- Multiple scroll methods
- Frontend integration examples
- Performance benchmarks

[Read More →](README-MARKDOWN-AI.md)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    File Upload & Processing              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Client → API → S3 → SQS → Lambda → Elasticsearch      │
│                                                          │
│  Lambda Handlers:                                       │
│  • handler.js              - Basic chunking             │
│  • handler-optimized.js    - With caching               │
│  • handler-markdown.js     - AI-powered (NEW)           │
│                                                          │
│  Search Types:                                          │
│  • Text Search            - BM25 keyword-based          │
│  • Semantic Search        - AI vector similarity        │
│  • Hybrid Search          - RRF algorithm               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Technologies

### Backend
- **NestJS** - Hexagonal architecture API
- **AWS Lambda** - Serverless file processing
- **Node.js 18+** - Runtime environment

### Storage & Search
- **AWS S3** - File storage
- **AWS SQS** - Message queue
- **Elasticsearch 8.x** - Search & analytics
- **OpenSearch** - Alternative to Elasticsearch

### AI & ML
- **LangChain** - Document processing
- **@xenova/transformers** - Embeddings generation
- **all-MiniLM-L6-v2** - Embedding model (384-dim)

### Infrastructure
- **LocalStack** - Local AWS emulation
- **Docker** - Containerization
- **Terraform** - Infrastructure as code

---

## 📊 Performance Metrics

### Lambda Processing
| File Size | Cold Start | Warm Container | Cache Hit |
|-----------|-----------|----------------|-----------|
| 10KB      | 6.5s      | 1.5s          | 0.8s      |
| 50KB      | 10.5s     | 2.9s          | 1.2s      |
| 500KB     | 45s       | 25s           | 20s       |

### Search Performance
| Search Type | Latency | Recall | Precision |
|-------------|---------|--------|-----------|
| Text        | ~50ms   | 0.70   | 0.85      |
| Semantic    | ~200ms  | 0.85   | 0.75      |
| Hybrid      | ~250ms  | 0.90   | 0.88      |

---

## 🔗 Related Documentation

### Main Documentation
- [📖 Documentation Index](../README.md)
- [🚀 Quick Start](../QUICKSTART.md)
- [🔍 Elasticsearch Learning](../elasticsearch/README.md)

### AWS Lambda Certification
- [⚡ Complete Lambda Guide](../lambda/LAMBDA-COMPLETE-GUIDE.md)
- [🚀 Deployment Guide](../lambda/LAMBDA-DEPLOYMENT-GUIDE.md)
- [💾 Caching Guide](../lambda/LAMBDA-CACHING-GUIDE.md)

### Advanced Topics
- [📚 Chunking Strategies Detail](../elasticsearch/CHUNKING-STRATEGIES-DETAIL.md)
- [🔍 Search Implementation](../elasticsearch/SEARCH-IMPLEMENTATION.md)
- [🎯 Elasticsearch Optimization](../elasticsearch/OPTIMIZATION.md)

---

## 🤝 Contributing

When adding new documentation:

1. **Place files in correct location:**
   - Lambda-specific: `/application/`
   - Elasticsearch: `/elasticsearch/`
   - AWS Lambda certification: `/lambda/`
   - Main guides: Root level

2. **Update VitePress config:**
   - Add to navigation bar
   - Add to appropriate sidebar
   - Update this index

3. **Follow naming conventions:**
   - Use UPPERCASE for main docs
   - Use kebab-case for supporting files
   - Include emojis in headers 😊

4. **Include diagrams when possible:**
   - Use Mermaid for sequence/flow diagrams
   - Use ASCII art for simple structures
   - Add code examples

---

## 📝 Last Updated

This documentation structure was last updated on **February 2, 2026**.

All files reflect the current implementation with:
- ✅ Markdown AI processing
- ✅ Lambda flow sequences  
- ✅ Hybrid search implementation
- ✅ Vector embeddings support
- ✅ Scroll-to-position features

---

**🔙 [Back to Main Documentation](../README.md)**
