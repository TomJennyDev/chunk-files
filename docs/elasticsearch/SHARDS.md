# Elasticsearch Shards - Hướng Dẫn Chi Tiết

> **Sharding** là cơ chế phân chia index thành nhiều phần nhỏ hơn để đạt được horizontal scaling và high performance trong Elasticsearch.

---

## 📋 Mục Lục

1. [Shard là gì?](#shard-là-gì)
2. [Tại sao cần Sharding?](#tại-sao-cần-sharding)
3. [Cách hoạt động của Sharding](#cách-hoạt-động-của-sharding)
4. [Primary vs Replica Shards](#primary-vs-replica-shards)
5. [Shard Allocation](#shard-allocation)
6. [Shard Sizing](#shard-sizing)
7. [Shard Routing](#shard-routing)
8. [Ưu điểm của Sharding](#ưu-điểm-của-sharding)
9. [Nhược điểm của Sharding](#nhược-điểm-của-sharding)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## 🧩 Shard là gì?

**Shard** là:
- **Subdivision** (phần nhỏ) của một index
- **Independent Lucene index** (có thể hoạt động độc lập)
- **Unit of scalability** (đơn vị mở rộng)
- **Building block** của distributed system

### Ví dụ trực quan:

```
Index "products" (1TB data)
│
├── Shard 0 (200GB)  →  Node A
├── Shard 1 (200GB)  →  Node B
├── Shard 2 (200GB)  →  Node C
├── Shard 3 (200GB)  →  Node D
└── Shard 4 (200GB)  →  Node E

Mỗi shard là một Lucene index đầy đủ chức năng
```

---

## 🤔 Tại sao cần Sharding?

### Vấn đề 1: **Size Limitation**

```
Single Machine:
┌──────────────────────┐
│   RAM: 64GB          │
│   Disk: 2TB          │
│   CPU: 16 cores      │
└──────────────────────┘

Your Index:
- Size: 10TB  ❌ Không fit vào 1 machine!
- Documents: 10 billion
- Growth: +100GB/day

Problem: Can't store all data on one machine!
```

**Solution với Sharding:**
```
Index: 10TB
Shards: 5 × 2TB each
┌────────────┐  ┌────────────┐  ┌────────────┐
│  Shard 0   │  │  Shard 1   │  │  Shard 2   │
│   2TB      │  │   2TB      │  │   2TB      │
│  Node A    │  │  Node B    │  │  Node C    │
└────────────┘  └────────────┘  └────────────┘

┌────────────┐  ┌────────────┐
│  Shard 3   │  │  Shard 4   │
│   2TB      │  │   2TB      │
│  Node D    │  │  Node E    │
└────────────┘  └────────────┘

✅ Data distributed across 5 nodes!
```

### Vấn đề 2: **Performance Bottleneck**

```
Without Sharding (Single Node):
┌─────────────────────────┐
│    All 10TB data        │
│    All queries hit      │
│    this one node        │
│    Bottleneck! 🔥       │
└─────────────────────────┘
Max QPS: 1,000 queries/sec
```

**Solution với Sharding:**
```
With 5 Shards (5 Nodes):
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│Shard0│  │Shard1│  │Shard2│  │Shard3│  │Shard4│
│ 1K   │  │ 1K   │  │ 1K   │  │ 1K   │  │ 1K   │
│QPS   │  │QPS   │  │QPS   │  │QPS   │  │QPS   │
└──────┘  └──────┘  └──────┘  └──────┘  └──────┘

Total QPS: 5,000 queries/sec ✅ (5× improvement!)
```

### Vấn đề 3: **No Horizontal Scaling**

```
Without Sharding:
Month 1:  100GB → 1 node (OK)
Month 6:  500GB → 1 node (Slow! 😰)
Month 12: 1TB   → 1 node (Can't handle! 💥)

Only solution: Vertical scaling (bigger machine) 💰💰💰
```

**Solution với Sharding:**
```
With Sharding:
Month 1:  100GB → 3 nodes, 3 shards (33GB each)
Month 6:  500GB → 3 nodes, 3 shards (167GB each) 
Month 12: 1TB   → Add 2 more nodes! (5 nodes, data rebalances)

Horizontal scaling: Add more nodes ✅
```

---

## ⚙️ Cách hoạt động của Sharding

### 1. **Document Distribution** (Phân phối documents)

Elasticsearch sử dụng **consistent hashing** để quyết định document đi vào shard nào:

```javascript
shard_number = hash(document_id) % number_of_primary_shards
```

**Ví dụ:**
```
Index có 3 shards (0, 1, 2)

Document ID: "product-001"
hash("product-001") = 12345
12345 % 3 = 0  →  Shard 0 ✅

Document ID: "product-002"
hash("product-002") = 67890
67890 % 3 = 0  →  Shard 0 ✅

Document ID: "product-003"
hash("product-003") = 24680
24680 % 3 = 1  →  Shard 1 ✅

Document ID: "product-004"
hash("product-004") = 13579
13579 % 3 = 2  →  Shard 2 ✅
```

**Key Point:** 
- ⚠️ **Shard count CANNOT be changed** after index creation!
- **Why?** Hash formula depends on shard count
- Changing shards → Must rehash ALL documents → Must reindex!

### 2. **Query Distribution** (Phân phối queries)

#### **Get by ID (Direct routing):**
```
GET /products/_doc/product-003

1. Calculate shard: hash("product-003") % 3 = 1
2. Route to Shard 1 directly
3. Return document

✅ Only 1 shard queried! Super fast!
```

#### **Search Query (Fan-out):**
```
GET /products/_search
{
  "query": {"match": {"name": "laptop"}}
}

1. Coordinate node receives request
2. Fan-out to ALL shards (0, 1, 2)
3. Each shard searches locally
4. Coordinate node merges results
5. Return top results

All shards queried, but parallel! ✅
```

**Query Flow:**
```
                    Client
                      │
                      ├─ GET /products/_search
                      ↓
              Coordinate Node
            ┌──────┴──────┬──────┐
            ↓              ↓      ↓
        Shard 0        Shard 1  Shard 2
        Node A         Node B   Node C
          │              │        │
    [5 results]    [5 results] [5 results]
          │              │        │
          └──────┬───────┴────────┘
                 ↓
          Coordinate Node
        (Merge + Sort + Rank)
                 │
           [Top 10 results]
                 ↓
              Client
```

### 3. **Write Distribution**

```
POST /products/_doc
{
  "name": "Laptop",
  "price": 999
}

1. Client sends to any node (coordinate node)
2. Calculate shard: hash(auto_id) % 3 = 1
3. Route to primary shard 1 (Node B)
4. Primary shard 1 indexes document
5. Replicate to replica shards
6. Acknowledge to client

✅ Write complete!
```

---

## 🔄 Primary vs Replica Shards

### Primary Shard

**Đặc điểm:**
- **Original** shard chứa data
- **Handles writes** (nhận tất cả write operations)
- **Handles reads** (cùng với replicas)
- **Cannot change count** sau khi tạo index

```bash
PUT /products
{
  "settings": {
    "number_of_shards": 3  # 3 primary shards
  }
}
```

### Replica Shard

**Đặc điểm:**
- **Copy** của primary shard
- **Read-only** (không nhận writes trực tiếp)
- **Handles reads** (load balancing)
- **Failover** (promoted to primary nếu primary fail)
- **CAN change count** bất cứ lúc nào

```bash
PUT /products
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 2  # 2 replicas per primary
  }
}

Total shards = 3 primaries + (3 × 2) replicas = 9 shards
```

### Shard Distribution Example:

```
3 Nodes, 3 Primary Shards, 2 Replicas:

Node 1:  [P0]  [R1]  [R2]
Node 2:  [P1]  [R0]  [R2]
Node 3:  [P2]  [R0]  [R1]

Legend:
P0 = Primary Shard 0
R1 = Replica of Shard 1
```

**Benefits:**
- ✅ Each primary has 2 backups (3 copies total)
- ✅ Can lose ANY 2 nodes without data loss
- ✅ Load distributed across 9 shards
- ✅ High availability + High performance

### Failover Scenario:

```
Initial State:
Node 1:  [P0]  [R1]  [R2]
Node 2:  [P1]  [R0]  [R2]
Node 3:  [P2]  [R0]  [R1]

Node 1 fails! 💥
Node 2:  [P1]  [R0→P0]  [R2]  (R0 promoted to P0!)
Node 3:  [P2]  [R0]     [R1]

Cluster Status: YELLOW (missing replicas)
Data Status: ✅ ALL DATA ACCESSIBLE!

Elasticsearch reallocates missing replicas:
Node 2:  [P1]  [P0]  [R2]  [new R1]
Node 3:  [P2]  [R0]  [R1]  [new R2]

Cluster Status: GREEN ✅
```

---

## 📍 Shard Allocation

### Allocation Decision Process:

```
New shard needs allocation:

1. Is there a node with same shard? ❌ (avoid)
2. Does node have enough disk space? ✅
3. Does node have enough memory? ✅
4. Is node not too busy? ✅
5. Allocation filters met? ✅

→ Allocate to this node! ✅
```

### Allocation Settings:

#### 1. **Disk-based Allocation**

```bash
PUT /_cluster/settings
{
  "persistent": {
    "cluster.routing.allocation.disk.threshold_enabled": true,
    "cluster.routing.allocation.disk.watermark.low": "85%",
    "cluster.routing.allocation.disk.watermark.high": "90%",
    "cluster.routing.allocation.disk.watermark.flood_stage": "95%"
  }
}
```

**Thresholds:**
- **Low (85%):** No new shards allocated to this node
- **High (90%):** Relocate shards away from this node
- **Flood (95%):** Block all writes to indices on this node! ⚠️

#### 2. **Shard Allocation Awareness**

**Data Center Awareness:**
```bash
# Node in DC1:
node.attr.zone: dc1

# Node in DC2:
node.attr.zone: dc2

# Cluster settings:
PUT /_cluster/settings
{
  "persistent": {
    "cluster.routing.allocation.awareness.attributes": "zone"
  }
}
```

**Result:**
```
DC1:  [P0]  [R1]  [R2]
DC2:  [P1]  [R0]  [P2]

✅ Primary and replica NEVER in same DC!
✅ Can lose entire DC without data loss!
```

#### 3. **Shard Allocation Filtering**

```bash
# Only allocate specific index to hot nodes
PUT /logs-2026-01/_settings
{
  "index.routing.allocation.require.box_type": "hot"
}

# Exclude specific nodes
PUT /logs-old/_settings
{
  "index.routing.allocation.exclude._name": "node1,node2"
}

# Include only specific nodes
PUT /critical-data/_settings
{
  "index.routing.allocation.include.box_type": "ssd"
}
```

### Manual Shard Allocation:

```bash
# Force allocate unassigned shard
POST /_cluster/reroute
{
  "commands": [
    {
      "allocate_replica": {
        "index": "products",
        "shard": 0,
        "node": "node-3"
      }
    }
  ]
}

# Move shard from one node to another
POST /_cluster/reroute
{
  "commands": [
    {
      "move": {
        "index": "products",
        "shard": 0,
        "from_node": "node-1",
        "to_node": "node-2"
      }
    }
  ]
}
```

---

## 📏 Shard Sizing

### Golden Rules:

```
✅ Shard size: 10-50GB (optimal)
✅ Max shard size: < 50GB
✅ Shards per node: < 20 per GB heap
✅ Total shards: As few as possible
```

### Why These Numbers?

#### **Too Small Shards (<10GB):**

```
Example: 100GB index with 100 shards (1GB each)

Problems:
❌ 100× overhead (each shard = 50MB heap)
❌ Query must check 100 shards (slow!)
❌ 100× file handles
❌ Cluster state bloated

Memory: 100 shards × 50MB = 5GB heap just for shards! 💥
```

#### **Too Large Shards (>50GB):**

```
Example: 1TB index with 1 shard (1TB shard!)

Problems:
❌ Can't distribute across nodes
❌ Recovery takes hours (if shard fails)
❌ All queries hit one shard (bottleneck)
❌ Can't fit hot data in cache

Recovery time: 1TB shard = 4-6 hours! ⏰
```

#### **Optimal Shard Size (10-50GB):**

```
Example: 1TB index with 30 shards (33GB each)

Benefits:
✅ Distributed across many nodes
✅ Fast recovery (30-60 min per shard)
✅ Queries parallelized (30 shards working)
✅ Hot data fits in cache
✅ Reasonable overhead (30 × 50MB = 1.5GB heap)

Perfect! ✅
```

### Shard Count Calculations:

#### **Method 1: By Size**

```
Formula:
number_of_shards = index_size_gb / target_shard_size_gb

Examples:
10GB index:
10 / 30 = 0.33 → 1 shard ✅

300GB index:
300 / 30 = 10 shards ✅

1TB index:
1000 / 30 = 33 shards ✅

10TB index:
10000 / 30 = 333 shards ❌ Too many!
→ Use time-based indices (daily/monthly)
```

#### **Method 2: By Documents**

```
Formula:
number_of_shards = total_documents / target_docs_per_shard

Target: 25-50 million docs per shard

Examples:
10 million docs:
10M / 25M = 0.4 → 1 shard ✅

200 million docs:
200M / 25M = 8 shards ✅

1 billion docs:
1000M / 25M = 40 shards ✅
```

#### **Method 3: By Nodes**

```
Formula:
number_of_shards = number_of_nodes × shards_per_node

Target: 1-3 shards per node

Examples:
3 nodes:
3 × 1 = 3 shards ✅

10 nodes:
10 × 2 = 20 shards ✅
```

### Shards per GB Heap:

```
Rule: < 20 shards per GB heap

32GB heap:
Max shards = 32 × 20 = 640 shards ✅

16GB heap:
Max shards = 16 × 20 = 320 shards ✅

8GB heap:
Max shards = 8 × 20 = 160 shards ✅

Exceeding limit:
❌ Circuit breaker trips
❌ OutOfMemoryError
❌ Cluster instability
```

---

## 🧭 Shard Routing

### Default Routing (by _id):

```javascript
shard = hash(_id) % number_of_primary_shards
```

**Example:**
```bash
POST /products/_doc/laptop-001
{
  "name": "Laptop"
}

# Elasticsearch calculates:
shard = hash("laptop-001") % 3
      = 12345 % 3
      = 0

# Document goes to Shard 0 ✅
```

### Custom Routing:

**Use Case:** Group related documents in same shard

```bash
# Index documents with custom routing
POST /orders/_doc/order-001?routing=user-123
{
  "user_id": "user-123",
  "amount": 99.99
}

POST /orders/_doc/order-002?routing=user-123
{
  "user_id": "user-123",
  "amount": 149.99
}

# Both orders go to SAME shard ✅
# shard = hash("user-123") % 3
```

**Benefits:**
```
GET /orders/_search?routing=user-123
{
  "query": {
    "term": {"user_id": "user-123"}
  }
}

✅ Only queries 1 shard (faster!)
❌ Without routing: queries ALL shards
```

**Caution:**
```
⚠️ Uneven distribution if routing values not diverse
⚠️ All docs with same routing → Same shard → Hotspot!

Example:
1000 users, but 1 user has 1 million docs
→ One shard huge, others small
→ Unbalanced cluster!
```

### Routing Shards (Split Capability):

```bash
PUT /products
{
  "settings": {
    "number_of_shards": 3,
    "number_of_routing_shards": 30
  }
}
```

**Purpose:** Enable future shard splitting

```
Initial: 3 shards
routing_shards: 30

Can split to:
- 6 shards (30 / 5 = 6)
- 10 shards (30 / 3 = 10)
- 15 shards (30 / 2 = 15)
- 30 shards (30 / 1 = 30)

Cannot split to:
❌ 4 shards (30 / 4 = 7.5 not integer)
❌ 7 shards (30 / 7 = 4.28 not integer)
```

---

## ✅ Ưu điểm của Sharding

### 1. **Horizontal Scalability**

```
Month 1: 100GB data → 3 nodes
Month 6: 500GB data → 3 nodes (shards grow)
Month 12: 1TB data → Add 2 nodes → 5 nodes

Linear scaling:
✅ Add nodes → Add capacity
✅ Near-linear performance improvement
✅ No downtime during scaling
```

### 2. **Parallel Processing**

```
Query: "search 1TB data"

Without sharding (1 node):
Process 1TB sequentially
Time: 10 seconds

With 10 shards (10 nodes):
Each processes 100GB in parallel
Time: 1 second (10× faster!) ⚡
```

### 3. **High Availability**

```
3 nodes, 3 shards, 1 replica:

Node 1: [P0]  [R1]
Node 2: [P1]  [R2]
Node 3: [P2]  [R0]

Node 1 fails ❌
→ R0 on Node 3 promoted to P0
→ R1 on Node 1 lost but P1 on Node 2 still available
→ Zero data loss ✅
→ Queries continue ✅
```

### 4. **Load Distribution**

```
Without sharding:
All queries → 1 node → Bottleneck! 🔥

With 10 shards:
Queries distributed → 10 nodes → Load balanced ✅

Load per node = Total load / number_of_nodes
```

### 5. **Faster Recovery**

```
Single 1TB shard fails:
Recovery time: 4-6 hours ⏰

10 × 100GB shards, one fails:
Recovery time: 30-60 minutes ⚡
4-6× faster! ✅
```

---

## ❌ Nhược điểm của Sharding

### 1. **Over-Sharding Problem**

```
Bad Example:
Index: 10GB
Shards: 100 (100MB each)

Problems:
❌ 100× overhead (each shard = 50MB heap)
❌ 5GB heap just for shards!
❌ Query checks 100 shards (slow!)
❌ Cluster state huge
❌ 100× file handles

Good Example:
Index: 10GB
Shards: 1 (10GB)

Benefits:
✅ 50MB heap for shard
✅ Query checks 1 shard (fast!)
✅ Minimal overhead
```

### 2. **Cannot Change Shard Count**

```
Created with 3 shards:
PUT /products
{
  "settings": {"number_of_shards": 3}
}

Later want 10 shards:
PUT /products/_settings
{
  "number_of_shards": 10  # ❌ ERROR!
}

Why?
hash(doc_id) % 3 ≠ hash(doc_id) % 10
All documents would be in wrong shards!

Solution:
POST /_reindex
{
  "source": {"index": "products"},
  "dest": {
    "index": "products_new_10_shards"
  }
}
```

### 3. **Query Overhead**

```
Search query must:
1. Fan-out to ALL shards
2. Each shard searches locally
3. Coordinate node merges results
4. Sort and rank
5. Return top results

More shards = More overhead
10 shards: Acceptable
100 shards: Slow!
1000 shards: Very slow! 💥
```

### 4. **Memory Overhead**

```
Each shard consumes:
- 50-100MB heap (minimum)
- File handles
- Thread pools
- Cache

1000 shards × 50MB = 50GB heap!

With 32GB heap:
- 25GB for shards ❌
- Only 7GB left for queries ❌
- Circuit breaker trips! 💥
```

### 5. **Unbalanced Shards**

```
Problem: Custom routing concentrates data

Example:
Shard 0: 500GB (one big customer)
Shard 1: 50GB
Shard 2: 50GB

Shard 0 becomes:
❌ Slow to search
❌ Slow to recover
❌ Bottleneck for queries

Solution: Better routing strategy
```

---

## 💡 Best Practices

### ✅ DO:

#### 1. **Right-Size Shards**
```bash
# Small index (<50GB):
"number_of_shards": 1

# Medium index (50-500GB):
"number_of_shards": index_size_gb / 30

# Large index (>500GB):
# Use time-based indices (daily/monthly)
```

#### 2. **Plan for Growth**
```bash
# Consider 6-12 month growth
Current: 100GB
Growth: +50GB/month
12 months: 100 + (50 × 12) = 700GB

Shards needed: 700 / 30 = 23 shards ✅
```

#### 3. **Use Time-Based Indices**
```bash
# Instead of:
PUT /logs  # One huge index

# Do this:
PUT /logs-2026-01-01
PUT /logs-2026-01-02
PUT /logs-2026-01-03

# Benefits:
✅ Delete old data (drop index)
✅ Smaller shards
✅ Better query performance
```

#### 4. **Monitor Shard Health**
```bash
# Check shard distribution
GET /_cat/shards?v&h=index,shard,prirep,state,docs,store,node

# Check allocation
GET /_cat/allocation?v

# Why shard unassigned?
GET /_cluster/allocation/explain
```

### ❌ DON'T:

#### 1. **Don't Over-Shard**
```bash
❌ 10GB index with 100 shards
✅ 10GB index with 1 shard
```

#### 2. **Don't Under-Shard**
```bash
❌ 1TB index with 1 shard
✅ 1TB index with 30 shards
```

#### 3. **Don't Exceed Heap Limits**
```bash
❌ 1000 shards with 32GB heap (31 shards per GB!)
✅ 640 shards with 32GB heap (20 shards per GB)
```

#### 4. **Don't Use Sequential Routing**
```bash
❌ routing=1, routing=2, routing=3 (predictable)
✅ routing=user-uuid (random distribution)
```

---

## 🔧 Troubleshooting

### Problem 1: Unassigned Shards

**Symptoms:**
```bash
GET /_cluster/health

{
  "status": "red",
  "unassigned_shards": 5
}
```

**Diagnosis:**
```bash
GET /_cluster/allocation/explain
{
  "index": "products",
  "shard": 0,
  "primary": true
}
```

**Common Causes & Solutions:**

#### **1. Disk Space:**
```json
{
  "explanation": "disk usage exceeded watermark"
}
```
**Solution:** Add disk space or delete old data

#### **2. Shard Can't Fit:**
```json
{
  "explanation": "shard size exceeds available disk"
}
```
**Solution:** Add nodes with larger disks

#### **3. Replica on Same Node:**
```json
{
  "explanation": "primary and replica on same node not allowed"
}
```
**Solution:** Add more nodes

### Problem 2: Too Many Shards

**Symptoms:**
- High memory usage
- Slow cluster state updates
- Circuit breaker errors

**Check:**
```bash
GET /_cat/shards?v | wc -l
# If > 1000 shards → Problem!

GET /_nodes/stats | grep heap
# Check heap usage
```

**Solutions:**

#### **1. Shrink Index:**
```bash
# Reduce shard count
POST /source_index/_shrink/target_index
{
  "settings": {
    "index.number_of_shards": 1
  }
}
```

#### **2. Reindex:**
```bash
POST /_reindex
{
  "source": {"index": "old_index"},
  "dest": {"index": "new_index"}
}
```

#### **3. Increase Heap:**
```bash
# elasticsearch.yml
-Xms32g
-Xmx32g
```

### Problem 3: Unbalanced Shards

**Symptoms:**
```bash
GET /_cat/shards?v&h=index,shard,store

# Output:
products 0 500gb
products 1  50gb
products 2  50gb
```

**Cause:** Poor routing strategy

**Solution:**
```bash
# 1. Reindex without custom routing
# 2. Use better routing key (more diverse)
# 3. Consider splitting large shard
```

---

## 📚 Related Topics

- **[REPLICAS.md](./REPLICAS.md)** - Understanding replicas
- **[INDICES.md](./INDICES.md)** - Index management
- **[CLUSTERS-NODES.md](./CLUSTERS-NODES.md)** - Cluster architecture

---

*Cập nhật: 31 Tháng 1, 2026*
