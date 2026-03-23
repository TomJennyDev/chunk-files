# 🏗️ Microservices Architecture — From Scratch to Production

> **A Master Senior Engineer's Guide to designing, building, and operating a distributed event-driven microservices platform.**

---

## Why This Section Exists

This documentation covers every architectural decision, trade-off, and pattern used in the **Chunk Files** platform — a production-grade, event-driven microservices system for uploading, processing, indexing, and searching large documents at scale.

Unlike theoretical guides, every concept here is **mapped to real code** in this repository. You'll see exactly how theory becomes implementation.

---

## System at a Glance

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                      │
│   React SPA (Vite)  ←→  WebSocket (Socket.IO)                      │
└──────────┬────────────────────────┬─────────────────────────────────┘
           │ HTTP                   │ WS
           ▼                        ▼
┌──────────────────┐    ┌─────────────────────────┐
│   API Gateway    │    │  Notification Service    │
│   (Port 3000)    │    │  (Port 3004)             │
│   NestJS + REST  │    │  NestJS + Socket.IO      │
└────────┬─────────┘    └──────────▲──────────────┘
         │ Kafka                    │ Kafka
         ▼                          │
┌──────────────────────────────────────────────────┐
│              Apache Kafka (KRaft)                  │
│   Topics: file.uploaded | file.processing.*       │
│           chunks.indexed | notification.send      │
└──┬─────────────┬──────────────┬──────────────────┘
   │              │              │
   ▼              ▼              ▼
┌────────┐  ┌───────────┐  ┌──────────┐
│Upload  │  │Processing │  │Search    │
│Service │  │Service x2 │  │Service   │
└───┬────┘  └──┬────────┘  └────┬─────┘
    │          │                 │
    ▼          ▼                 ▼
┌────────┐  ┌───────────┐  ┌──────────┐
│  S3    │  │Elastic    │  │  Redis   │
│(Local) │  │search     │  │  Cache   │
└────────┘  └───────────┘  └──────────┘
```

---

## Documentation Roadmap

### Phase 1: Foundations

| # | Document | What You'll Learn |
|---|----------|------------------|
| 1 | [System Design Overview](./SYSTEM-DESIGN-OVERVIEW.md) | High-level architecture, C4 model, non-functional requirements, technology selection rationale |
| 2 | [Service Decomposition](./SERVICE-DECOMPOSITION.md) | How and why we split services, bounded contexts, domain-driven decomposition, dependency mapping |
| 3 | [API Gateway Pattern](./API-GATEWAY-PATTERN.md) | Edge service design, request routing, aggregation, rate limiting, authentication boundary |

### Phase 2: Communication & Data

| # | Document | What You'll Learn |
|---|----------|------------------|
| 4 | [Event-Driven Architecture](./EVENT-DRIVEN-ARCHITECTURE.md) | Pub/Sub vs Request/Reply, event schemas, idempotency, ordering guarantees, dead letter queues |
| 5 | [Kafka Deep Dive](./KAFKA-DEEP-DIVE.md) | KRaft architecture, partitioning, consumer groups, exactly-once semantics, topic design, operational excellence |
| 6 | [Data Management Patterns](./DATA-MANAGEMENT-PATTERNS.md) | Database-per-service, Redis caching layers, Elasticsearch indexing, eventual consistency, data ownership |

### Phase 3: Reliability & Scale

| # | Document | What You'll Learn |
|---|----------|------------------|
| 7 | [CQRS & Event Sourcing](./CQRS-EVENT-SOURCING.md) | Command-Query separation, write/read model split, event replay, materialized views |
| 8 | [Resilience Patterns](./RESILIENCE-PATTERNS.md) | Circuit breaker, retry with backoff, bulkhead, timeout, graceful degradation, DLQ handling |
| 9 | [Scaling Strategies](./SCALING-STRATEGIES.md) | Horizontal scaling, Kafka partitions, consumer group rebalancing, stateless design, load shedding |

### Phase 4: Operations

| # | Document | What You'll Learn |
|---|----------|------------------|
| 10 | [Testing Strategies](./TESTING-STRATEGIES.md) | Unit, integration, contract, E2E testing for microservices, Kafka test utilities, test containers |

---

## Service Registry

| Service | Transport | Port | Role | Tech Stack |
|---------|-----------|------|------|------------|
| **API Gateway** | HTTP (REST) | 3000 | Edge service, request routing | NestJS, Kafka Producer, Redis, Swagger |
| **Upload Service** | Kafka | — | File ingestion, S3 storage | NestJS, S3, Redis, Kafka Consumer |
| **Processing Service** | Kafka | — | Chunking, indexing | NestJS, S3, Elasticsearch, Kafka Consumer (x2 replicas) |
| **Search Service** | Kafka | — | Full-text search | NestJS, Elasticsearch, Redis Cache |
| **Notification Service** | Kafka + WebSocket | 3004 | Real-time notifications | NestJS, Socket.IO, Redis Pub/Sub |

---

## Infrastructure Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Message Broker | Apache Kafka 7.6 (KRaft) | Asynchronous event streaming |
| Cache + Metadata | Redis 7.2 | Caching, file metadata, pub/sub |
| Search Engine | Elasticsearch 8.11 | Full-text search, chunk indexing |
| Object Storage | S3 (LocalStack) | File binary storage |
| Observability | OTel Collector → Tempo + Loki + Prometheus → Grafana | Traces, logs, metrics |
| Container Orchestration | Docker Compose | Local development |

---

## Reading Order for Different Audiences

### 🎯 Backend Developer (New to Microservices)
1. System Design Overview → 2. Service Decomposition → 4. Event-Driven Architecture → 5. Kafka Deep Dive

### 🎯 Senior Engineer (Architecture Review)
1. System Design Overview → 3. API Gateway Pattern → 7. CQRS & Event Sourcing → 8. Resilience Patterns

### 🎯 DevOps / SRE
1. System Design Overview → 5. Kafka Deep Dive → 9. Scaling Strategies → 10. Testing Strategies

### 🎯 System Design Interview Prep
Read all documents in order — each one maps to a common interview topic with real code examples.

---

## Quick Reference: Data Flow

```
1. User uploads file via HTTP POST /files/upload
2. API Gateway → Kafka topic: file.uploaded (with base64 `fileBuffer`)
3. Upload Service → decodes → uploads to S3 → saves metadata to Redis
4. Upload Service → Kafka topic: file.processing.started
5. Processing Service (2x) → downloads from S3 → chunks → bulk indexes to Elasticsearch
6. Processing Service → Kafka topic: file.processing.completed
7. Upload Service → updates status in Redis
8. Notification Service → broadcasts via WebSocket to all connected clients
9. User searches via HTTP GET /search → API Gateway → Kafka → Search Service → Elasticsearch
```

---

> **Next:** Start with [System Design Overview →](./SYSTEM-DESIGN-OVERVIEW.md)
