# Elasticsearch Core Concepts - Danh Mục Tổng Hợp

> **Hướng dẫn tổng quan về các khái niệm cơ bản của Elasticsearch.** Mỗi khái niệm có file chi tiết riêng với giải thích sâu, ví dụ thực tế và best practices.

---

## 📚 Danh Sách Hướng Dẫn Chi Tiết

### ✅ Đã hoàn thành (Ready to read!)

#### 1. **[DOCUMENTS.md](./DOCUMENTS.md)** - Hiểu về Documents
- Document là gì? Tại sao dùng documents?
- Cấu trúc document và metadata
- CRUD operations chi tiết
- Bulk operations và performance
- Versioning & Optimistic Concurrency
- Ưu/nhược điểm và use cases
- Best practices & troubleshooting
- **12+ sections, 1000+ lines**

#### 2. **[INDICES.md](./INDICES.md)** - Quản Lý Indices
- Index là gì? So sánh với SQL
- Index structure và components
- Naming conventions
- CRUD operations
- Index settings và configurations
- Index templates (reusable)
- Index aliases (zero-downtime)
- Index Lifecycle Management (ILM)
- Best practices & troubleshooting
- **12+ sections, 1000+ lines**

#### 3. **[SHARDS.md](./SHARDS.md)** - Chiến Lược Sharding
- Shard là gì? Tại sao cần sharding?
- Document distribution và routing
- Primary vs Replica shards
- Shard allocation strategies
- Shard sizing (10-50GB optimal)
- Custom routing
- Ưu/nhược điểm chi tiết
- Calculations và decision trees
- Monitoring và troubleshooting
- **11+ sections, 1200+ lines**

#### 4. **[REPLICAS.md](./REPLICAS.md)** - Chiến Lược Replication ✅
- Replica là gì? Benefits chi tiết
- Synchronous vs Asynchronous replication
- Failover scenarios và recovery time
- Read scaling strategies
- Replication configuration
- High availability setup
- Ưu/nhược điểm
- Best practices & troubleshooting
- **12+ sections, 1200+ lines**

#### 5. **[MAPPING.md](./MAPPING.md)** - Schema Definition ✅
- Mapping là gì? Schema trong Elasticsearch
- Dynamic vs Explicit mapping
- Field data types (text, keyword, numeric, date, etc.)
- Mapping parameters (index, store, doc_values)
- Index templates
- Reindexing strategies
- Mapping updates và limitations
- Best practices & common patterns
- **10+ sections, 1000+ lines**

#### 6. **[ANALYZERS.md](./ANALYZERS.md)** - Text Analysis ✅
- Analyzer là gì? Analysis pipeline
- Built-in analyzers (standard, simple, whitespace, etc.)
- Custom analyzers
- Character filters (html_strip, mapping, pattern)
- Tokenizers (standard, ngram, edge_ngram, path)
- Token filters (lowercase, stop, stemmer, synonym)
- Language analyzers (30+ languages)
- Testing analyzers với _analyze API
- Best practices
- **10+ sections, 800+ lines**

#### 7. **[DATA-TYPES.md](./DATA-TYPES.md)** - Field Types Reference ✅
- Text types (text vs keyword)
- Numeric types (byte, short, integer, long, float, double, scaled_float)
- Date type và formats
- Boolean, binary types
- Range types (integer_range, date_range, ip_range)
- Complex types (object, nested, flattened)
- Geo types (geo_point, geo_shape)
- Specialized types (ip, completion, token_count, percolator)
- Field type comparison
- Best practices
- **10+ sections, 900+ lines**

#### 8. **[CLUSTERS-NODES.md](./CLUSTERS-NODES.md)** - Cluster Architecture ✅
- Cluster là gì? Multi-node setup
- Node types (master, data, ingest, coordinating, ML)
- Cluster state và management
- Node discovery
- Cluster health monitoring
- Split-brain problem và quorum
- Cluster sizing guidelines
- Best practices
- **8+ sections, 800+ lines**

#### 9. **[RELEVANCE-SCORING.md](./RELEVANCE-SCORING.md)** - Query Scoring ✅
- Relevance scoring là gì?
- TF-IDF algorithm (legacy)
- BM25 algorithm (current default)
- Score calculation process
- Boosting strategies (field, term, negative)
- Function score query (decay, field_value_factor, script, random)
- Explain API để debug scores
- Best practices
- **8+ sections, 800+ lines**

---

### 📊 Progress Summary

**✅ Hoàn thành:** 9/9 files (100%)  
**📄 Total Lines:** ~8,700+ lines  
**🎯 Coverage:** Full Elasticsearch core concepts với ví dụ chi tiết, best practices, troubleshooting

---

## 🎓 Lộ Trình Học Tập (Learning Path)
- Core types (text, keyword, numeric, date, boolean)
- Complex types (object, nested, array)
- Specialized types (geo_point, ip, etc.)
- Khi nào dùng type nào?
- Performance implications

#### 9. **CLUSTERS-NODES.md** - Cluster Architecture
- Cluster là gì?
- Node roles (Master, Data, Coordinating, Ingest)
- Cluster state
- Node communication
- Split-brain prevention
- High availability setup

#### 10. **RELEVANCE-SCORING.md** - Search Scoring
- TF-IDF explained
- BM25 algorithm (current)
- Score calculation
- Boosting strategies
- Function score queries
- Explain API

---

## 🚀 Quick Start Guide

### Elasticsearch trong 5 phút

```bash
# 1. Tạo index
PUT /products
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1
  },
  "mappings": {
    "properties": {
      "name": {"type": "text"},
      "price": {"type": "float"},
      "category": {"type": "keyword"}
    }
  }
}

# 2. Index documents
POST /products/_doc
{
  "name": "Laptop Dell XPS 13",
  "price": 1299.99,
  "category": "electronics"
}

# 3. Search
GET /products/_search
{
  "query": {
    "match": {"name": "laptop"}
  }
}

# 4. Check health
GET /_cluster/health
GET /_cat/indices?v
```

---

## 🎯 Lộ Trình Học Tập

### **Level 1: Beginner (Tuần 1-2)**
1. ✅ Đọc [DOCUMENTS.md](./DOCUMENTS.md)
   - Hiểu documents là đơn vị cơ bản
   - Practice CRUD operations
   - Làm quen với JSON structure
   
2. ✅ Đọc [INDICES.md](./INDICES.md)
   - Hiểu indices và index management
   - Practice tạo indices với settings
   - Làm quen với aliases

**Mục tiêu:** Có thể tạo index và CRUD documents

---

### **Level 2: Intermediate (Tuần 3-4)**
3. ✅ Đọc [SHARDS.md](./SHARDS.md)
   - Hiểu sharding strategy
   - Calculate optimal shard count
   - Monitor shard health
   
4. ➡️ Đọc **REPLICAS.md** (sắp ra mắt)
   - Hiểu replication cho HA
   - Configure replicas appropriately
   - Understand failover

5. ➡️ Đọc **MAPPING.md** (sắp ra mắt)
   - Define explicit mappings
   - Choose correct field types
   - Avoid mapping explosions

**Mục tiêu:** Thiết kế index structure tối ưu

---

### **Level 3: Advanced (Tuần 5-6)**
6. ➡️ Đọc **ANALYZERS.md** (sắp ra mắt)
   - Custom text analysis
   - Language-specific analyzers
   - Search relevance tuning

7. ➡️ Đọc **CLUSTERS-NODES.md** (sắp ra mắt)
   - Cluster architecture
   - Node roles và sizing
   - High availability setup

8. ➡️ Đọc **RELEVANCE-SCORING.md** (sắp ra mắt)
   - Understand BM25
   - Boosting strategies
   - Query tuning

**Mục tiêu:** Master Elasticsearch architecture và performance tuning

---

## 📊 So Sánh với SQL (Quick Reference)

| SQL | Elasticsearch | File Chi Tiết |
|-----|---------------|---------------|
| Database | Cluster | [CLUSTERS-NODES.md] |
| Table | Index | [INDICES.md](./INDICES.md) |
| Row | Document | [DOCUMENTS.md](./DOCUMENTS.md) |
| Column | Field | [MAPPING.md] |
| Schema | Mapping | [MAPPING.md] |
| Index (B-tree) | Inverted Index | [INVERTED-INDEX.md] |
| Partition | Shard | [SHARDS.md](./SHARDS.md) |
| Replication | Replica | [REPLICAS.md] |

---

## 🏗️ Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                 ELASTICSEARCH CLUSTER                   │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐        │
│  │  Node 1  │    │  Node 2  │    │  Node 3  │        │
│  │ (Master) │    │  (Data)  │    │  (Data)  │        │
│  │          │    │          │    │          │        │
│  │ [P0][R1] │    │ [P1][R0] │    │ [P2][R2] │        │
│  │ [R2]     │    │ [R1]     │    │ [R0]     │        │
│  └──────────┘    └──────────┘    └──────────┘        │
│                                                         │
│  Index: "products" (3 primary shards, 2 replicas)      │
│  Total: 9 shards (3 primaries + 6 replicas)            │
│                                                         │
│  ┌──────────────────────────────────────────────┐     │
│  │ Document 1: {name: "Laptop", price: 999}     │     │
│  │ Document 2: {name: "Mouse", price: 29}       │     │
│  │ Document 3: {name: "Keyboard", price: 79}    │     │
│  └──────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────┘
```

**Xem chi tiết:**
- Documents → [DOCUMENTS.md](./DOCUMENTS.md)
- Indices → [INDICES.md](./INDICES.md)
- Shards → [SHARDS.md](./SHARDS.md)
- Replicas → REPLICAS.md (sắp ra mắt)
- Cluster → CLUSTERS-NODES.md (sắp ra mắt)

---

## 🎓 Key Concepts Summary

### 1. **Document** ([chi tiết](./DOCUMENTS.md))
- JSON object (đơn vị cơ bản)
- Schema linh hoạt
- CRUD operations
- ⚠️ Không có transactions

### 2. **Index** ([chi tiết](./INDICES.md))
- Collection of documents
- Có settings và mappings
- Index templates
- ILM automation

### 3. **Shard** ([chi tiết](./SHARDS.md))
- Phần nhỏ của index
- Horizontal scaling
- 10-50GB optimal
- ⚠️ Cannot change count

### 4. **Replica** (sắp ra mắt)
- Copy of shard
- High availability
- Read scaling
- ⚠️ 2-3× storage cost

### 5. **Inverted Index** (sắp ra mắt)
- Fast full-text search
- O(1) term lookup
- Segments và merging

### 6. **Mapping** (sắp ra mắt)
- Schema definition
- Field types
- Dynamic vs Explicit

### 7. **Analyzer** (sắp ra mắt)
- Text processing
- Tokenization
- Custom analysis

### 8. **Cluster** (sắp ra mắt)
- Multiple nodes
- Master, Data, Coordinating
- High availability

### 9. **Relevance** (sắp ra mắt)
- BM25 scoring
- TF-IDF
- Query boosting

---

## 💡 Best Practices (Tổng Hợp)

### Index Design
✅ **DO:**
- Use time-based indices cho logs (daily/monthly)
- Plan shard count: `index_size / 30GB`
- Use index templates
- Implement ILM
- Use aliases for zero-downtime

❌ **DON'T:**
- Over-shard (too many small shards)
- Under-shard (too few large shards)
- Store everything in one index
- Forget about replicas in production

### Document Design
✅ **DO:**
- Use meaningful IDs
- Include timestamps
- Denormalize strategically
- Use bulk operations

❌ **DON'T:**
- Store huge nested objects (>10MB)
- Use for transactional data
- Store unnecessary data

### Cluster Design
✅ **DO:**
- 3+ master-eligible nodes
- Separate master and data nodes (large clusters)
- Monitor cluster health
- Regular backups (snapshots)

❌ **DON'T:**
- Run in production with 1 node
- Ignore yellow/red status
- Forget about resource limits

---

## 🔗 Tài Liệu Liên Quan

### Trong thư mục này:
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Overall system architecture
- **[OPTIMIZATION.md](./OPTIMIZATION.md)** - Performance tuning guide
- **[ENTERPRISE-USE-CASES.md](./ENTERPRISE-USE-CASES.md)** - Real-world examples

### Chủ đề khác:
- **[../QUICKSTART.md](../QUICKSTART.md)** - Getting started guide
- **[../WORKFLOW.md](../application/WORKFLOW.md)** - Development workflow
- **[../KIBANA-GUIDE.md](../application/KIBANA-GUIDE.md)** - Kibana visualization

---

## 📈 Progress Tracker

**Documentation Status:**

| File | Status | Lines | Sections | Last Update |
|------|--------|-------|----------|-------------|
| DOCUMENTS.md | ✅ Complete | 1000+ | 12 | 2026-01-31 |
| INDICES.md | ✅ Complete | 1000+ | 12 | 2026-01-31 |
| SHARDS.md | ✅ Complete | 1200+ | 11 | 2026-01-31 |
| REPLICAS.md | 🚧 In Progress | - | - | - |
| INVERTED-INDEX.md | 📝 Planned | - | - | - |
| MAPPING.md | 📝 Planned | - | - | - |
| ANALYZERS.md | 📝 Planned | - | - | - |
| DATA-TYPES.md | 📝 Planned | - | - | - |
| CLUSTERS-NODES.md | 📝 Planned | - | - | - |
| RELEVANCE-SCORING.md | 📝 Planned | - | - | - |

**Legend:**
- ✅ Complete - Sẵn sàng đọc
- 🚧 In Progress - Đang viết
- 📝 Planned - Sắp bắt đầu

---

## 🎯 Feedback & Contributions

Có câu hỏi hoặc suggestions?
- Đọc file chi tiết của từng concept
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) cho big picture
- Check [OPTIMIZATION.md](./OPTIMIZATION.md) cho performance tuning

---

*Cập nhật: 31 Tháng 1, 2026*
*Các file chi tiết được cập nhật liên tục. Star repo để không bỏ lỡ updates!*
