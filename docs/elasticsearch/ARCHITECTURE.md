# Elasticsearch Architecture

Deep dive into cluster architecture, node types, and distributed system design.

---

## 📋 Table of Contents

1. [Cluster Architecture](#cluster-architecture)
2. [Node Types & Roles](#node-types--roles)
3. [Shard Allocation](#shard-allocation)
4. [High Availability](#high-availability)
5. [Discovery & Election](#discovery--election)
6. [Distributed Search](#distributed-search)
7. [Write Process](#write-process)
8. [Read Process](#read-process)
9. [Network Layer](#network-layer)
10. [Memory Management](#memory-management)

---

## 🏗️ Cluster Architecture

### Single Node Architecture

```
┌─────────────────────────────────────┐
│         Node 1 (Single Node)        │
├─────────────────────────────────────┤
│  Roles: Master, Data, Coordinating  │
│                                     │
│  Index: products                    │
│  ├─ Shard 0 (Primary)              │
│  ├─ Shard 1 (Primary)              │
│  └─ Shard 2 (Primary)              │
│                                     │
│  Index: logs                        │
│  └─ Shard 0 (Primary)              │
│                                     │
│  Heap: 1GB                          │
│  Disk: 100GB                        │
└─────────────────────────────────────┘

Status: Yellow (no replicas)
Use case: Development only
```

---

### Multi-Node Production Cluster

```
┌──────────────────────────────────────────────────────────────────┐
│                    Production Cluster                            │
│                  "production-es-cluster"                         │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    Master-1     │  │    Master-2     │  │    Master-3     │
│  (Master Only)  │  │  (Master Only)  │  │  (Master Only)  │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ Heap: 2GB       │  │ Heap: 2GB       │  │ Heap: 2GB       │
│ Disk: 50GB      │  │ Disk: 50GB      │  │ Disk: 50GB      │
│ Elected Master ⭐│  │ Master Eligible │  │ Master Eligible │
└─────────────────┘  └─────────────────┘  └─────────────────┘

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│     Data-1      │  │     Data-2      │  │     Data-3      │
│  (Data, Ingest) │  │  (Data, Ingest) │  │  (Data, Ingest) │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ [P0][R1][R2]    │  │ [P1][R0][R2]    │  │ [P2][R0][R1]    │
│ [P3][R4]        │  │ [P4][R3]        │  │ [R3][R4]        │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ Heap: 32GB      │  │ Heap: 32GB      │  │ Heap: 32GB      │
│ Disk: 1TB       │  │ Disk: 1TB       │  │ Disk: 1TB       │
│ CPU: 8 cores    │  │ CPU: 8 cores    │  │ CPU: 8 cores    │
└─────────────────┘  └─────────────────┘  └─────────────────┘

┌─────────────────┐  ┌─────────────────┐
│  Coordinating-1 │  │  Coordinating-2 │
│  (Coord Only)   │  │  (Coord Only)   │
├─────────────────┤  ├─────────────────┤
│ Load Balancer   │  │ Load Balancer   │
│ Aggregations    │  │ Aggregations    │
├─────────────────┤  ├─────────────────┤
│ Heap: 8GB       │  │ Heap: 8GB       │
│ Disk: 100GB     │  │ Disk: 100GB     │
└─────────────────┘  └─────────────────┘
         ↑                   ↑
         └───── Client ──────┘

Status: Green (all shards allocated)
Total Nodes: 8
Primary Shards: 5
Replica Shards: 10 (2 replicas × 5 primaries)
```

---

## 🎭 Node Types & Roles

### 1. Master Node

**Purpose:** Cluster management and coordination

```yaml
# elasticsearch.yml
node.name: master-1
node.roles: [master]
cluster.name: production-es-cluster

# Master-specific settings
discovery.seed_hosts: ["master-1", "master-2", "master-3"]
cluster.initial_master_nodes: ["master-1", "master-2", "master-3"]
```

**Responsibilities:**
- ✅ Create/delete indices
- ✅ Track cluster state
- ✅ Allocate shards to nodes
- ✅ Manage node membership
- ✅ Process cluster state updates

**Resource Requirements:**
- **CPU:** 2-4 cores (low)
- **RAM:** 2-4GB heap (small)
- **Disk:** 50GB (minimal)
- **Network:** Low bandwidth

**Best Practices:**
- ✅ Always 3 master-eligible nodes (fault tolerance)
- ✅ Dedicated master nodes in production
- ✅ Avoid data storage on master nodes
- ✅ Fast, reliable network connection

---

### 2. Data Node

**Purpose:** Store data and execute queries

```yaml
# elasticsearch.yml
node.name: data-1
node.roles: [data, ingest]
cluster.name: production-es-cluster

# Data-specific settings
path.data: ["/mnt/data1", "/mnt/data2"]  # Multiple data paths
```

**Responsibilities:**
- ✅ Store document data
- ✅ Execute search queries
- ✅ Perform aggregations
- ✅ CRUD operations
- ✅ Indexing and analysis

**Resource Requirements:**
- **CPU:** 8-16+ cores (high)
- **RAM:** 32-64GB heap (large)
- **Disk:** 1-5TB SSD (fast I/O)
- **Network:** High bandwidth

**Data Node Types:**

#### Hot Nodes (Recent Data)
```yaml
node.roles: [data_hot]
node.attr.data_tier: hot

# Fast SSDs, high resources
# Recent indices (last 7-30 days)
```

#### Warm Nodes (Older Data)
```yaml
node.roles: [data_warm]
node.attr.data_tier: warm

# Medium performance
# Older indices (30-90 days)
```

#### Cold Nodes (Archive)
```yaml
node.roles: [data_cold]
node.attr.data_tier: cold

# HDDs acceptable
# Archive indices (>90 days)
```

---

### 3. Coordinating Node

**Purpose:** Route requests and merge results

```yaml
# elasticsearch.yml
node.name: coord-1
node.roles: []  # Empty = coordinating only
cluster.name: production-es-cluster
```

**Responsibilities:**
- ✅ Receive client requests
- ✅ Route to appropriate data nodes
- ✅ Merge search results
- ✅ Reduce aggregations
- ✅ Load balancing

**Resource Requirements:**
- **CPU:** 4-8 cores (medium)
- **RAM:** 8-16GB heap (medium)
- **Disk:** 100GB (logs only)
- **Network:** Very high bandwidth

**When to Use:**
- Large clusters (>20 nodes)
- Heavy aggregation workload
- Many concurrent clients
- Complex search queries

---

### 4. Ingest Node

**Purpose:** Pre-process documents before indexing

```yaml
# elasticsearch.yml
node.name: ingest-1
node.roles: [ingest]
cluster.name: production-es-cluster
```

**Responsibilities:**
- ✅ Run ingest pipelines
- ✅ Transform documents
- ✅ Enrich data
- ✅ Parse logs (Grok patterns)

**Example Pipeline:**
```bash
PUT /_ingest/pipeline/logs-pipeline
{
  "description": "Parse log entries",
  "processors": [
    {
      "grok": {
        "field": "message",
        "patterns": ["%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{GREEDYDATA:msg}"]
      }
    },
    {
      "date": {
        "field": "timestamp",
        "formats": ["ISO8601"]
      }
    },
    {
      "remove": {
        "field": "message"
      }
    }
  ]
}

# Use pipeline
POST /logs/_doc?pipeline=logs-pipeline
{
  "message": "2026-01-25T10:30:00 ERROR Connection failed"
}
```

---

### 5. Machine Learning Node

```yaml
# elasticsearch.yml
node.name: ml-1
node.roles: [ml]
xpack.ml.enabled: true
```

**Use Cases:**
- Anomaly detection
- Forecasting
- Log rate analysis
- Outlier detection

---

## 📊 Shard Allocation

### Allocation Strategies

#### Cluster-Level Shard Allocation

```bash
# Enable/disable allocation
PUT /_cluster/settings
{
  "transient": {
    "cluster.routing.allocation.enable": "all"
    # Options: all, primaries, new_primaries, none
  }
}

# Rebalancing
PUT /_cluster/settings
{
  "transient": {
    "cluster.routing.rebalance.enable": "all"
  }
}
```

#### Shard Allocation Awareness

**Zone-Aware Allocation:**
```yaml
# elasticsearch.yml
cluster.routing.allocation.awareness.attributes: zone
node.attr.zone: zone-1

# Ensures replicas in different zones
```

**Rack-Aware:**
```yaml
node.attr.rack: rack-1
cluster.routing.allocation.awareness.attributes: rack
```

#### Forced Awareness

```yaml
cluster.routing.allocation.awareness.force.zone.values: zone-1,zone-2,zone-3
```
→ Prevents allocation until all zones available

---

### Shard Allocation Filters

**Include/Exclude Nodes:**
```bash
PUT /logs-2026-01/_settings
{
  "index.routing.allocation.include._name": "data-1,data-2",
  "index.routing.allocation.exclude._name": "data-3"
}

# By attribute
PUT /logs-2026-01/_settings
{
  "index.routing.allocation.require.data_tier": "hot"
}
```

**Use Cases:**
- Migrate indices to specific nodes
- Decommission nodes gracefully
- Separate workloads (hot/warm/cold)

---

### Disk-Based Shard Allocation

```yaml
# elasticsearch.yml
cluster.routing.allocation.disk.threshold_enabled: true
cluster.routing.allocation.disk.watermark.low: 85%
cluster.routing.allocation.disk.watermark.high: 90%
cluster.routing.allocation.disk.watermark.flood_stage: 95%
```

**Watermark Behavior:**
- **Low (85%):** No new shards allocated
- **High (90%):** Try to relocate shards away
- **Flood (95%):** Block writes, set indices read-only

---

## 🛡️ High Availability

### Replica Strategy

**Minimum for HA:**
```bash
PUT /critical-data
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 2  # 2 copies = 3 total per shard
  }
}
```

**Distribution:**
```
3 Nodes, 3 Shards, 2 Replicas

Node 1: [P0] [R1] [R2]
Node 2: [P1] [R0] [R2]
Node 3: [P2] [R0] [R1]

Can lose ANY 1 node without data loss
```

---

### Cross-Cluster Replication (CCR)

**Setup:**
```bash
# Configure remote cluster on Cluster B
PUT /_cluster/settings
{
  "persistent": {
    "cluster": {
      "remote": {
        "cluster_a": {
          "seeds": ["cluster-a-node:9300"]
        }
      }
    }
  }
}

# Create follower index
PUT /logs-follower/_ccr/follow
{
  "remote_cluster": "cluster_a",
  "leader_index": "logs-leader"
}
```

**Use Cases:**
- ✅ Disaster recovery (DR)
- ✅ Geographic distribution
- ✅ Read replicas for scaling
- ✅ Compliance (data residency)

---

### Snapshot & Restore

**Configure Repository:**
```bash
PUT /_snapshot/my_backup
{
  "type": "s3",
  "settings": {
    "bucket": "es-backups",
    "region": "us-east-1",
    "base_path": "snapshots"
  }
}

# Take snapshot
PUT /_snapshot/my_backup/snapshot_2026_01_25?wait_for_completion=true
{
  "indices": "logs-*,products",
  "ignore_unavailable": true,
  "include_global_state": false
}

# Restore
POST /_snapshot/my_backup/snapshot_2026_01_25/_restore
{
  "indices": "logs-2026-01",
  "rename_pattern": "(.+)",
  "rename_replacement": "restored_$1"
}
```

---

## 🗳️ Discovery & Election

### Cluster Formation

**Discovery Process:**
```
1. Node starts
   ↓
2. Reads discovery.seed_hosts
   ↓
3. Pings seed hosts
   ↓
4. Joins cluster OR
   Forms new cluster
```

**Configuration:**
```yaml
# elasticsearch.yml
discovery.seed_hosts:
  - master-1:9300
  - master-2:9300
  - master-3:9300

cluster.initial_master_nodes:
  - master-1
  - master-2
  - master-3
```

---

### Master Election

**Election Criteria:**
1. **Quorum:** Majority of master-eligible nodes
2. **Highest ID:** If tie, highest cluster state version wins

**Example:**
```
3 Master-Eligible Nodes

Scenario 1: Master-1 fails
→ Master-2 and Master-3 form quorum (2/3)
→ One elected as new master ✅

Scenario 2: Master-1 AND Master-2 fail
→ Master-3 alone (1/3, no quorum)
→ Cluster becomes read-only ⚠️
→ No writes allowed (split-brain prevention)
```

**Split-Brain Prevention:**
```yaml
discovery.zen.minimum_master_nodes: 2  # Deprecated in 8.x
# In 8.x: automatic with cluster.initial_master_nodes
```

---

## 🔍 Distributed Search

### Search Flow

```
┌───────────────────────────────────────────────────────────┐
│                      Search Request                       │
│                 GET /products/_search                     │
│                 {"query": {"match": {"name": "laptop"}}}  │
└───────────────────────────────────────────────────────────┘
                            ↓
                  ┌─────────────────┐
                  │ Coordinating    │
                  │ Node (Coord-1)  │
                  └─────────────────┘
                            ↓
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
  ┌──────────┐        ┌──────────┐        ┌──────────┐
  │ Data-1   │        │ Data-2   │        │ Data-3   │
  │ [P0][R1] │        │ [P1][R0] │        │ [P2][R1] │
  └──────────┘        └──────────┘        └──────────┘
        │                   │                   │
   Query Phase        Query Phase        Query Phase
   - Score docs       - Score docs       - Score docs
   - Return top N     - Return top N     - Return top N
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ↓
                  ┌─────────────────┐
                  │ Coordinating    │
                  │ Merge results   │
                  │ Global sort     │
                  └─────────────────┘
                            ↓
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
  ┌──────────┐        ┌──────────┐        ┌──────────┐
  │ Data-1   │        │ Data-2   │        │ Data-3   │
  └──────────┘        └──────────┘        └──────────┘
        │                   │                   │
   Fetch Phase        Fetch Phase        Fetch Phase
   - Get full docs    - Get full docs    - Get full docs
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ↓
                  ┌─────────────────┐
                  │ Return to       │
                  │ Client          │
                  └─────────────────┘
```

### Query Then Fetch

**Phase 1: Query Phase**
- Coordinator broadcasts query to all shards
- Each shard scores documents
- Returns top N doc IDs + scores
- Coordinator merges and sorts globally

**Phase 2: Fetch Phase**
- Coordinator requests full documents
- Only for final top N results
- Shards return `_source` fields
- Coordinator returns to client

---

## ✍️ Write Process

### Document Indexing Flow

```
┌────────────────────────────────────────────────────────┐
│              POST /products/_doc/123                   │
│              {"name": "Laptop", "price": 999}          │
└────────────────────────────────────────────────────────┘
                         ↓
               ┌──────────────────┐
               │ Coordinating Node│
               │ - Route by doc ID│
               │ - Hash(doc_id) % │
               │   num_shards     │
               └──────────────────┘
                         ↓
                 Route to Shard 1
                         ↓
         ┌───────────────────────────────┐
         │    Primary Shard 1 (Data-2)   │
         │ 1. Index to Translog (flush)  │
         │ 2. Index to Lucene (memory)   │
         │ 3. Return OK to coordinator   │
         └───────────────────────────────┘
                         ↓
         ┌───────────────┴────────────────┐
         ↓                                ↓
  ┌─────────────┐                  ┌─────────────┐
  │ Replica 1-1 │                  │ Replica 1-2 │
  │ (Data-1)    │                  │ (Data-3)    │
  │ - Index     │                  │ - Index     │
  │ - ACK       │                  │ - ACK       │
  └─────────────┘                  └─────────────┘
         │                                │
         └────────────────┬───────────────┘
                          ↓
               ┌──────────────────┐
               │ Coordinating Node│
               │ Return 201 to    │
               │ Client           │
               └──────────────────┘
```

### Translog (Transaction Log)

**Purpose:** Durability before Lucene flush

```
Write Operation
    ↓
Translog (fsync) ← Durable!
    ↓
Lucene (memory) ← Fast, not durable
    ↓
Periodic refresh (1s) → Searchable
    ↓
Periodic flush (30m) → Lucene commits, Translog clears
```

**Configuration:**
```bash
PUT /products/_settings
{
  "index.translog.durability": "request",  # fsync per request (slow, safe)
  # OR
  "index.translog.durability": "async",    # fsync every 5s (fast, risk)
  "index.translog.sync_interval": "5s"
}
```

---

## 🌐 Network Layer

### Transport Layer (Node-to-Node)

**Port:** 9300

**Protocol:** Binary (TCP)

**Usage:**
- Cluster communication
- Shard replication
- Distributed search

**Configuration:**
```yaml
transport.port: 9300
transport.compress: true  # Compress inter-node traffic
transport.tcp.keep_alive: true
```

---

### HTTP Layer (Client-to-Cluster)

**Port:** 9200

**Protocol:** HTTP/REST (JSON)

**Usage:**
- Client requests
- API calls
- Kibana communication

**Configuration:**
```yaml
http.port: 9200
http.max_content_length: 100mb
http.cors.enabled: true
http.cors.allow-origin: "*"
```

---

## 💾 Memory Management

### Heap Memory

**Rule:** 50% of RAM, max 32GB

```
64GB RAM Server
├── 30GB Heap (Elasticsearch JVM)
└── 34GB OS Cache (Lucene file system cache)
```

**Configuration:**
```bash
# jvm.options
-Xms30g
-Xmx30g  # Always set same as Xms
```

**Why max 32GB?**
- Above 32GB: Compressed Oops disabled
- Pointers become 64-bit (wastes memory)
- 30GB heap > 35GB heap in efficiency!

---

### Memory Pressure

**Monitoring:**
```bash
GET /_nodes/stats/jvm

# Watch for:
- heap_used_percent > 85%: High pressure
- gc.collectors.old.collection_time_in_millis: GC overhead
```

**Circuit Breakers:**
```bash
GET /_nodes/stats/breaker

# Request breaker: 60% of heap (default)
# Field data breaker: 40% of heap
# Prevents OutOfMemoryError
```

---

## 🎯 Architecture Best Practices

### Small Cluster (Dev/Test)

```
1 Node
- All roles (master, data, ingest)
- 8GB RAM (4GB heap)
- 100GB disk
- Cost: $50/month
```

### Medium Cluster (Production)

```
5 Nodes
- 3 master-eligible + data (16GB heap each)
- 2 data-only (32GB heap each)
- 500GB SSD per node
- Cost: $1000/month
```

### Large Cluster (Enterprise)

```
20+ Nodes
- 3 dedicated masters (4GB heap)
- 10 data nodes (32GB heap, 1TB SSD)
- 3 coordinating (16GB heap)
- 2 ingest (16GB heap)
- Cost: $10,000+/month
```

---

## 📚 Next Steps

- ✅ Completed **ARCHITECTURE.md** ← You are here
- ➡️ Next: [SEARCH-IMPLEMENTATION.md](./SEARCH-IMPLEMENTATION.md) - Query DSL and search
- 📖 Or: [INDICES.md](./INDICES.md) - Index management

---

*Last Updated: January 25, 2026*
