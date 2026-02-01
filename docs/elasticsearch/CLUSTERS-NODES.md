# Elasticsearch Clusters & Nodes - Hướng Dẫn Chi Tiết

> **Cluster** là tập hợp các nodes làm việc cùng nhau để lưu trữ data và cung cấp search capabilities.

---

## 📋 Mục Lục

1. [Cluster là gì?](#cluster-là-gì)
2. [Node Types](#node-types)
3. [Cluster State](#cluster-state)
4. [Node Discovery](#node-discovery)
5. [Cluster Health](#cluster-health)
6. [Split Brain Problem](#split-brain-problem)
7. [Cluster Sizing](#cluster-sizing)
8. [Best Practices](#best-practices)

---

## 🌐 Cluster là gì?

**Cluster** = nhóm 1 hoặc nhiều nodes (servers) cùng chia sẻ `cluster.name`:

```
Single-Node Cluster:
┌─────────────────────┐
│   Node 1 (Master)   │
│   - All data        │
│   - All operations  │
└─────────────────────┘

Multi-Node Cluster:
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  Node 1       │  │  Node 2       │  │  Node 3       │
│  (Master)     │  │  (Data)       │  │  (Data)       │
│  [P0] [R1]    │  │  [P1] [R2]    │  │  [P2] [R0]    │
└───────────────┘  └───────────────┘  └───────────────┘
        └──────────────┬───────────────────┘
                   Cluster
```

**Cluster Name Example:**
```yaml
# elasticsearch.yml
cluster.name: production-cluster
node.name: node-1
```

---

## 🖥️ Node Types

### 1. **Master Node**

**Responsibilities:**
- Manage cluster state
- Create/delete indices
- Allocate shards to nodes
- Track node membership

**Configuration:**
```yaml
# Master-eligible node
node.master: true
node.data: false
node.ingest: false
```

**Best Practice:** 3+ dedicated master nodes in production

```
Master Cluster (dedicated):
Node M1: Master-eligible ✅
Node M2: Master-eligible ✅  
Node M3: Master-eligible ✅

→ Quorum: 2/3 (prevents split-brain)
```

### 2. **Data Node**

**Responsibilities:**
- Store data (shards)
- Execute CRUD operations
- Execute search queries
- Aggregations

**Configuration:**
```yaml
node.master: false
node.data: true
node.ingest: false
```

**Sizing:**
- Most CPU/RAM/Disk intensive
- Scale horizontally by adding more data nodes

### 3. **Ingest Node**

**Responsibilities:**
- Pre-process documents before indexing
- Apply transformations (pipelines)
- Enrich data

**Configuration:**
```yaml
node.master: false
node.data: false
node.ingest: true
```

**Example Pipeline:**
```bash
PUT /_ingest/pipeline/timestamp-pipeline
{
  "description": "Add timestamp",
  "processors": [
    {
      "set": {
        "field": "processed_at",
        "value": "{{_ingest.timestamp}}"
      }
    }
  ]
}
```

### 4. **Coordinating Node**

**Responsibilities:**
- Route requests to appropriate nodes
- Merge results from data nodes
- Load balance

**Configuration:**
```yaml
node.master: false
node.data: false
node.ingest: false
# Coordinating by default when all false
```

**Use Case:** Dedicated load balancers

### 5. **Machine Learning Node** (X-Pack)

**Configuration:**
```yaml
node.ml: true
node.data: false
node.master: false
```

---

## 📊 Cluster State

**Cluster State** contains:
- All index metadata
- All mappings
- Shard allocation
- Node information

**View Cluster State:**
```bash
GET /_cluster/state

# Specific sections only:
GET /_cluster/state/metadata,routing_table,nodes
```

**Cluster State Sections:**

| Section | Contains |
|---------|----------|
| `metadata` | Index settings, mappings, templates |
| `routing_table` | Shard allocation |
| `nodes` | Node information |
| `blocks` | Read/write blocks |
| `master_node` | Current elected master |

**Cluster Settings:**
```bash
# Get settings
GET /_cluster/settings

# Update settings
PUT /_cluster/settings
{
  "persistent": {
    "indices.recovery.max_bytes_per_sec": "100mb"
  },
  "transient": {
    "cluster.routing.allocation.enable": "all"
  }
}
```

**persistent vs transient:**
- **persistent**: Survives cluster restart
- **transient**: Lost on restart

---

## 🔍 Node Discovery

**Discovery** = cách nodes tìm nhau và form cluster

### Seed Hosts

```yaml
# elasticsearch.yml
discovery.seed_hosts:
  - 10.0.0.1:9300
  - 10.0.0.2:9300
  - 10.0.0.3:9300

cluster.initial_master_nodes:
  - node-1
  - node-2
  - node-3
```

**Process:**
```
1. Node starts
2. Contacts seed hosts
3. Joins cluster if found
4. Elects master (first time)
5. Syncs cluster state
```

---

## 💚 Cluster Health

### Health Status

```bash
GET /_cluster/health
```

**Response:**
```json
{
  "cluster_name": "production",
  "status": "green",
  "number_of_nodes": 3,
  "number_of_data_nodes": 3,
  "active_primary_shards": 10,
  "active_shards": 30,
  "unassigned_shards": 0
}
```

**Status Meanings:**

| Status | Meaning | Action |
|--------|---------|--------|
| 🟢 **GREEN** | All shards allocated | ✅ Good! |
| 🟡 **YELLOW** | All primaries OK, some replicas missing | ⚠️ Investigate |
| 🔴 **RED** | Some primaries missing | 🚨 URGENT! |

---

## 🧠 Split Brain Problem

**Split Brain** = cluster divides into 2+ independent clusters

```
Normal Cluster (3 nodes):
    [M1] ←→ [M2] ←→ [M3]
         Master

Network Partition:
    [M1]     ❌     [M2] ←→ [M3]
     ↓                ↓
  Master?         Master?
  Cluster A       Cluster B

→ 2 clusters with SAME NAME!
→ Data divergence!
→ Data loss when reconnected!
```

**Solution: Quorum**
```yaml
# Minimum 2/3 votes required
discovery.zen.minimum_master_nodes: 2

# Formula: (master_eligible_nodes / 2) + 1
```

**Example:**
- 3 master nodes → quorum = 2
- 5 master nodes → quorum = 3
- 7 master nodes → quorum = 4

---

## 📏 Cluster Sizing

### Small Cluster (Development)
```
1-3 nodes
- Combined master + data + ingest
- 8-16 GB RAM per node
- 2-4 CPU cores
```

### Medium Cluster (Production)
```
5-10 nodes
- 3 dedicated master nodes (4 GB RAM)
- 3-7 data nodes (32 GB RAM, 8 cores)
- Total data: < 1 TB
```

### Large Cluster (Enterprise)
```
20+ nodes
- 3 dedicated master nodes
- 15+ data nodes (64 GB RAM, 16 cores)
- 2+ coordinating nodes
- 2+ ingest nodes
- Total data: 10+ TB
```

---

## 💡 Best Practices

### ✅ DO:

1. **Use 3+ master nodes in production**
```yaml
node.master: true
node.data: false
```

2. **Set heap to 50% of RAM (max 32GB)**
```
ES_JAVA_OPTS="-Xms16g -Xmx16g"
```

3. **Monitor cluster health**
```bash
GET /_cluster/health?level=shards
```

### ❌ DON'T:

1. **Don't run all node types on one node in production**
2. **Don't set heap > 32GB**
3. **Don't ignore YELLOW status**

---

*Cập nhật: 31 Tháng 1, 2026*
