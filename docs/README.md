# Documentation Index

Welcome to the File Processing System documentation! 📚

## 🚀 Getting Started

New to the system? Start here:

### Quick Start Guide
- **[QUICKSTART.md](./QUICKSTART.md)** - 5-minute setup guide to get the system running
  - Prerequisites checklist
  - Step-by-step installation
  - First upload and search test
  - Common issues & quick fixes

**Perfect for**: First-time users, developers setting up local environment

---

## 📖 Core Documentation

### Complete Workflow Guide
- **[WORKFLOW.md](./application/WORKFLOW.md)** - End-to-end system workflow
  - Architecture overview with diagrams
  - Component descriptions
  - Complete setup guide
  - API usage examples
  - Monitoring commands
  - Troubleshooting guide
  - Configuration reference
  - Best practices

**Perfect for**: Understanding how everything works together, deployment guide

### System Architecture
- **[ARCHITECTURE.md](./application/ARCHITECTURE.md)** - Deep dive into system design
  - High-level architecture diagrams
  - Component details (API, Lambda, Storage)
  - Data flow diagrams (Upload, Processing, Search)
  - Hexagonal architecture patterns
  - Lambda processing pipeline
  - Elasticsearch index structure
  - Security considerations
  - Scalability analysis
  - Technology stack

**Perfect for**: Architects, senior developers, understanding design decisions

### Application Documentation (NEW!)
- **[Application Docs](./application/README.md)** - Lambda & AI implementation details
  - [🔄 Lambda Flow Sequence](./application/LAMBDA-FLOW-SEQUENCE.md) - Complete sequence diagrams
  - [📦 Lambda Layer Setup](./application/LAMBDA-LAYER-SETUP.md) - AI dependencies setup
  - [🧠 Markdown AI Processing](./application/README-MARKDOWN-AI.md) - Intelligent chunking & search
  - [🔍 OpenSearch Setup](./application/OPENSEARCH-SETUP.md) - Search engine configuration

**Perfect for**: Developers implementing AI features, understanding Lambda internals

### Kibana User Guide
- **[KIBANA-GUIDE.md](./application/KIBANA-GUIDE.md)** - Complete Kibana usage guide
  - First-time setup (Data Views)
  - Discover tab - search files and chunks
  - Dev Tools - advanced queries
  - Visualizations (metrics, charts, tables)
  - Dashboard creation
  - Common use cases (find text, verify uploads, reconstruct files)
  - Troubleshooting search issues
  - Performance analysis

**Perfect for**: Anyone using Kibana to search and monitor the file processing system

### Module Documentation (NEW)
- **[Modules Index](./modules/README.md)** - Focused documentation by module
  - [API Service](./modules/API.md)
  - [Web Frontend](./modules/WEB.md)
  - [MCP Server](./modules/MCP-SERVER.md)
  - [Infrastructure](./modules/INFRASTRUCTURE.md)

**Perfect for**: Team members working on a specific package or service

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              File Processing System                      │
│         LocalStack + Real Elasticsearch Stack            │
└─────────────────────────────────────────────────────────┘

    Client → API → S3 → SQS → Lambda → Elasticsearch
      ↓       ↓                           ↓
    Upload  Store                       Search
```

**Key Components:**
- **NestJS API** (Port 3000): File upload & search service
- **LocalStack** (Port 4566): AWS services emulator (S3, SQS, Lambda)
- **Lambda Worker**: File processing & chunking
- **Elasticsearch** (Port 9200): Full-text search engine

---

## 📚 Documentation Structure

### By User Type

#### 👨‍💻 **Developers**
1. Start with [QUICKSTART.md](./QUICKSTART.md) to set up your environment
2. Read [WORKFLOW.md](./application/WORKFLOW.md) to understand the flow
3. Use [KIBANA-GUIDE.md](./application/KIBANA-GUIDE.md) to search and debug
4. Refer to [ARCHITECTURE.md](./application/ARCHITECTURE.md) for implementation details

#### 🏗️ **Architects**
1. Begin with [ARCHITECTURE.md](./application/ARCHITECTURE.md) for design overview
2. Review [WORKFLOW.md](./application/WORKFLOW.md) for operational details
3. Check [QUICKSTART.md](./QUICKSTART.md) for quick validation

#### 🔧 **DevOps Engineers**
1. Follow [QUICKSTART.md](./QUICKSTART.md) for infrastructure setup
2. Study [WORKFLOW.md](./application/WORKFLOW.md) for monitoring and troubleshooting
3. Review [ARCHITECTURE.md](./application/ARCHITECTURE.md) for scalability considerations

#### 📝 **Technical Writers / Product Managers**
1. Start with this README for overview
2. Read [WORKFLOW.md](./application/WORKFLOW.md) for feature understanding
3. Refer to [QUICKSTART.md](./QUICKSTART.md) for demo preparation

---

## 🎯 Quick Navigation

### Common Tasks

| Task | Documentation |
|------|---------------|
| **Set up the system** | [QUICKSTART.md](./QUICKSTART.md) → Steps 1-6 |
| **Upload a file** | [QUICKSTART.md](./QUICKSTART.md) → Test Section |
| **Search files** | [WORKFLOW.md](./application/WORKFLOW.md) → API Usage |
| **Use Kibana UI** | [KIBANA-GUIDE.md](./application/KIBANA-GUIDE.md) → First Time Setup |
| **Search in Kibana** | [KIBANA-GUIDE.md](./application/KIBANA-GUIDE.md) → Discover |
| **Create dashboards** | [KIBANA-GUIDE.md](./application/KIBANA-GUIDE.md) → Dashboard Creation |
| **Troubleshoot errors** | [WORKFLOW.md](./application/WORKFLOW.md) → Troubleshooting |
| **Understand architecture** | [ARCHITECTURE.md](./application/ARCHITECTURE.md) → Architecture Overview |
| **Lambda flow details** | [application/LAMBDA-FLOW-SEQUENCE.md](./application/LAMBDA-FLOW-SEQUENCE.md) → Sequence Diagrams |
| **AI search features** | [application/README-MARKDOWN-AI.md](./application/README-MARKDOWN-AI.md) → Features |
| **Scale the system** | [ARCHITECTURE.md](./application/ARCHITECTURE.md) → Scalability |
| **Security hardening** | [ARCHITECTURE.md](./application/ARCHITECTURE.md) → Security |
| **Monitor services** | [WORKFLOW.md](./application/WORKFLOW.md) → Monitoring |

---

## 🔍 Search Documentation

Looking for specific information?

### Keywords Index

- **Setup**: [QUICKSTART.md](./QUICKSTART.md)
- **Docker**: [QUICKSTART.md](./QUICKSTART.md), [WORKFLOW.md](./application/WORKFLOW.md)
- **LocalStack**: [QUICKSTART.md](./QUICKSTART.md), [WORKFLOW.md](./application/WORKFLOW.md)
- **Terraform**: [WORKFLOW.md](./application/WORKFLOW.md) → Setup Guide
- **Lambda**: [ARCHITECTURE.md](./application/ARCHITECTURE.md) → Lambda Worker, [WORKFLOW.md](./application/WORKFLOW.md) → Processing
- **Elasticsearch**: [WORKFLOW.md](./application/WORKFLOW.md) → Storage Layer, [ARCHITECTURE.md](./application/ARCHITECTURE.md)
- **Kibana**: [KIBANA-GUIDE.md](./application/KIBANA-GUIDE.md) → Complete usage guide
- **Search Queries**: [KIBANA-GUIDE.md](./application/KIBANA-GUIDE.md) → Dev Tools
- **Visualizations**: [KIBANA-GUIDE.md](./application/KIBANA-GUIDE.md) → Visualizations & Dashboards
- **API Endpoints**: [QUICKSTART.md](./QUICKSTART.md) → API Endpoints, [WORKFLOW.md](./application/WORKFLOW.md)
- **Troubleshooting**: [QUICKSTART.md](./QUICKSTART.md) → Common Issues, [WORKFLOW.md](./application/WORKFLOW.md) → Troubleshooting, [KIBANA-GUIDE.md](./application/KIBANA-GUIDE.md) → Troubleshooting
- **Security**: [ARCHITECTURE.md](./application/ARCHITECTURE.md) → Security Architecture
- **Scaling**: [ARCHITECTURE.md](./application/ARCHITECTURE.md) → Scalability
- **Configuration**: [WORKFLOW.md](./application/WORKFLOW.md) → Configuration Reference

---

## 📦 Project Structure Reference

```
localstack/
├── docs/                          ← You are here
│   ├── README.md                  ← This file (Documentation index)
│   ├── QUICKSTART.md             ← 5-minute setup guide
│   ├── WORKFLOW.md               ← Complete workflow guide
│   ├── ARCHITECTURE.md           ← System architecture deep dive
│   ├── KIBANA-GUIDE.md           ← Kibana usage guide
│   ├── AWS-CLOUD-ARCHITECTURE.md ← AWS cloud planning
│   ├── CHUNKING-STRATEGIES.md    ← File chunking strategies
│   ├── application/              ← NEW: Lambda & AI docs
│   │   ├── README.md             ← Application docs index
│   │   ├── LAMBDA-FLOW-SEQUENCE.md ← Sequence diagrams
│   │   ├── LAMBDA-LAYER-SETUP.md  ← Layer configuration
│   │   ├── README-MARKDOWN-AI.md  ← AI processing guide
│   │   ├── OPENSEARCH-SETUP.md    ← Search setup
│   │   └── ARCHITECTURE.md        ← Detailed architecture
│   └── elasticsearch/            ← Elasticsearch learning
│       ├── README.md             ← Learning path
│       └── ...                   ← Core concepts
│
├── file-processor/               ← NestJS API
│   ├── src/
│   │   ├── presentation/         ← Controllers & validators
│   │   ├── application/          ← Use cases
│   │   ├── domain/              ← Entities & ports
│   │   └── infrastructure/       ← Adapters (S3, SQS, ES)
│   ├── .env                      ← Environment config
│   └── package.json
│
├── file-processor-lambda/        ← Lambda worker
│   ├── src/
│   │   └── handler.js           ← Lambda handler
│   ├── deploy.sh                ← Deployment script
│   └── package.json
│
├── terraform/                    ← Infrastructure as Code
│   └── file-processor/
│       ├── main.tf              ← S3, SQS, Lambda resources
│       ├── opensearch.tf        ← OpenSearch (not used)
│       └── iam.tf              ← IAM roles & policies
│
├── localstack-data/             ← LocalStack persistence
│   ├── s3/                      ← S3 data
│   ├── sqs/                     ← SQS data
│   └── lambda/                  ← Lambda data
│
└── docker-compose.yml           ← LocalStack container config
```

---

## 🎓 Learning Path

### Beginner (0-2 weeks)

**Week 1: Setup & Basic Usage**
1. ✅ Follow [QUICKSTART.md](./QUICKSTART.md) to set up environment
2. ✅ Upload files and perform searches
3. ✅ Understand basic flow: Upload → Process → Search
4. ✅ Explore API endpoints with Swagger

**Week 2: Understanding Components**
1. ✅ Read [WORKFLOW.md](./application/WORKFLOW.md) sections:
   - Components
   - Complete Workflow
   - Monitoring
2. ✅ Practice troubleshooting common issues
3. ✅ Experiment with different file types and sizes

### Intermediate (2-4 weeks)

**Week 3: Deep Dive**
1. ✅ Study [ARCHITECTURE.md](./application/ARCHITECTURE.md):
   - Hexagonal Architecture pattern
   - Data flow diagrams
   - Component interactions
2. ✅ Review NestJS code:
   - Presentation layer (controllers)
   - Application layer (use cases)
   - Infrastructure layer (adapters)
3. ✅ Understand Lambda processing logic

**Week 4: Customization**
1. ✅ Modify chunk size and test results
2. ✅ Add new API endpoints
3. ✅ Customize Elasticsearch mapping
4. ✅ Implement file type validation

### Advanced (1-2 months)

**Month 2: Production Preparation**
1. ✅ Security hardening (see [ARCHITECTURE.md](./application/ARCHITECTURE.md) → Security)
2. ✅ Performance optimization
3. ✅ Monitoring & alerting setup
4. ✅ Migration from LocalStack to AWS
5. ✅ Implement CI/CD pipeline
6. ✅ Load testing & capacity planning

---

## 💡 Best Practices

### Reading Documentation

1. **Start with overview** - Don't skip this README
2. **Follow learning path** - Use the structured approach above
3. **Try examples** - Run commands and test features
4. **Take notes** - Document your learnings
5. **Ask questions** - Open issues for clarifications

### Using the System

1. **Development** - Use LocalStack for local development
2. **Testing** - Create automated tests for workflows
3. **Monitoring** - Always check logs when debugging
4. **Security** - Never use dev credentials in production
5. **Backup** - Regularly backup Elasticsearch data

---

## 🔄 Documentation Updates

This documentation is maintained alongside code changes.

**Last Major Update**: January 25, 2026  
**Version**: 1.0  
**Status**: ✅ Complete and up-to-date

### What's New

- ✅ Complete system documentation
- ✅ Architecture diagrams
- ✅ Step-by-step guides
- ✅ Troubleshooting section
- ✅ Production considerations
- ✅ Kibana usage guide with examples
- ✅ AWS cloud architecture planning
- ✅ Industry chunking strategies

### Feedback

Found an issue or have suggestions?
- Open an issue in the repository
- Submit a pull request with improvements
- Contact the development team

---

## 🎯 Quick Reference

### Essential Commands

```bash
# Start services
docker compose up -d localstack
docker start elasticsearch-local

# Check health
curl http://localhost:4566/_localstack/health
curl http://localhost:9200
curl http://localhost:3000/health

# Upload file
curl -X POST http://localhost:3000/files/upload -F "file=@path/to/file"

# Search
curl "http://localhost:3000/files/search?text=keyword"

# View logs
docker compose logs -f localstack
docker logs -f elasticsearch-local
```

### Key URLs

- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/api/docs
- **LocalStack**: http://localhost:4566
- **Elasticsearch**: http://localhost:9200
- **Health Check**: http://localhost:3000/health

### Port Reference

| Service | Port |
|---------|------|
| NestJS API | 3000 |
| LocalStack | 4566 |
| Elasticsearch | 9200 |

---

## 📞 Support

### Self-Service Resources

1. **Troubleshooting Guides**
   - [QUICKSTART.md](./QUICKSTART.md) → Common Issues
   - [WORKFLOW.md](./application/WORKFLOW.md) → Troubleshooting

2. **Code Examples**
   - [WORKFLOW.md](./application/WORKFLOW.md) → API Usage
   - [QUICKSTART.md](./QUICKSTART.md) → Test Section

3. **Architecture Details**
   - [ARCHITECTURE.md](./application/ARCHITECTURE.md) → All sections

### Getting Help

1. **Check documentation first** (you're in the right place!)
2. **Review logs** for error messages
3. **Search existing issues** in repository
4. **Open new issue** with:
   - Clear description of problem
   - Steps to reproduce
   - Logs and error messages
   - Environment details (OS, versions)

---

## 🏆 Success Metrics

You'll know you understand the system when you can:

- ✅ Set up the entire stack from scratch
- ✅ Upload files and search them successfully
- ✅ Explain the data flow from upload to search
- ✅ Troubleshoot common issues independently
- ✅ Modify and extend the system
- ✅ Prepare the system for production deployment

---

## 📚 Additional Resources

### External Documentation

- [NestJS Documentation](https://docs.nestjs.com/)
- [AWS Lambda Docs](https://docs.aws.amazon.com/lambda/)
- [Elasticsearch Guide](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [LocalStack Docs](https://docs.localstack.cloud/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)

### Related Projects

- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)

---

**Happy Coding! 🚀**

---

*This documentation is part of the File Processing System project.*  
*For questions or contributions, please refer to the main project README.*
