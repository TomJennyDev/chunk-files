# Elasticsearch Optimization Strategies

Complete guide to performance tuning, capacity planning, and production best practices.

---

## 📋 Table of Contents

1. [Index Optimization](#index-optimization)
2. [Query Performance](#query-performance)
3. [Shard Strategy](#shard-strategy)
4. [Memory Management](#memory-management)
5. [Disk I/O Optimization](#disk-io-optimization)
6. [Network Optimization](#network-optimization)
7. [Cluster Sizing](#cluster-sizing)
8. [Monitoring & Alerting](#monitoring--alerting)
9. [Capacity Planning](#capacity-planning)
10. [Production Checklist](#production-checklist)

---

## 🎯 Index Optimization

### 1. Refresh Interval

**Problem:** Default 1s refresh = frequent overhead

```bash
# Default (real-time search)
"refresh_interval": "1s"

# Optimized for indexing speed
PUT /products/_settings
{
  "refresh_interval": "30s"  # 30x less overhead!
}

# Disable during bulk indexing
PUT /products/_settings
{
  "refresh_interval": "-1"
}

# Re-enable after bulk indexing
PUT /products/_settings
{
  "refresh_interval": "30s"
}
POST /products/_refresh  # Manual refresh
```

**Impact:**
```
1s refresh:   10,000 docs/sec
30s refresh:  50,000 docs/sec (5x improvement!)
-1 (disabled): 100,000 docs/sec (10x improvement!)
```

---

### 2. Index Buffer Size

```yaml
# elasticsearch.yml
indices.memory.index_buffer_size: 15%  # Default: 10%

# More buffer = faster indexing
# But reduces heap for other operations
```

**Calculation:**
```
32GB heap × 15% = 4.8GB index buffer
→ Can buffer more docs before flush to disk
→ Better for write-heavy workloads
```

---

### 3. Translog Settings

```bash
PUT /products/_settings
{
  "index.translog.durability": "async",  # Default: request
  "index.translog.sync_interval": "30s",
  "index.translog.flush_threshold_size": "1gb"
}
```

**Trade-offs:**
- **request**: fsync every write (slow, safe)
- **async**: fsync every 5s (fast, risk of 5s data loss)

**Recommendation:**
- Use "async" for logs (acceptable loss)
- Use "request" for critical data (orders, payments)

---

### 4. Merge Settings

```bash
PUT /products/_settings
{
  "index.merge.scheduler.max_thread_count": 1,  # Default: Math.max(1, (cpu/2))
  "index.merge.policy.max_merged_segment": "5gb",
  "index.merge.policy.segments_per_tier": 10
}
```

**Tuning:**
- More merge threads = faster merges, but higher CPU
- Larger segments = less overhead, but slower searches
- Fewer segments = faster searches

---

### 5. Compression

```bash
PUT /logs
{
  "settings": {
    "codec": "best_compression"  # Default: default
  }
}
```

**Comparison:**
```
Index: 1TB logs

default codec:         1000GB (baseline)
best_compression:       500GB (50% savings!)
                       
Search speed:          ~10% slower
Indexing speed:        ~20% slower

Verdict: Use for read-heavy, large indices
```

---

### 6. Mapping Optimization

**Bad Mapping (Dynamic):**
```json
{
  "metadata": {
    "type": "object"  # All fields indexed!
  }
}
```

**Good Mapping (Explicit):**
```json
{
  "metadata": {
    "type": "object",
    "enabled": false  # Store but don't index
  }
}
```

**Impact:**
```
Dynamic:   100MB/doc indexed, slow searches
Disabled:  10MB/doc indexed, fast searches
Savings:   90% storage, 10x faster indexing
```

---

## ⚡ Query Performance

### 1. Use Filters Instead of Queries

**Slow (Query Context):**
```json
{
  "query": {
    "bool": {
      "must": [
        {"match": {"description": "laptop"}},
        {"term": {"brand": "Dell"}},           // ❌ Should be filter
        {"range": {"price": {"gte": 500}}}     // ❌ Should be filter
      ]
    }
  }
}
```

**Fast (Filter Context):**
```json
{
  "query": {
    "bool": {
      "must": [
        {"match": {"description": "laptop"}}   // ✅ Query (scoring)
      ],
      "filter": [
        {"term": {"brand": "Dell"}},           // ✅ Filter (cached)
        {"range": {"price": {"gte": 500}}}     // ✅ Filter (cached)
      ]
    }
  }
}
```

**Why Faster:**
- Filters are cached
- No scoring calculation
- Bitset operations (fast)

**Performance:**
```
Query context:  100ms average
Filter context: 10ms average (10x faster!)
Subsequent:     1ms (cached, 100x faster!)
```

---

### 2. Query Cache

```bash
# Enable
PUT /products/_settings
{
  "index.queries.cache.enabled": true
}

# Check cache stats
GET /products/_stats/query_cache

{
  "query_cache": {
    "memory_size_in_bytes": 52428800,    # 50MB
    "total_count": 1000,
    "hit_count": 850,                     # 85% hit rate!
    "miss_count": 150,
    "cache_count": 150,
    "cache_size": 150,
    "evictions": 0
  }
}
```

**What's Cached:**
- Filter queries
- Aggregations on filtered data
- Used for `size=0` queries

---

### 3. Request Cache

```bash
# Enable (default for size=0)
PUT /products/_settings
{
  "index.requests.cache.enable": true
}

# Disable for specific query
GET /products/_search?request_cache=false
{
  "query": {...}
}
```

**Caches:**
- Complete query results
- Only for `size=0` or aggregation-only queries

---

### 4. Reduce Result Size

**Bad:**
```json
GET /products/_search
{
  "size": 1000,  // ❌ Too many!
  "_source": true  // ❌ Returns all fields
}
```

**Good:**
```json
GET /products/_search
{
  "size": 20,  // ✅ Reasonable
  "_source": ["id", "name", "price"],  // ✅ Only needed fields
  "stored_fields": []  // ✅ Even faster if fields are stored
}
```

---

### 5. Pagination

**Bad (Deep Pagination):**
```json
GET /products/_search
{
  "from": 10000,  // ❌ Slow! Must score 10,020 docs
  "size": 20
}
```

**Good (Search After):**
```json
# First page
GET /products/_search
{
  "size": 20,
  "sort": [
    {"price": "asc"},
    {"_id": "asc"}
  ]
}

# Next page (use last doc's sort values)
GET /products/_search
{
  "size": 20,
  "search_after": [999.99, "doc-123"],  // ✅ Fast!
  "sort": [
    {"price": "asc"},
    {"_id": "asc"}
  ]
}
```

**Performance:**
```
from/size at 10000:  5000ms
search_after:         20ms (250x faster!)
```

---

### 6. Profile Slow Queries

```bash
GET /products/_search
{
  "profile": true,
  "query": {
    "match": {"description": "laptop"}
  }
}

# Response shows:
# - Query breakdown
# - Time per shard
# - Lucene query details
# - Bottlenecks
```

---

## 📦 Shard Strategy

### Shard Sizing Rules

**Golden Rules:**
1. ✅ **Shard size:** 10-50GB optimal
2. ✅ **Max shards per node:** 20 per GB heap
3. ✅ **Total shards:** As few as possible

---

### Calculate Optimal Shards

**Formula:**
```
Number of Shards = Index Size / Target Shard Size

Example:
Index size: 300GB
Target shard size: 30GB
→ 300 / 30 = 10 shards
```

**Cluster Capacity Check:**
```
32GB heap per node
Max shards per node: 20 × 32 = 640 shards

3 nodes × 640 = 1,920 total shards capacity

Current shards:
- products: 10 primaries × 2 replicas = 30
- logs: 50 primaries × 1 replica = 100
Total: 130 shards ✅ Well within limits
```

---

### Over-Sharding Problem

**Bad Example:**
```
10GB index
100 shards
→ 100MB per shard ❌ Too small!

Problems:
- 100x overhead for shard management
- Slow searches (query 100 shards)
- Wasted memory
```

**Fixed:**
```
10GB index
1 shard ✅ Perfect!

Benefits:
- Minimal overhead
- Fast searches
- Efficient memory usage
```

---

### Under-Sharding Problem

**Bad Example:**
```
500GB index
1 shard
→ 500GB per shard ❌ Too large!

Problems:
- Cannot distribute load
- Single point of failure
- Slow recoveries
- Memory issues
```

**Fixed:**
```
500GB index
15 shards (500/30)
→ 33GB per shard ✅ Good!
```

---

### Shard Rebalancing

```bash
# Check shard distribution
GET /_cat/shards?v&h=index,shard,prirep,state,node&s=node

# Force rebalance
POST /_cluster/reroute
{
  "commands": [
    {
      "move": {
        "index": "products",
        "shard": 0,
        "from_node": "data-1",
        "to_node": "data-2"
      }
    }
  ]
}

# Rebalance settings
PUT /_cluster/settings
{
  "transient": {
    "cluster.routing.rebalance.enable": "all",
    "cluster.routing.allocation.cluster_concurrent_rebalance": 2
  }
}
```

---

## 💾 Memory Management

### Heap Size

**Rule:** 50% of RAM, max 32GB

```bash
# jvm.options
-Xms30g
-Xmx30g

# Why 30GB not 32GB?
# - Leave room for JVM overhead
# - Compressed Oops enabled below 32GB
# - Above 32GB: pointers become 64-bit (wastes memory)
```

**Comparison:**
```
30GB heap:
- Compressed Oops: ON
- Effective: ~30GB usable

35GB heap:
- Compressed Oops: OFF
- Effective: ~25GB usable (pointers take 10GB!)

Verdict: 30GB > 35GB! ✅
```

---

### RAM Allocation

**64GB Server Example:**
```
Total: 64GB
├── 30GB JVM Heap (Elasticsearch)
│   ├── 10GB Filter cache
│   ├── 10GB Field data
│   ├── 5GB Index buffer
│   └── 5GB Other
│
└── 34GB OS File System Cache (Lucene)
    └── Used for segment file caching
```

**Why OS Cache Matters:**
- Lucene segments stored in files
- OS caches hot files in RAM
- Way faster than disk reads

---

### Circuit Breakers

**Purpose:** Prevent OutOfMemoryError

```bash
GET /_nodes/stats/breaker

{
  "breakers": {
    "request": {
      "limit_size_in_bytes": 19327352832,  # 60% of heap
      "estimated_size_in_bytes": 0,
      "overhead": 1.0,
      "tripped": 0
    },
    "fielddata": {
      "limit_size_in_bytes": 12884901888,  # 40% of heap
      "estimated_size_in_bytes": 0,
      "overhead": 1.03,
      "tripped": 0
    },
    "parent": {
      "limit_size_in_bytes": 22548578304,  # 70% of heap
      "estimated_size_in_bytes": 0,
      "overhead": 1.0,
      "tripped": 0
    }
  }
}
```

**If Tripped:**
- Query rejected with error
- Better than OOM crash!
- Indicates need for optimization or scaling

---

### Monitoring Memory

```bash
GET /_nodes/stats/jvm

{
  "jvm": {
    "mem": {
      "heap_used_percent": 67,  # ⚠️ Watch this!
      "heap_used_in_bytes": 21474836480,
      "heap_max_in_bytes": 32212254720
    },
    "gc": {
      "collectors": {
        "young": {
          "collection_count": 1234,
          "collection_time_in_millis": 5000
        },
        "old": {
          "collection_count": 5,  # ⚠️ Should be rare!
          "collection_time_in_millis": 2000
        }
      }
    }
  }
}
```

**Red Flags:**
- `heap_used_percent > 85%` consistently
- Frequent old GC collections
- Long GC pause times (>1s)

---

## 💿 Disk I/O Optimization

### 1. Use SSDs

**Comparison:**
```
HDD (7200 RPM):
- IOPS: 100-150
- Latency: 10-15ms
- Cost: $0.03/GB

SATA SSD:
- IOPS: 10,000-50,000
- Latency: 0.1-0.2ms
- Cost: $0.10/GB
- 100x faster! ✅

NVMe SSD:
- IOPS: 100,000-500,000
- Latency: 0.01-0.05ms
- Cost: $0.20/GB
- 1000x faster! ✅✅
```

**Recommendation:**
- Hot tier: NVMe
- Warm tier: SATA SSD
- Cold tier: HDD acceptable

---

### 2. RAID Configuration

```
RAID 0 (Striping):
- 2× speed, 0 redundancy
- ❌ Don't use (data loss risk)

RAID 1 (Mirroring):
- 1× speed, 1× redundancy
- ✅ Good for master nodes

RAID 10 (1+0):
- 2× speed, 1× redundancy
- ✅ Best for data nodes

No RAID:
- Use Elasticsearch replicas instead
- ✅ Recommended (let ES handle redundancy)
```

---

### 3. Mount Options

```bash
# /etc/fstab
/dev/sdb1 /var/lib/elasticsearch ext4 noatime,nodiratime,discard 0 0

# noatime: Don't update access time (faster)
# nodiratime: Don't update directory access time
# discard: Enable TRIM for SSDs
```

---

### 4. Disable Swap

```bash
# Temporary
sudo swapoff -a

# Permanent
# Edit /etc/fstab and comment swap line

# Verify
free -h
```

**Why:**
- Swapping kills performance
- JVM heap swapped to disk = disaster
- Better to let ES crash and restart than swap

**elasticsearch.yml:**
```yaml
bootstrap.memory_lock: true
```

---

## 🌐 Network Optimization

### 1. Network Configuration

```yaml
# elasticsearch.yml
network.host: 0.0.0.0
transport.tcp.compress: true  # Compress inter-node traffic

# TCP settings
net.ipv4.tcp_fin_timeout: 30
net.ipv4.tcp_tw_reuse: 1
net.core.somaxconn: 65535
net.ipv4.tcp_max_syn_backlog: 8192
```

---

### 2. Dedicated Network

**Production Setup:**
```
Public Network (1 Gbps):
- Client → Coordinating nodes

Private Network (10 Gbps):
- Node-to-node communication
- Shard replication
- Distributed search
```

---

## 📊 Cluster Sizing

### Small Cluster (Dev/Test)

```
1-3 Nodes
Role: All (master, data, ingest)
RAM: 8-16GB (4-8GB heap)
CPU: 4 cores
Disk: 100-500GB SSD
Network: 1 Gbps

Capacity: ~500GB, 100 req/s
Cost: $100-300/month
```

---

### Medium Cluster (Production)

```
6-10 Nodes
├── 3 Master nodes
│   RAM: 8GB (4GB heap)
│   CPU: 2 cores
│   Disk: 50GB
│
└── 3-7 Data nodes
    RAM: 64GB (30GB heap)
    CPU: 8-16 cores
    Disk: 1-2TB NVMe SSD
    Network: 10 Gbps

Capacity: ~10TB, 5,000 req/s
Cost: $5,000-10,000/month
```

---

### Large Cluster (Enterprise)

```
50+ Nodes
├── 3 Master nodes (4GB heap)
├── 3 Coordinating nodes (16GB heap)
├── 20 Hot data nodes (32GB heap, NVMe)
├── 15 Warm data nodes (32GB heap, SSD)
└── 10 Cold data nodes (16GB heap, HDD)

Capacity: ~500TB, 50,000 req/s
Cost: $50,000-100,000/month
```

---

## 📈 Monitoring & Alerting

### Key Metrics to Monitor

**Cluster Health:**
```bash
GET /_cluster/health

# Watch:
- status: green (good), yellow (warning), red (critical)
- number_of_nodes: Should be stable
- unassigned_shards: Should be 0
```

**Node Stats:**
```bash
GET /_nodes/stats

# Watch:
- jvm.mem.heap_used_percent: < 85%
- os.cpu.percent: < 80%
- fs.total.available_in_bytes: > 15% disk free
- indices.search.query_time_in_millis: Low
- indices.indexing.index_time_in_millis: Steady
```

**Index Stats:**
```bash
GET /products/_stats

# Watch:
- primaries.store.size_in_bytes: Growth rate
- primaries.search.query_total: Query load
- primaries.search.query_time_in_millis: Query performance
```

---

### Alerting Thresholds

```yaml
Critical (Page On-Call):
- Cluster status: RED
- Heap usage: > 95%
- Disk usage: > 95%
- All master nodes down

Warning (Email):
- Cluster status: YELLOW
- Heap usage: > 85%
- Disk usage: > 85%
- Slow queries: p99 > 5s
- Old GC collections: > 10/hour

Info (Dashboard):
- Indexing rate changes
- Search rate changes
- Cache hit rates
```

---

### Monitoring Stack

**Option 1: Elasticsearch Monitoring (Built-in)**
```bash
# Enable monitoring
PUT /_cluster/settings
{
  "persistent": {
    "xpack.monitoring.collection.enabled": true
  }
}

# View in Kibana → Stack Monitoring
```

**Option 2: Prometheus + Grafana**
```bash
# Install elasticsearch_exporter
docker run -p 9114:9114 quay.io/prometheuscommunity/elasticsearch-exporter \
  --es.uri=http://localhost:9200

# Scrape with Prometheus
# Visualize in Grafana
```

**Option 3: Datadog / New Relic / CloudWatch**

---

## 📊 Capacity Planning

### Growth Calculation

**Example:**
```
Current:
- Data: 1TB
- Queries: 1,000/s
- Growth: 20% per month

In 6 months:
- Data: 1TB × (1.2^6) = 2.99TB (~3TB)
- Queries: 1,000 × (1.2^6) = 2,990/s (~3K)

In 12 months:
- Data: 1TB × (1.2^12) = 8.92TB (~9TB)
- Queries: 1,000 × (1.2^12) = 8,920/s (~9K)
```

---

### When to Scale

**Add Nodes When:**
- ✅ CPU > 80% sustained
- ✅ Heap > 85% sustained
- ✅ Disk > 85%
- ✅ Query latency increasing
- ✅ Indexing falling behind

**Horizontal vs Vertical:**
```
Horizontal (Add nodes):
✅ Better for most cases
✅ Linear scaling
✅ HA improvement
✅ Can scale indefinitely

Vertical (Bigger nodes):
✅ Simpler management
✅ Fewer nodes to monitor
✅ Lower network overhead
❌ Limited by max instance size
❌ No HA benefit
```

---

## ✅ Production Checklist

### Pre-Launch

- [ ] **Cluster Setup**
  - [ ] 3+ master-eligible nodes
  - [ ] Dedicated master nodes (large clusters)
  - [ ] Zone/rack awareness configured
  - [ ] Appropriate node roles assigned

- [ ] **Memory**
  - [ ] Heap = 50% RAM, max 30GB
  - [ ] Swap disabled or mlockall enabled
  - [ ] Circuit breakers configured

- [ ] **Storage**
  - [ ] SSDs for hot data
  - [ ] 15%+ disk free threshold
  - [ ] Tiered storage configured (hot/warm/cold)
  - [ ] Snapshot repository configured

- [ ] **Indices**
  - [ ] Explicit mappings (not dynamic)
  - [ ] ILM policies configured
  - [ ] Appropriate shard count
  - [ ] Replicas = 1-2 minimum

- [ ] **Queries**
  - [ ] Use filters instead of queries
  - [ ] Pagination with search_after
  - [ ] Appropriate timeouts
  - [ ] Query cache enabled

- [ ] **Monitoring**
  - [ ] Cluster health monitoring
  - [ ] Alert on RED status
  - [ ] Alert on high heap usage
  - [ ] Alert on disk space
  - [ ] Slow query logging

- [ ] **Security**
  - [ ] TLS enabled
  - [ ] Authentication configured
  - [ ] Role-based access control
  - [ ] Audit logging enabled
  - [ ] Network firewall rules

- [ ] **Backups**
  - [ ] Snapshot repository configured
  - [ ] Automated daily snapshots
  - [ ] Retention policy set
  - [ ] Restore tested!

- [ ] **Documentation**
  - [ ] Architecture diagram
  - [ ] Runbook for common issues
  - [ ] Contact list
  - [ ] Capacity plan

---

### Post-Launch

- [ ] **Week 1**
  - [ ] Monitor cluster health hourly
  - [ ] Review slow queries
  - [ ] Check shard distribution
  - [ ] Verify backups working

- [ ] **Month 1**
  - [ ] Analyze growth rate
  - [ ] Review capacity plan
  - [ ] Optimize slow queries
  - [ ] Tune index settings

- [ ] **Quarterly**
  - [ ] Capacity review
  - [ ] Cost optimization review
  - [ ] Security audit
  - [ ] Disaster recovery drill
  - [ ] Upgrade planning

---

## 🎯 Performance Targets

### Latency

```
Search Queries:
- P50: < 50ms
- P95: < 200ms
- P99: < 500ms

Indexing:
- Single doc: < 10ms
- Bulk (1000 docs): < 500ms

Aggregations:
- Simple: < 100ms
- Complex: < 1s
```

### Throughput

```
Small cluster (3 nodes):
- Indexing: 10K docs/sec
- Searches: 1K req/sec

Medium cluster (10 nodes):
- Indexing: 100K docs/sec
- Searches: 10K req/sec

Large cluster (50+ nodes):
- Indexing: 1M+ docs/sec
- Searches: 100K+ req/sec
```

### Resource Utilization

```
CPU: 60-80% (leave headroom for spikes)
Memory: 70-85% heap
Disk: < 85% usage
Network: < 70% bandwidth
```

---

## 📚 Next Steps

- ✅ Completed **OPTIMIZATION.md** ← You are here
- ➡️ Review: [ENTERPRISE-USE-CASES.md](./ENTERPRISE-USE-CASES.md) - Real-world examples
- 📖 Back to: [README.md](./README.md) - Main guide

---

*Last Updated: January 25, 2026*
