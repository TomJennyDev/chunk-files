# Elasticsearch Core Concepts - Tổng Quan

> **Hướng dẫn tổng hợp về các khái niệm cơ bản của Elasticsearch.** Mỗi khái niệm đều có file chi tiết riêng với giải thích sâu hơn, ví dụ thực tế và best practices.

---

## 📋 Mục Lục Tổng Quan

### Khái Niệm Cơ Bản
1. [Documents](#1-documents) → [📄 Chi tiết](./DOCUMENTS.md)
2. [Indices](#2-indices) → [📚 Chi tiết](./INDICES.md)
3. [Inverted Index](#3-inverted-index)

### Phân Phối & Mở Rộng
4. [Shards](#4-shards) → [🧩 Chi tiết](./SHARDS.md)
5. [Replicas](#5-replicas) → [🔄 Chi tiết](./REPLICAS.md)

### Cấu Trúc Dữ Liệu
6. [Mapping](#6-mapping) → [🗺️ Chi tiết](./MAPPING.md)
7. [Data Types](#7-data-types) → [📊 Chi tiết](./DATA-TYPES.md)
8. [Analyzers](#8-analyzers) → [🔬 Chi tiết](./ANALYZERS.md)

### Hệ Thống
9. [Clusters & Nodes](#9-clusters--nodes) → [🌐 Chi tiết](./CLUSTERS-NODES.md)
10. [Relevance Scoring](#10-relevance-scoring) → [📈 Chi tiết](./RELEVANCE-SCORING.md)

---

## 🚀 Quick Start

### Elasticsearch Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    ELASTICSEARCH CLUSTER                 │
│                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│  │  Node 1  │    │  Node 2  │    │  Node 3  │         │
│  │          │    │          │    │          │         │
│  │ [P0][R1] │    │ [P1][R0] │    │ [P2][R2] │         │
│  │ [R2]     │    │ [R1]     │    │ [R0]     │         │
│  └──────────┘    └──────────┘    └──────────┘         │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │              INDEX: "products"                  │    │
│  │                                                 │    │
│  │  Document 1: {name: "Laptop", price: 999}     │    │
│  │  Document 2: {name: "Mouse", price: 29}       │    │
│  │  Document 3: {name: "Keyboard", price: 79}    │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Documents

> **📄 [Xem hướng dẫn chi tiết](./DOCUMENTS.md)**

### Tóm Tắt Nhanh

**Document** = Đơn vị cơ bản nhất của dữ liệu trong Elasticsearch (giống như row trong SQL)

**Document** = Basic unit of information in Elasticsearch (like a row in SQL)

### Why Documents?

Elasticsearch is document-oriented, meaning data is stored as JSON documents. This design choice enables:
- **Schema flexibility:** Add fields without migration
- **Nested structures:** Natural hierarchical data representation
- **Self-describing:** Each document contains its structure
- **NoSQL benefits:** Easy to scale horizontally

### Structure

```json
{
  "_index": "products",
  "_id": "1",
  "_version": 1,
  "_seq_no": 0,
  "_primary_term": 1,
  "_source": {
    "name": "Laptop",
    "brand": "Dell",
    "price": 999.99,
    "category": "electronics",
    "description": "High-performance laptop",
    "tags": ["computing", "work"],
    "specs": {
      "ram": "16GB",
      "cpu": "Intel i7"
    },
    "created_at": "2026-01-25T10:30:00Z",
    "updated_at": "2026-01-25T10:30:00Z"
  }
}
```

### Key Properties Explained

- **_index**: Which index the document belongs to
  - **Why:** Logical grouping of similar documents
  - **Example:** All product docs in "products" index
  
- **_id**: Unique identifier (auto-generated or custom)
  - **Why:** Fast retrieval and deduplication
  - **Auto ID:** UUID (e.g., "aB3dE5fG7hI9")
  - **Custom ID:** Use business key (e.g., "product-123")
  
- **_source**: The actual JSON document content
  - **Why:** Original document for display and updates
  - **Stored separately:** Can be disabled to save space
  
- **_score**: Relevance score (in search results)
  - **Why:** Ranks results by relevance
  - **Algorithm:** BM25 (better than TF-IDF)
  
- **_version**: Document version number
  - **Why:** Optimistic concurrency control
  - **Use case:** Prevent conflicting updates

### Document Operations

```bash
# CREATE (with auto ID)
POST /products/_doc
{
  "name": "Mouse",
  "price": 29.99
}
# Returns: {"_id": "aB3dE5fG7hI9", "_version": 1}

# CREATE (with specific ID)
PUT /products/_doc/123
{
  "name": "Keyboard",
  "price": 79.99
}
# Returns: {"_id": "123", "_version": 1}

# READ
GET /products/_doc/123
# Returns: Full document with metadata

# UPDATE (partial - recommended)
POST /products/_update/123
{
  "doc": {
    "price": 69.99
  }
}
# Only updates specified fields, keeps others unchanged

# UPDATE (full replace - be careful!)
PUT /products/_doc/123
{
  "name": "Keyboard",
  "price": 69.99
}
# ⚠️ Replaces ENTIRE document! Missing fields will be removed

# DELETE
DELETE /products/_doc/123
# Marks for deletion, actual removal happens during merge

# BULK operations (efficient for many documents)
POST /_bulk
{"index": {"_index": "products", "_id": "1"}}
{"name": "Mouse", "price": 29.99}
{"index": {"_index": "products", "_id": "2"}}
{"name": "Keyboard", "price": 79.99}
{"update": {"_index": "products", "_id": "1"}}
{"doc": {"price": 24.99}}
```

### ✅ Pros of Document Model

1. **Schema Flexibility**
   ```json
   // Doc 1: Basic product
   {"name": "Mouse", "price": 29.99}
   
   // Doc 2: Product with specs (no schema change needed!)
   {"name": "Laptop", "price": 999.99, "specs": {"ram": "16GB"}}
   ```

2. **Nested Objects**
   - Natural JSON structure
   - No JOIN needed (unlike SQL)
   - Fast retrieval (single read)

3. **Self-Contained**
   - Each document has all needed data
   - No foreign keys to resolve
   - Perfect for microservices

4. **Easy Replication**
   - Documents are independent
   - Simple to replicate across nodes
   - No referential integrity issues

5. **Version Control**
   - Built-in optimistic locking
   - Prevents lost updates
   - Easy conflict detection

### ❌ Cons of Document Model

1. **Data Duplication**
   ```json
   // Bad: Brand duplicated in every product
   {"name": "Laptop 1", "brand": {"id": 1, "name": "Dell", "country": "USA"}}
   {"name": "Laptop 2", "brand": {"id": 1, "name": "Dell", "country": "USA"}}
   
   // Better: Just store brand ID, denormalize strategically
   {"name": "Laptop 1", "brand_id": 1, "brand_name": "Dell"}
   ```
   - **Why:** No foreign keys, so data often duplicated
   - **Impact:** More storage, harder to update
   - **Solution:** Denormalize only frequently accessed fields

2. **Update Complexity**
   ```bash
   # If brand name changes, must update ALL products
   POST /products/_update_by_query
   {
     "script": {
       "source": "ctx._source.brand_name = 'Dell Technologies'",
       "lang": "painless"
     },
     "query": {
       "term": {"brand_id": 1}
     }
   }
   ```
   - **Why:** Denormalized data
   - **Impact:** Expensive bulk updates
   - **Solution:** Accept eventual consistency

3. **No Transactions**
   - Can't update multiple documents atomically
   - **Example:** Transfer money (debit + credit) → Not safe!
   - **Solution:** Use external system for transactional data

4. **Size Limits**
   - Default max: 100MB per document
   - **Why:** Large docs slow down indexing/searching
   - **Solution:** Split large docs into multiple smaller ones

5. **No Foreign Keys**
   - No referential integrity
   - Orphaned data possible
   - **Solution:** Handle in application layer

### 💡 Best Practices

**✅ DO:**
```json
// Use meaningful IDs
{"_id": "product-laptop-dell-xps-13"}

// Store commonly accessed nested data
{"name": "Laptop", "brand": "Dell", "specs": {"ram": "16GB"}}

// Use arrays for multi-valued fields
{"tags": ["electronics", "computing", "mobile"]}

// Include timestamps
{"created_at": "2026-01-25T10:30:00Z", "updated_at": "2026-01-25T10:30:00Z"}
```

**❌ DON'T:**
```json
// Don't store huge nested objects (use parent-child instead)
{"product": {...}, "reviews": [/* 10000 reviews */]}

// Don't use documents for transactional data
{"account": "123", "balance": 1000} // Use SQL database!

// Don't store unnecessary data
{"_source": false, "store": true} // Only if you really need this optimization
```

### When to Use Documents?

**✅ Perfect For:**
- Search applications (products, articles, logs)
- Content management systems
- Catalog data (products, users, items)
- Log/event data (append-only)
- Real-time analytics

**❌ Not Ideal For:**
- Financial transactions (use SQL)
- Relational data with many JOINs
- Frequently updated counters
- Data requiring strict ACID compliance

---

## 📚 Indices

**Index** = Collection of documents (like a table in SQL, but more flexible)

### Index Structure

```
Index: "products"
│
├── Document 1: {id: "1", name: "Laptop", ...}
├── Document 2: {id: "2", name: "Mouse", ...}
└── Document 3: {id: "3", name: "Keyboard", ...}
```

### Naming Conventions

✅ **Good names:**
- `products-2026-01`
- `logs-app-production`
- `users_v2`

❌ **Bad names:**
- `Products` (don't use uppercase)
- `my index` (no spaces)
- `.internal` (reserved for system)

### Index Operations

```bash
# CREATE index
PUT /products
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 2
  }
}

# GET index info
GET /products

# DELETE index
DELETE /products

# List all indices
GET /_cat/indices?v

# Check index health
GET /_cluster/health/products
```

### Index vs Database Table

| SQL | Elasticsearch |
|-----|---------------|
| Database | Cluster |
| Table | Index |
| Row | Document |
| Column | Field |
| Schema | Mapping |
| SELECT | Query DSL |
| INSERT | Index Document |
| UPDATE | Update API |
| DELETE | Delete API |

---

## 🔍 Inverted Index

**Inverted Index** = Core data structure enabling fast full-text search

### How It Works

**Original Documents:**
```
Doc 1: "The quick brown fox"
Doc 2: "The fox is brown"
Doc 3: "Quick dogs are awesome"
```

**Inverted Index:**
```
Term      → Document IDs
-----------|---------------
the       → [1, 2]
quick     → [1, 3]
brown     → [1, 2]
fox       → [1, 2]
is        → [2]
dogs      → [3]
are       → [3]
awesome   → [3]
```

### Why It's Fast

**Without Inverted Index (Full Scan):**
```
Query: "quick fox"
→ Scan ALL documents, check if they contain both terms
→ O(n) complexity - slow!
```

**With Inverted Index:**
```
Query: "quick fox"
→ Lookup "quick" → [1, 3]
→ Lookup "fox"   → [1, 2]
→ Intersection   → [1]
→ O(1) lookup - instant!
```

### Index Segments

Elasticsearch creates immutable **segments**:

```
Index: "products"
│
├── Segment 1 (10,000 docs)
├── Segment 2 (5,000 docs)
└── Segment 3 (2,000 docs) ← New docs
```

**Segment Merging:**
- Background process merges small segments
- Improves search performance
- Deletes marked documents

---

## 🧩 Shards

**Shard** = Subdivision of an index (enables horizontal scaling)

### Why Shards Exist?

**The Core Problem:**
```
Single Machine Limitations:
- RAM: 64GB
- Disk: 2TB
- CPU: 16 cores

But your index:
- Size: 10TB (can't fit on one machine!)
- Data: 10 billion documents
- Growth: +100GB per day
```

**The Solution:** Split the index into smaller pieces (shards) across multiple machines.

### How Sharding Works

**Single Index (No Sharding):**
```
Machine 1: [All 10TB data] ❌ Doesn't fit!
```

**Sharded Index:**
```
Index: "logs" (10TB total)
│
├── Shard 0 (2TB) → Node A ✅
├── Shard 1 (2TB) → Node B ✅
├── Shard 2 (2TB) → Node C ✅
├── Shard 3 (2TB) → Node D ✅
└── Shard 4 (2TB) → Node E ✅
```

**Document Distribution:**
```
When you index a document:
1. Elasticsearch calculates: shard = hash(document_id) % number_of_shards
2. Routes document to specific shard
3. Shard is immutable (can't change number later!)

Example:
hash("doc-123") % 5 = 2 → Shard 2
hash("doc-456") % 5 = 0 → Shard 0
hash("doc-789") % 5 = 4 → Shard 4
```

### Primary vs Replica Shards

```
┌─────────────────────────────────────┐
│          Index "products"           │
├─────────────────────────────────────┤
│  Primary Shards:     3              │
│  Replica Shards:     2              │
│  Total Shards:       3 + (3×2) = 9  │
└─────────────────────────────────────┘

Cluster with 3 Nodes:

Node 1:  [P0] [R1] [R2]
Node 2:  [P1] [R0] [R2]
Node 3:  [P2] [R0] [R1]

P0 = Primary Shard 0
R1 = Replica of Shard 1
R2 = Replica of Shard 2
```

**Why This Layout?**
- Each node has 3 shards (balanced)
- Each primary has 2 replicas (on different nodes)
- Can lose ANY 1 node without data loss
- Searches distributed across all 9 shards

### Shard Sizing Best Practices

**Golden Rules:**
- ✅ **Shard size:** 10GB - 50GB optimal
- ✅ **Max shard size:** < 50GB for best performance
- ✅ **Shards per node:** < 20 per GB heap
- ✅ **Total shards:** As few as possible

**Why These Numbers?**

**1. Why 10-50GB per shard?**
```
Too Small (<10GB):
- Overhead: Each shard needs memory
- Example: 1000 tiny shards = 1000× overhead
- Slow: Query must check many shards

Too Large (>50GB):
- Recovery: Takes hours to recover 200GB shard
- Memory: Can't fit hot data in cache
- Snapshots: Slow backup/restore
```

**2. Why < 20 shards per GB heap?**
```
32GB heap:
- Max shards: 32 × 20 = 640 shards
- Why: Each shard needs ~50MB heap

Too many shards:
- Circuit breaker trips
- OutOfMemoryError
- Cluster instability
```

### ✅ Pros of Sharding

1. **Horizontal Scalability**
   ```
   Month 1: 100GB → 3 nodes, 3 shards
   Month 6: 500GB → Same 3 nodes (shards grow to 167GB each)
   Month 12: 1TB → Add 2 nodes, data rebalances automatically
   ```
   - Add nodes → Elasticsearch redistributes shards
   - Near-linear scaling
   - No downtime during scaling

2. **Parallel Processing**
   ```
   Query: "search all logs"
   
   Without shards (1 node):
   - Process 1TB sequentially
   - Time: 10 seconds
   
   With 5 shards (5 nodes):
   - Each processes 200GB in parallel
   - Time: 2 seconds (5× faster!)
   ```

3. **High Availability**
   ```
   3 nodes, 3 shards, 1 replica:
   
   Node 1 fails ❌
   → Replicas on Node 2 & 3 promoted to primary
   → Zero data loss
   → Queries continue working
   ```

4. **Resource Distribution**
   - CPU: Searches use all nodes' CPUs
   - RAM: Combined RAM of all nodes
   - Disk: Combined disk space
   - Network: Parallel data transfer

5. **Faster Recovery**
   ```
   Single 1TB index:
   - Recovery time: 4 hours
   
   5 × 200GB shards:
   - Recover in parallel: 1 hour
   - 4× faster!
   ```

### ❌ Cons of Sharding

1. **Over-Sharding Problem**
   ```
   Bad Example:
   - Index: 10GB
   - Shards: 100 (100MB each)
   
   Problems:
   ❌ 100× overhead (each shard needs memory)
   ❌ Queries must check 100 shards (slow!)
   ❌ 100× files to manage
   ❌ Cluster state bloated
   
   Fix:
   - Index: 10GB
   - Shards: 1 ✅
   - Result: 100× less overhead!
   ```

2. **Under-Sharding Problem**
   ```
   Bad Example:
   - Index: 1TB
   - Shards: 1 (1TB shard)
   
   Problems:
   ❌ Can't distribute across nodes
   ❌ Single point of failure
   ❌ Recovery takes hours
   ❌ All queries hit one node (bottleneck)
   
   Fix:
   - Index: 1TB
   - Shards: 30 (33GB each) ✅
   - Result: Distributed, fast, reliable
   ```

3. **Cannot Change Shard Count**
   ```
   Created with 3 shards:
   PUT /products
   {
     "settings": {"number_of_shards": 3}
   }
   
   Later want to change to 10 shards:
   PUT /products/_settings
   {
     "number_of_shards": 10  // ❌ ERROR: Cannot change!
   }
   
   Why?
   - Hash routing depends on shard count
   - hash(doc_id) % 3 ≠ hash(doc_id) % 10
   - Would need to re-hash and move ALL documents
   
   Solution:
   - Reindex to new index with 10 shards
   - Or use ILM rollover
   ```

4. **Memory Overhead**
   ```
   Each shard consumes:
   - 50-100MB heap (minimum)
   - File handles
   - Thread pools
   - Circuit breakers
   
   1000 shards × 50MB = 50GB heap just for shards!
   
   With 32GB heap:
   - 25GB heap for shards
   - 7GB for caches and operations ❌ Not enough!
   ```

5. **Complex Shard Allocation**
   ```
   Problems:
   - Uneven shard distribution
   - Some nodes overloaded
   - Shard relocation during scaling
   - "Too many shards" errors
   
   Requires:
   - Careful capacity planning
   - Monitoring shard distribution
   - Rebalancing strategies
   ```

### Example Calculations

**Scenario 1: Small Index (10GB)**
```
Index size: 10GB
Target shard size: 30GB
→ Number of shards: 10 / 30 = 0.33 → 1 shard ✅

Why 1 shard?
- 10GB fits easily on one node
- Over-sharding adds unnecessary overhead
- Can still have replicas for HA

Result:
- 1 primary shard
- 2 replica shards
- Total: 3 shards across 3 nodes
```

**Scenario 2: Medium Index (300GB)**
```
Index size: 300GB
Target shard size: 30GB
→ Number of shards: 300 / 30 = 10 shards ✅

Cluster:
- 5 nodes
- 10 primary shards
- 1 replica per shard
- Total: 20 shards (4 per node)

Benefits:
- Load distributed across 5 nodes
- Can lose 1 node without data loss
- Each shard manageable size (30GB)
```

**Scenario 3: Large Index (3TB)**
```
Index size: 3TB
Target shard size: 30GB
→ Number of shards: 3000 / 30 = 100 shards ✅

Cluster:
- 20 nodes
- 100 primary shards (5 per node)
- 1 replica per shard
- Total: 200 shards (10 per node)

Considerations:
- 200 shards × 50MB = 10GB heap overhead
- Need 32GB+ heap per node
- Cluster state: ~10MB (100 shards metadata)
```

**Scenario 4: Time-Series Data (Logs)**
```
Strategy: Daily indices with rollover

logs-2026-01-25:
- Size: 50GB/day
- Shards: 2 (25GB each)
- Retention: 90 days

Total:
- 90 indices × 2 shards = 180 primary shards
- With 1 replica = 360 total shards
- 15 nodes × 24 shards/node = capacity for 360 shards ✅

Benefits:
- Delete old data by dropping indices (fast!)
- Queries on recent data only hit recent indices
- ILM automatically manages lifecycle
```

### 💡 Shard Strategy Decision Tree

```
┌─────────────────────────────────────┐
│   What's your index size?           │
└─────────────────────────────────────┘
              │
              ├── < 50GB
              │   └── Use 1 shard
              │       Reason: No point over-sharding
              │
              ├── 50GB - 500GB
              │   └── Index_size / 30GB = shard_count
              │       Example: 300GB / 30GB = 10 shards
              │
              ├── > 500GB
              │   └── Consider daily/monthly indices
              │       + ILM with rollover
              │       Each index: 2-5 shards
              │
              └── Time-series data (logs)
                  └── Daily indices with 1-3 shards
                      Auto-delete old indices
```

### When to Use What?

**Use Few Shards (<5) When:**
- ✅ Small index (<200GB)
- ✅ Low query volume
- ✅ Development/testing
- ✅ Single-tenant application

**Use Many Shards (>10) When:**
- ✅ Large index (>500GB)
- ✅ High query volume (need parallelism)
- ✅ Multi-node cluster
- ✅ Need fast recovery

**Use Time-Series Pattern When:**
- ✅ Append-only data (logs, metrics)
- ✅ Old data rarely accessed
- ✅ Can delete old data
- ✅ Daily/hourly data volumes

### Monitoring Shard Health

```bash
# Check shard distribution
GET /_cat/shards?v&h=index,shard,prirep,state,docs,store,node

# Check shard allocation
GET /_cluster/allocation/explain

# Shard stats
GET /_cat/allocation?v

# Why shard unassigned?
GET /_cluster/allocation/explain
{
  "index": "products",
  "shard": 0,
  "primary": true
}
```

**Red Flags:**
- ❌ UNASSIGNED shards (data inaccessible!)
- ❌ INITIALIZING shards stuck (check logs)
- ❌ Shards > 20 per GB heap
- ❌ Uneven distribution (some nodes overloaded)
- ❌ Shard size > 50GB (recovery takes too long)

---

## 🔄 Replicas

**Replica** = Copy of a primary shard (for high availability & read scaling)

### Why Replicas Exist?

**The Problems Without Replicas:**
```
Single Node Cluster:
- Node fails → All data lost ❌
- High query load → Single node bottleneck ❌
- Maintenance → Downtime required ❌
- Hardware failure → Service unavailable ❌
```

**The Solution:** Create copies (replicas) of each shard on different nodes.

### How Replication Works

**Synchronous Replication Process:**
```
1. Client sends write request
   ↓
2. Primary shard receives document
   ↓
3. Primary indexes document
   ↓
4. Primary forwards to ALL replicas
   ↓
5. Replicas acknowledge
   ↓
6. Primary responds to client

All replicas must confirm before success response!
```

### Replica Configuration

**Basic Setup:**
```bash
PUT /products
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 2
  }
}

Result:
- 3 primary shards
- 6 replica shards (3 × 2)
- Total: 9 shards
- Data copied 3 times (1 primary + 2 replicas)
```

**Dynamic Updates:**
```bash
# Increase replicas (more redundancy, more reads)
PUT /products/_settings
{
  "number_of_replicas": 2
}

# Decrease replicas (less storage, fewer reads)
PUT /products/_settings
{
  "number_of_replicas": 1
}

# No replicas (development only!)
PUT /products/_settings
{
  "number_of_replicas": 0
}
```

### Benefits Explained

**1. High Availability**
```
3 Nodes, 3 Shards, 2 Replicas:

Node 1: [P0] [R1] [R2]
Node 2: [P1] [R0] [R2]
Node 3: [P2] [R0] [R1]

Scenario: Node 1 crashes ❌
│
├─ Primary P0 lost
│  → Replica R0 on Node 2 promoted to primary ✅
│
├─ Replica R1 lost
│  → Still have P1 on Node 2 ✅
│
└─ Replica R2 lost
   → Still have P2 on Node 3 ✅

Result: Zero data loss, zero downtime! ✅
```

**2. Read Scalability**
```
No Replicas:
- All queries hit 3 primary shards
- Max throughput: 3 nodes × 1000 qps = 3,000 qps

With 2 Replicas:
- Queries distributed across 9 shards (3 primary + 6 replicas)
- Max throughput: 9 shards × 1000 qps = 9,000 qps
- 3× improvement! ✅

Formula:
Max QPS = (primaries + replicas) × QPS_per_shard
Max QPS = (3 + 6) × 1000 = 9,000
```

**3. Load Balancing**
```
Search request for Shard 0:

Elasticsearch routes to least busy copy:
┌─ P0 on Node 1 (CPU: 80%) ❌ Busy
├─ R0 on Node 2 (CPU: 40%) ✅ Selected!
└─ R0 on Node 3 (CPU: 60%)

Adaptive load balancing:
- Monitors node performance
- Routes to fastest responding shard
- Automatic failover if node slow/unresponsive
```

**4. Faster Recovery**
```
Scenario: Node 3 joins cluster

Without replicas:
- Must reindex ALL data from source
- Time: Hours to days
- Network: GB/s transfer

With replicas:
- Copy from existing replica
- Time: Minutes to hours
- Already in Elasticsearch format
- 10-100× faster! ✅
```

### ✅ Pros of Replicas

1. **Zero Downtime**
   ```
   Production Cluster:
   - 10 nodes, 3 primaries, 2 replicas
   - Can lose 2 nodes without data loss
   - Can lose 1 node with zero impact
   - Rolling restart: No downtime
   
   Availability: 99.99% (52 min downtime/year)
   ```

2. **Read Performance Boost**
   ```
   Real-World Example (E-commerce site):
   
   Before (0 replicas):
   - 3 nodes
   - 5,000 searches/sec
   - P95 latency: 200ms
   
   After (2 replicas):
   - 3 nodes (same!)
   - 15,000 searches/sec (3× throughput)
   - P95 latency: 80ms (faster!)
   
   Why?
   - More shards = more parallel processing
   - Load distributed across all nodes
   - Cache hits on different nodes
   ```

3. **Geographic Distribution**
   ```
   Multi-Region Setup:
   
   US-East:
   - Node 1: [P0] [R1] [R2]
   - Node 2: [P1] [R0] [R2]
   
   EU-West:
   - Node 3: [R0] [P2] [R1]
   
   Benefits:
   ✅ EU users query local replicas (low latency)
   ✅ US users query local replicas (low latency)
   ✅ Either region can fail without downtime
   ```

4. **Maintenance Without Downtime**
   ```
   Rolling Restart Process:
   
   1. Disable shard allocation
   2. Restart Node 1
      → Queries use replicas on Node 2 & 3 ✅
   3. Node 1 back online
   4. Restart Node 2
      → Queries use P on Node 1 & R on Node 3 ✅
   5. Repeat for all nodes
   
   Result: Zero query failures!
   ```

5. **Disaster Recovery**
   ```
   Snapshot vs Replicas:
   
   Snapshot (S3):
   - Recovery time: 2-4 hours
   - Network transfer: Slow
   - Cold backup: Old data
   
   Replicas (Live):
   - Recovery time: Instant (promote replica)
   - No transfer: Already in cluster
   - Hot backup: Real-time data
   
   Best Practice: Use both!
   - Replicas: Day-to-day failures
   - Snapshots: Cluster-wide disasters
   ```

### ❌ Cons of Replicas

1. **Storage Cost**
   ```
   Index: 1TB
   Replicas: 2
   Total Storage: 1TB × (1 + 2) = 3TB
   
   3× storage cost! 💰
   
   AWS Example:
   - 1TB EBS: $100/month
   - 3TB EBS: $300/month
   - Increase: $200/month
   
   Trade-off: Pay more for availability
   ```

2. **Write Performance Impact**
   ```
   Synchronous Replication:
   
   Write to 0 replicas:
   1. Write to primary: 10ms
   Total: 10ms
   
   Write to 2 replicas:
   1. Write to primary: 10ms
   2. Forward to replica 1: 5ms
   3. Forward to replica 2: 5ms
   4. Wait for ACKs: 2ms
   Total: 22ms (2.2× slower)
   
   Impact:
   - Indexing throughput reduced
   - More network traffic
   - Higher latency
   
   Mitigation:
   - Use async replication (if acceptable)
   - Optimize network (10Gbps+)
   - Batch writes
   ```

3. **Complexity**
   ```
   Issues to Manage:
   
   ❌ Replica lag (async mode)
   ❌ Split-brain scenarios
   ❌ Uneven shard distribution
   ❌ Replica not allocated (yellow cluster)
   ❌ Version conflicts
   
   Requires:
   - Monitoring
   - Alerting
   - Troubleshooting skills
   ```

4. **Network Bandwidth**
   ```
   Indexing 100GB/day:
   
   No replicas:
   - Network transfer: 100GB/day
   
   2 replicas:
   - Primary → Replica 1: 100GB
   - Primary → Replica 2: 100GB
   - Total: 300GB/day
   
   3× network usage!
   
   Requires:
   - High-bandwidth network (10Gbps+)
   - Low latency (<1ms)
   - Expensive network gear
   ```

5. **Not True Backup**
   ```
   What Replicas DON'T Protect Against:
   
   ❌ Accidental deletion
      DELETE /products → All replicas deleted!
   
   ❌ Corruption
      Bad mapping → All replicas affected!
   
   ❌ Malicious updates
      UPDATE all docs → Replicated everywhere!
   
   ❌ Cluster-wide failure
      Data center fire → All replicas gone!
   
   Solution: Also use snapshots!
   ```

### Replication Strategies

**Strategy 1: Production (High Availability)**
```bash
PUT /critical-data
{
  "settings": {
    "number_of_replicas": 2  # Can lose 2 nodes
  }
}

Use when:
✅ Production systems
✅ High query volume
✅ Cannot tolerate downtime
✅ Budget allows

Cost: 3× storage
Availability: 99.99%
```

**Strategy 2: Standard (Balanced)**
```bash
PUT /normal-data
{
  "settings": {
    "number_of_replicas": 1  # Can lose 1 node
  }
}

Use when:
✅ Most production use cases
✅ Moderate query volume
✅ Cost-conscious
✅ Some risk acceptable

Cost: 2× storage
Availability: 99.9%
```

**Strategy 3: Development (No Redundancy)**
```bash
PUT /dev-data
{
  "settings": {
    "number_of_replicas": 0  # No protection!
  }
}

Use when:
✅ Development only
✅ Test data
✅ Can recreate data easily
✅ Single developer

Cost: 1× storage
Availability: 90% (frequent downtime)
```

**Strategy 4: Read-Heavy (Max Read Performance)**
```bash
PUT /read-heavy-data
{
  "settings": {
    "number_of_replicas": 3  # Many copies
  }
}

Use when:
✅ Read:write ratio > 100:1
✅ Low write volume
✅ Global audience
✅ Need low latency everywhere

Cost: 4× storage
Read QPS: 4× primary-only
```

### Real-World Replica Configuration

**Example 1: E-Commerce Site**
```
Product Catalog:
- Writes: 1,000/hour (new products)
- Reads: 1,000,000/hour (searches)
- Read:Write ratio: 1000:1
- Configuration: 2 replicas ✅

Why 2?
- High read volume needs parallel processing
- Product data is critical (need HA)
- Can afford 3× storage
- 3× read throughput
```

**Example 2: Logging System**
```
Application Logs:
- Writes: 100,000/sec (high!)
- Reads: 1,000/sec (low)
- Read:Write ratio: 1:100
- Configuration: 1 replica ✅

Why 1?
- Write performance critical
- Can lose some log data (not critical)
- 2× storage acceptable
- Delete old logs anyway (7-day retention)
```

**Example 3: Analytics Dashboard**
```
Metrics Data:
- Writes: 10,000/sec
- Reads: 100/sec
- Read:Write ratio: 1:100
- Configuration: 0 replicas, snapshots hourly

Why 0?
- Write performance most important
- Can reindex from source if needed
- Use snapshots for backup
- Reduce cost (1× storage)
```

### Monitoring Replicas

```bash
# Check replica status
GET /_cat/indices?v&h=index,health,pri,rep

# Why replica unassigned?
GET /_cluster/allocation/explain

# Replica stats
GET /products/_stats

# Force replica allocation
POST /_cluster/reroute
{
  "commands": [{
    "allocate_replica": {
      "index": "products",
      "shard": 0,
      "node": "node-2"
    }
  }]
}
```

**Health Status Colors:**
- 🟢 **Green:** All primaries + replicas allocated
- 🟡 **Yellow:** All primaries allocated, some replicas missing
  - Not critical: Data accessible
  - Warning: Less redundancy
- 🔴 **Red:** Some primaries unassigned
  - Critical: Data inaccessible!
  - Immediate action required

### 💡 Replica Best Practices

**✅ DO:**
- Use 1-2 replicas for production
- Increase replicas for read-heavy workloads
- Monitor replica lag (async mode)
- Test failover scenarios
- Use snapshots + replicas (defense in depth)

**❌ DON'T:**
- Use 0 replicas in production
- Use more than 3 replicas (diminishing returns)
- Forget about network bandwidth
- Assume replicas = backups
- Over-replicate write-heavy indices

---

## 🗺️ Mapping

**Mapping** = Schema definition (field types and how to index them)

### Dynamic vs Explicit Mapping

**Dynamic Mapping (Auto-detect):**
```bash
POST /products/_doc
{
  "name": "Laptop",        # → text
  "price": 999.99,         # → float
  "quantity": 10,          # → long
  "available": true,       # → boolean
  "created": "2026-01-25"  # → date
}
```

**Explicit Mapping (Recommended):**
```bash
PUT /products
{
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "analyzer": "standard"
      },
      "brand": {
        "type": "keyword"
      },
      "price": {
        "type": "float"
      },
      "quantity": {
        "type": "integer"
      },
      "available": {
        "type": "boolean"
      },
      "created": {
        "type": "date"
      },
      "description": {
        "type": "text",
        "analyzer": "english"
      },
      "tags": {
        "type": "keyword"
      },
      "specs": {
        "type": "object",
        "properties": {
          "ram": {"type": "keyword"},
          "cpu": {"type": "keyword"}
        }
      }
    }
  }
}
```

### View Mapping

```bash
GET /products/_mapping
```

---

## 🔬 Analyzers

**Analyzer** = Processes text into searchable terms

### Analysis Process

```
Input: "The Quick BROWN fox!"
│
├─ Character Filter: Remove HTML, symbols
│  → "The Quick BROWN fox"
│
├─ Tokenizer: Split into words
│  → ["The", "Quick", "BROWN", "fox"]
│
└─ Token Filters: Lowercase, remove stopwords, stem
   → ["quick", "brown", "fox"]

Stored in inverted index: quick, brown, fox
```

### Built-in Analyzers

#### 1. Standard (Default)
```
"The Quick BROWN fox!"
→ ["the", "quick", "brown", "fox"]
```

#### 2. Simple
```
"The Quick BROWN fox!"
→ ["the", "quick", "brown", "fox"]
(splits on non-letters)
```

#### 3. Whitespace
```
"The Quick BROWN fox!"
→ ["The", "Quick", "BROWN", "fox!"]
(only splits on whitespace)
```

#### 4. English
```
"running quickly foxes"
→ ["run", "quick", "fox"]
(stemming + stopwords)
```

### Test Analyzer

```bash
POST /_analyze
{
  "analyzer": "standard",
  "text": "The Quick BROWN fox!"
}

# Response:
{
  "tokens": [
    {"token": "the", "start_offset": 0, "end_offset": 3},
    {"token": "quick", "start_offset": 4, "end_offset": 9},
    {"token": "brown", "start_offset": 10, "end_offset": 15},
    {"token": "fox", "start_offset": 16, "end_offset": 19}
  ]
}
```

### Custom Analyzer

```bash
PUT /products
{
  "settings": {
    "analysis": {
      "analyzer": {
        "my_custom_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "char_filter": ["html_strip"],
          "filter": ["lowercase", "stop", "snowball"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "description": {
        "type": "text",
        "analyzer": "my_custom_analyzer"
      }
    }
  }
}
```

---

## 📊 Data Types

### Core Data Types

#### Text
```json
{
  "description": {
    "type": "text",
    "analyzer": "standard"
  }
}
```
- Full-text search
- Analyzed (tokenized)
- Use for: Descriptions, content, logs

#### Keyword
```json
{
  "brand": {
    "type": "keyword"
  }
}
```
- Exact match only
- Not analyzed
- Use for: Tags, IDs, categories, emails

#### Numeric
```json
{
  "price": {"type": "float"},
  "quantity": {"type": "integer"},
  "views": {"type": "long"}
}
```
- Types: long, integer, short, byte, double, float, half_float

#### Date
```json
{
  "created": {
    "type": "date",
    "format": "yyyy-MM-dd HH:mm:ss"
  }
}
```
- ISO 8601 format
- Stored as milliseconds since epoch
- Supports date math

#### Boolean
```json
{
  "available": {"type": "boolean"}
}
```
- Values: true, false, "true", "false"

### Complex Data Types

#### Object
```json
{
  "user": {
    "type": "object",
    "properties": {
      "first_name": {"type": "text"},
      "last_name": {"type": "text"}
    }
  }
}

// Document:
{
  "user": {
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

#### Nested
```json
{
  "comments": {
    "type": "nested",
    "properties": {
      "author": {"type": "keyword"},
      "message": {"type": "text"},
      "date": {"type": "date"}
    }
  }
}

// Document:
{
  "comments": [
    {"author": "John", "message": "Great!", "date": "2026-01-25"},
    {"author": "Jane", "message": "Nice", "date": "2026-01-26"}
  ]
}
```

#### Array
```json
{
  "tags": {"type": "keyword"}
}

// Document:
{
  "tags": ["laptop", "electronics", "computing"]
}
```

---

## 🌐 Clusters & Nodes

### Cluster

**Cluster** = Collection of nodes storing all data

```
Cluster: "production-cluster"
│
├── Node 1 (Master-eligible, Data)
├── Node 2 (Data)
├── Node 3 (Data)
└── Node 4 (Coordinating)
```

### Cluster Health

```bash
GET /_cluster/health

{
  "cluster_name": "production-cluster",
  "status": "green",  # green, yellow, or red
  "number_of_nodes": 4,
  "number_of_data_nodes": 3,
  "active_primary_shards": 10,
  "active_shards": 30,
  "relocating_shards": 0,
  "initializing_shards": 0,
  "unassigned_shards": 0
}
```

**Status Colors:**
- 🟢 **Green:** All primary + replica shards active
- 🟡 **Yellow:** All primaries active, some replicas missing
- 🔴 **Red:** Some primary shards missing (data loss!)

### Node Roles

#### Master Node
```yaml
node.roles: [master]
```
- Manages cluster state
- Creates/deletes indices
- Tracks node membership
- 3 master-eligible nodes recommended

#### Data Node
```yaml
node.roles: [data]
```
- Stores documents
- Executes searches
- Performs aggregations
- Most resource-intensive

#### Coordinating Node
```yaml
node.roles: []
```
- Routes requests
- Distributes searches
- Merges results
- Like a load balancer

#### Ingest Node
```yaml
node.roles: [ingest]
```
- Pre-processes documents
- Runs ingest pipelines
- Transforms data before indexing

---

## 📈 Term Frequency & Relevance

### TF-IDF (Term Frequency-Inverse Document Frequency)

**Formula:**
```
Score = TF × IDF

TF  = How often term appears in document
IDF = How rare term is across all documents
```

### Example

**Documents:**
```
Doc 1: "elasticsearch is awesome"
Doc 2: "elasticsearch is powerful"
Doc 3: "lucene is powerful"
```

**Query:** "elasticsearch powerful"

**Scoring:**

| Term | Doc 1 TF | Doc 2 TF | Doc 3 TF | IDF (rarity) |
|------|----------|----------|----------|--------------|
| elasticsearch | 1 | 1 | 0 | medium (2/3 docs) |
| powerful | 0 | 1 | 1 | medium (2/3 docs) |

**Result Scores:**
```
Doc 2: High score (has both terms)
Doc 1: Medium score (has "elasticsearch")
Doc 3: Medium score (has "powerful")
```

### BM25 (Modern Algorithm)

Elasticsearch 8.x uses **BM25** (improvement over TF-IDF):
- Considers document length
- Diminishing returns for repeated terms
- Better scoring for real-world data

```bash
GET /products/_search
{
  "query": {
    "match": {
      "description": "fast laptop"
    }
  },
  "explain": true  # See score calculation
}
```

---

## 🎯 Key Takeaways

### Essential Concepts

1. ✅ **Documents** = JSON objects stored in indices
2. ✅ **Indices** = Collections of documents
3. ✅ **Inverted Index** = Data structure enabling fast search
4. ✅ **Shards** = Subdivisions for horizontal scaling
5. ✅ **Replicas** = Copies for HA and read scaling
6. ✅ **Mapping** = Schema (field types)
7. ✅ **Analyzers** = Text processing pipeline
8. ✅ **Cluster** = Multiple nodes working together
9. ✅ **Relevance** = TF-IDF/BM25 scoring

### Mental Model

```
Cluster
│
├── Node 1
│   ├── Index: products
│   │   ├── Shard 0 (Primary)
│   │   │   ├── Segment 1 (Inverted Index)
│   │   │   └── Segment 2
│   │   └── Shard 1 (Replica)
│   │
│   └── Index: logs
│       └── ...
│
└── Node 2
    └── ...
```

---

## 📚 Next Steps

- ✅ Completed **CONCEPTS.md** ← You are here
- ➡️ Next: [ARCHITECTURE.md](./ARCHITECTURE.md) - Cluster architecture
- 📖 Then: [SEARCH-IMPLEMENTATION.md](./SEARCH-IMPLEMENTATION.md) - Search and query DSL

---

*Last Updated: January 25, 2026*
