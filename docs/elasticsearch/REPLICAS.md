# Elasticsearch Replicas - Hướng Dẫn Chi Tiết

> **Replica Shards** là bản sao của primary shards, đảm bảo high availability và tăng read performance trong Elasticsearch.

---

## 📋 Mục Lục

1. [Replica là gì?](#replica-là-gì)
2. [Tại sao cần Replicas?](#tại-sao-cần-replicas)
3. [Cách hoạt động của Replication](#cách-hoạt-động-của-replication)
4. [Replica Configuration](#replica-configuration)
5. [Replication Strategies](#replication-strategies)
6. [Failover & Recovery](#failover--recovery)
7. [Read Scaling](#read-scaling)
8. [Ưu điểm của Replicas](#ưu-điểm-của-replicas)
9. [Nhược điểm của Replicas](#nhược-điểm-của-replicas)
10. [Best Practices](#best-practices)
11. [Monitoring](#monitoring)
12. [Troubleshooting](#troubleshooting)

---

## 🔄 Replica là gì?

**Replica Shard** là:
- **Bản sao** của primary shard
- **Read-only copy** (không nhận writes trực tiếp)
- **Failover backup** (promoted khi primary fails)
- **Load balancer** (phân tán read requests)

### Visual Comparison:

```
WITHOUT REPLICAS:
┌──────────────────────────┐
│   Index: "products"      │
│   3 Primary Shards       │
│   0 Replicas             │
└──────────────────────────┘

Node 1: [P0]
Node 2: [P1]
Node 3: [P2]

❌ Node fails → Data lost!
❌ High load → Bottleneck!
❌ Maintenance → Downtime!
```

```
WITH REPLICAS:
┌──────────────────────────┐
│   Index: "products"      │
│   3 Primary Shards       │
│   2 Replicas per shard   │
│   Total: 9 shards        │
└──────────────────────────┘

Node 1: [P0] [R1] [R2]
Node 2: [P1] [R0] [R2]
Node 3: [P2] [R0] [R1]

✅ Node fails → Replicas takeover!
✅ High load → Distributed!
✅ Maintenance → Zero downtime!
```

---

## 🤔 Tại sao cần Replicas?

### Problem 1: **No High Availability**

```
Single Node Cluster (No Replicas):
┌─────────────────────────┐
│  Node 1                 │
│  [P0] [P1] [P2]        │
│  All data here          │
└─────────────────────────┘

Scenarios:
❌ Hardware failure → All data lost!
❌ Disk corruption → No backup!
❌ Planned maintenance → Service down!
❌ Network issues → Cluster unavailable!

Availability: ~90% (36 days downtime/year) 💥
```

**Solution với Replicas:**
```
3 Node Cluster (1 Replica):
Node 1: [P0] [R1] [R2]
Node 2: [P1] [R0] [R2]
Node 3: [P2] [R0] [R1]

Scenarios:
✅ Node 1 fails → R0 promoted to P0
✅ Node 2 fails → R1 promoted to P1
✅ Any node fails → Zero data loss!
✅ Maintenance → Rolling restart, no downtime!

Availability: ~99.9% (8 hours downtime/year) ✅
```

### Problem 2: **Read Bottleneck**

```
Without Replicas:
All reads hit 3 primary shards
┌────┐  ┌────┐  ┌────┐
│ P0 │  │ P1 │  │ P2 │
└────┘  └────┘  └────┘
  ↓       ↓       ↓
1000    1000    1000  queries/sec
────────────────────────
Total: 3,000 qps

High traffic (10,000 qps):
❌ Overloaded shards
❌ Slow response times
❌ Queries queued
```

**Solution với Replicas:**
```
With 2 Replicas:
Reads distributed across 9 shards
┌────┐ ┌────┐ ┌────┐
│ P0 │ │ R0 │ │ R0 │
└────┘ └────┘ └────┘
┌────┐ ┌────┐ ┌────┐
│ P1 │ │ R1 │ │ R1 │
└────┘ └────┘ └────┘
┌────┐ ┌────┐ ┌────┐
│ P2 │ │ R2 │ │ R2 │
└────┘ └────┘ └────┘

Each shard: 1000 qps
Total capacity: 9,000 qps ✅
3× improvement!
```

### Problem 3: **Slow Recovery**

```
Without Replicas:
Node fails → Must restore from snapshot

Restore process:
1. Download from S3/backup
2. Uncompress data
3. Reindex into Elasticsearch
Time: 2-4 hours ⏰

Service: UNAVAILABLE during restore! ❌
```

**Solution với Replicas:**
```
With Replicas:
Node fails → Promote replica instantly

Failover process:
1. Detect node failure (30 sec)
2. Promote replica to primary (instant)
3. Reallocate missing replicas (background)
Time: < 1 minute ⚡

Service: CONTINUES running! ✅
Recovery: Minutes instead of hours!
```

---

## ⚙️ Cách hoạt động của Replication

### 1. **Write Path (Synchronous Replication)**

```
Client Write Request:
POST /products/_doc/laptop-001
{
  "name": "Laptop",
  "price": 999
}

Step-by-Step Flow:
┌──────────────────────────────────────┐
│  1. Client → Coordinating Node      │
└──────────────────────────────────────┘
                ↓
┌──────────────────────────────────────┐
│  2. Route to Primary Shard (P0)     │
│     Calculate: hash(laptop-001) % 3  │
└──────────────────────────────────────┘
                ↓
┌──────────────────────────────────────┐
│  3. Primary Shard indexes document   │
│     - Add to inverted index          │
│     - Store in translog              │
└──────────────────────────────────────┘
                ↓
┌──────────────────────────────────────┐
│  4. Primary forwards to ALL replicas │
│     P0 → R0 on Node 2                │
│     P0 → R0 on Node 3                │
└──────────────────────────────────────┘
                ↓
┌──────────────────────────────────────┐
│  5. Replicas index document          │
│     R0 (Node 2): ACK ✅               │
│     R0 (Node 3): ACK ✅               │
└──────────────────────────────────────┘
                ↓
┌──────────────────────────────────────┐
│  6. Primary responds to client       │
│     Status: 201 Created              │
│     Only after ALL replicas confirm! │
└──────────────────────────────────────┘
```

**Key Points:**
- ✅ **Synchronous:** Client gets response AFTER replicas confirm
- ✅ **Consistency:** All replicas have same data
- ⚠️ **Latency:** Slower than no replicas (network + replication time)

### 2. **Read Path (Load Balancing)**

```
Client Search Request:
GET /products/_search
{
  "query": {"match": {"name": "laptop"}}
}

Elasticsearch Smart Routing:
┌─────────────────────────────────────┐
│  For Shard 0, choose from:          │
│  - P0 on Node 1 (CPU: 80%) ❌       │
│  - R0 on Node 2 (CPU: 40%) ✅ Pick! │
│  - R0 on Node 3 (CPU: 60%)          │
└─────────────────────────────────────┘

For Shard 1, choose from:
│  - P1 on Node 2 (CPU: 40%) ✅ Pick!
│  - R1 on Node 1 (CPU: 80%)
│  - R1 on Node 3 (CPU: 60%)

For Shard 2, choose from:
│  - P2 on Node 3 (CPU: 60%) ✅ Pick!
│  - R2 on Node 1 (CPU: 80%)
│  - R2 on Node 2 (CPU: 40%)

Criteria:
✅ Least busy shard copy
✅ Fastest response time (adaptive)
✅ Available (not recovering)
```

**Adaptive Replica Selection:**
```
Elasticsearch tracks:
- Queue size per shard
- Response time per shard
- Ongoing requests per shard

Dynamically routes to:
✅ Fastest responding copy
✅ Least loaded copy
✅ Healthy copy (no issues)
```

### 3. **Replication Modes**

#### **Synchronous (Default) - Wait for All**
```bash
PUT /products/_settings
{
  "index.write.wait_for_active_shards": "all"
}

Write Flow:
Primary → Replica 1 ✅
Primary → Replica 2 ✅
Wait for BOTH → Then respond to client

Pros:
✅ Strong consistency
✅ Guaranteed durability
✅ No data loss

Cons:
❌ Higher write latency
❌ Slower if replica slow
```

#### **Asynchronous - Fire and Forget**
```bash
PUT /products/_settings
{
  "index.write.wait_for_active_shards": "1"  # Only primary
}

Write Flow:
Primary → Indexes document ✅
Respond to client immediately
Background: Replicate to replicas

Pros:
✅ Faster writes
✅ Lower latency

Cons:
❌ Eventual consistency
❌ Risk of data loss (if primary fails before replication)
```

---

## 🎛️ Replica Configuration

### Basic Configuration

```bash
# Create index with replicas
PUT /products
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 2
  }
}

# Result:
# - 3 primary shards
# - 6 replica shards (3 × 2)
# - Total: 9 shards
# - Storage: 3× (1 primary + 2 replicas)
```

### Dynamic Updates

```bash
# Increase replicas (anytime!)
PUT /products/_settings
{
  "number_of_replicas": 2
}

# Decrease replicas
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

### Wait for Active Shards

```bash
# Wait for all replicas
PUT /products/_doc/1?wait_for_active_shards=all
{
  "name": "Product"
}

# Wait for specific number (e.g., 1 primary + 1 replica)
PUT /products/_doc/1?wait_for_active_shards=2
{
  "name": "Product"
}

# Don't wait (fastest, risky)
PUT /products/_doc/1?wait_for_active_shards=1
{
  "name": "Product"
}
```

---

## 🎯 Replication Strategies

### Strategy 1: **Production Critical (2 Replicas)**

```bash
PUT /critical-data
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 2
  }
}

Configuration:
- 3 primary shards
- 6 replica shards
- Total: 9 shards
- Can lose: 2 nodes

Use When:
✅ Production systems
✅ Critical business data
✅ High availability required
✅ Cannot tolerate data loss

Cost: 3× storage
Availability: 99.99%
```

**Node Distribution:**
```
3 Nodes:
Node 1: [P0] [R1] [R2]
Node 2: [P1] [R0] [R2]
Node 3: [P2] [R0] [R1]

Can lose ANY 2 nodes without data loss! ✅
```

### Strategy 2: **Standard Production (1 Replica)**

```bash
PUT /standard-data
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1
  }
}

Configuration:
- 3 primary shards
- 3 replica shards
- Total: 6 shards
- Can lose: 1 node

Use When:
✅ Most production use cases
✅ Moderate traffic
✅ Cost-conscious
✅ Can tolerate brief unavailability

Cost: 2× storage
Availability: 99.9%
```

### Strategy 3: **Development (0 Replicas)**

```bash
PUT /dev-data
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  }
}

Configuration:
- 1 primary shard
- 0 replicas
- Total: 1 shard
- Can lose: 0 nodes

Use When:
✅ Development/testing only
✅ Temporary data
✅ Can recreate easily
✅ Single developer

Cost: 1× storage
Availability: ~90% (frequent issues)
```

### Strategy 4: **Read-Heavy (3+ Replicas)**

```bash
PUT /read-heavy-data
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 3
  }
}

Configuration:
- 3 primary shards
- 9 replica shards
- Total: 12 shards
- Can lose: 3 nodes

Use When:
✅ Read:write ratio > 100:1
✅ Global distribution
✅ Need low latency everywhere
✅ High query volume

Cost: 4× storage
Read Capacity: 4× baseline
```

---

## 🚨 Failover & Recovery

### Failover Scenario

```
Initial State (3 nodes, 1 replica):
Node 1: [P0] [R1] [R2]
Node 2: [P1] [R0] [R2]
Node 3: [P2] [R0] [R1]

Cluster Health: GREEN ✅
```

#### **Step 1: Node Failure Detected**
```
T=0s: Node 1 fails! 💥
Node 2: [P1] [R0] [R2]
Node 3: [P2] [R0] [R1]

Lost shards:
- P0 (primary) ❌
- R1 (replica)
- R2 (replica)

Cluster Health: RED 🔴
Master detects failure (30 sec timeout)
```

#### **Step 2: Replica Promotion**
```
T=30s: Promote replicas to primaries

Node 2: [P1] [P0←R0] [R2]  (R0 promoted!)
Node 3: [P2] [R0] [P1←R1]  (R1 promoted!)

Master updates cluster state:
- R0 on Node 2 → P0 ✅
- R1 on Node 3 → P1 ✅

Cluster Health: YELLOW 🟡
(All primaries available, but missing replicas)

Queries: WORKING! ✅
Data: COMPLETE! ✅
```

#### **Step 3: Replica Reallocation**
```
T=1min: Create missing replicas

Node 2: [P1] [P0] [R2] [new R1]
Node 3: [P2] [R0] [R1] [new R0] [new R2]

Background process:
- Copy P0 → new R0
- Copy P1 → new R1
- Copy P2 → new R2

Time: 5-15 minutes (depending on size)
```

#### **Step 4: Full Recovery**
```
T=15min: All replicas allocated

Node 2: [P1] [P0] [R2] [R1]
Node 3: [P2] [R0] [R1] [R0] [R2]

Cluster Health: GREEN 🟢
✅ All primaries available
✅ All replicas available
✅ Cluster resilient again
```

### Recovery Time Comparison

```
WITHOUT REPLICAS:
Node fails → Restore from snapshot
1. Download from S3: 30 min
2. Decompress: 15 min
3. Reindex: 60 min
Total: ~2 hours ⏰
Downtime: 2 hours ❌

WITH REPLICAS:
Node fails → Promote replica
1. Detect failure: 30 sec
2. Promote replica: instant
3. Queries continue: immediately
Total: ~30 seconds ⚡
Downtime: 0 minutes ✅

Recovery speed: 240× faster!
```

---

## 📈 Read Scaling

### How Replicas Increase Read Throughput

#### **Without Replicas:**
```
3 Primary Shards:
[P0] [P1] [P2]
 ↓    ↓    ↓
1K   1K   1K  queries/sec
──────────────────────
Total: 3,000 qps

Bottleneck:
- Only 3 shards handling reads
- High CPU on each shard
- Queries queue when overloaded
```

#### **With 1 Replica:**
```
3 Primaries + 3 Replicas:
[P0] [R0]
 ↓    ↓
1K + 1K = 2K qps per shard group

[P1] [R1]
 ↓    ↓
1K + 1K = 2K qps per shard group

[P2] [R2]
 ↓    ↓
1K + 1K = 2K qps per shard group

Total: 6,000 qps (2× improvement!)
```

#### **With 2 Replicas:**
```
3 Primaries + 6 Replicas:
[P0] [R0] [R0]
 ↓    ↓    ↓
1K + 1K + 1K = 3K qps

[P1] [R1] [R1]
[P2] [R2] [R2]

Total: 9,000 qps (3× improvement!)
```

### Real-World Example

```
E-Commerce Site:
- 1 million searches/hour
- ~280 searches/second
- Each shard can handle ~100 qps

Without replicas (3 shards):
3 × 100 = 300 qps ✅ Just enough

Traffic spike (holiday season):
- 5 million searches/hour
- ~1,400 searches/second

With 0 replicas:
300 qps capacity vs 1,400 qps demand
❌ System overloaded!
❌ Response time: 5 seconds
❌ Timeouts and errors

Add 2 replicas:
9 × 100 = 900 qps capacity
✅ Can handle load!
✅ Response time: <100ms
✅ No errors
```

---

## ✅ Ưu điểm của Replicas

### 1. **High Availability (Zero Downtime)**

```
Production Scenario:
- 5 nodes
- 3 primaries
- 2 replicas
- Can lose: 2 nodes

Annual downtime:
- Without replicas: 36 days (90% uptime)
- With 1 replica: 8 hours (99.9% uptime)
- With 2 replicas: 52 minutes (99.99% uptime)

SLA Impact:
99.9%  → Acceptable for most
99.99% → Enterprise grade
```

### 2. **Instant Failover**

```
Hardware failure recovery:
Without replicas:
- Detect failure: 30 sec
- Restore from backup: 2 hours
- Total downtime: 2 hours ❌

With replicas:
- Detect failure: 30 sec
- Promote replica: instant
- Total downtime: 30 seconds ✅

240× faster recovery!
```

### 3. **Read Performance Scaling**

```
Formula:
Read Capacity = (primaries + replicas) × qps_per_shard

Examples:
0 replicas: 3 × 100 = 300 qps
1 replica:  6 × 100 = 600 qps (2× improvement)
2 replicas: 9 × 100 = 900 qps (3× improvement)
3 replicas: 12 × 100 = 1200 qps (4× improvement)

Linear scaling! ✅
```

### 4. **Geographic Distribution**

```
Multi-Region Setup:
US-East (2 nodes):
- Node 1: [P0] [R1] [R2]
- Node 2: [P1] [R0]

EU-West (2 nodes):
- Node 3: [P2] [R0] [R1]
- Node 4: [R2]

Benefits:
✅ US users → Query US replicas (low latency)
✅ EU users → Query EU replicas (low latency)
✅ Region fails → Other region continues
✅ Disaster recovery built-in
```

### 5. **Maintenance Without Downtime**

```
Rolling Restart (3 nodes, 1 replica):

Step 1: Stop Node 1
- Queries use R0, R1, R2 on Node 2 & 3
- ✅ Service continues

Step 2: Start Node 1, Stop Node 2
- Queries use P0, R1, R2 on Node 1 & 3
- ✅ Service continues

Step 3: Start Node 2, Stop Node 3
- Queries use P0, P1, R2 on Node 1 & 2
- ✅ Service continues

Result: Zero downtime upgrade! ✅
```

---

## ❌ Nhược điểm của Replicas

### 1. **Storage Cost**

```
Index Size: 500GB
Replicas: 2
Total Storage: 500GB × (1 + 2) = 1,500GB

Storage cost (AWS EBS):
- 500GB: $50/month
- 1,500GB: $150/month
- Extra cost: $100/month (3× cost!)

Annual cost:
- Without replicas: $600/year
- With 2 replicas: $1,800/year
- Difference: $1,200/year

Trade-off: Pay more for availability ✅
```

### 2. **Write Performance Impact**

```
Write Latency Breakdown:

Without replicas:
1. Route to primary: 1ms
2. Index document: 5ms
3. Respond to client: 1ms
Total: 7ms

With 1 replica:
1. Route to primary: 1ms
2. Index on primary: 5ms
3. Forward to replica: 2ms
4. Index on replica: 5ms
5. Wait for ACK: 1ms
6. Respond to client: 1ms
Total: 15ms (2.1× slower)

With 2 replicas:
1-2. Same as above
3. Forward to replica 1: 2ms
4. Forward to replica 2: 2ms
5. Index on both: 5ms (parallel)
6. Wait for ACKs: 1ms
7. Respond: 1ms
Total: 18ms (2.6× slower)

Write throughput impact:
- 0 replicas: 10,000 docs/sec
- 1 replica: 6,000 docs/sec (40% reduction)
- 2 replicas: 5,000 docs/sec (50% reduction)
```

### 3. **Network Bandwidth**

```
Daily indexing: 100GB

Without replicas:
- Network transfer: 100GB/day

With 1 replica:
- Primary → Replica: 100GB
- Total: 200GB/day (2×)

With 2 replicas:
- Primary → Replica 1: 100GB
- Primary → Replica 2: 100GB
- Total: 300GB/day (3×)

Network requirements:
- 100GB/day → ~10 Mbps average
- 300GB/day → ~30 Mbps average

Need high-bandwidth network! 💰
```

### 4. **Increased Complexity**

```
Issues to manage:

❌ Replica lag (async replication)
❌ Split-brain scenarios
❌ Unassigned replicas (cluster yellow)
❌ Uneven replica distribution
❌ Version conflicts (concurrent updates)
❌ Shard relocation overhead
❌ Replica not allocated (insufficient nodes)

Requires:
✅ Monitoring setup
✅ Alerting on yellow/red status
✅ Understanding cluster health
✅ Troubleshooting skills
```

### 5. **Not True Backup**

```
Replicas DON'T protect against:

❌ Accidental deletion:
   DELETE /products
   → Deletes ALL replicas!

❌ Data corruption:
   Bad mapping change
   → Affects ALL replicas!

❌ Malicious updates:
   Bulk wrong data
   → Replicated everywhere!

❌ Cluster-wide failure:
   Data center fire
   → All replicas gone!

❌ Application bugs:
   Write wrong data
   → Replicated to all!

Solution:
✅ Use snapshots for backups!
✅ Replicas = Availability
✅ Snapshots = Disaster recovery
```

---

## 💡 Best Practices

### ✅ DO:

#### 1. **Use 1-2 Replicas in Production**
```bash
# Standard production
PUT /products
{
  "settings": {
    "number_of_replicas": 1  # Good balance
  }
}

# Critical production
PUT /critical-data
{
  "settings": {
    "number_of_replicas": 2  # Max protection
  }
}
```

#### 2. **Adjust Based on Read:Write Ratio**
```bash
# Write-heavy (logs)
PUT /logs
{
  "settings": {
    "number_of_replicas": 1  # Less replicas for faster writes
  }
}

# Read-heavy (product catalog)
PUT /products
{
  "settings": {
    "number_of_replicas": 2  # More replicas for read scaling
  }
}
```

#### 3. **Use Replicas + Snapshots**
```bash
# Replicas for day-to-day failures
PUT /products/_settings
{
  "number_of_replicas": 1
}

# Snapshots for disaster recovery
PUT /_snapshot/my_backup
{
  "type": "s3",
  "settings": {
    "bucket": "my-backups"
  }
}

# Schedule regular snapshots
PUT /_slm/policy/daily_snapshots
{
  "schedule": "0 2 * * *",  # Daily at 2 AM
  "name": "<daily-{now/d}>",
  "repository": "my_backup",
  "retention": {
    "expire_after": "30d"
  }
}
```

#### 4. **Monitor Replica Health**
```bash
# Check replica status
GET /_cat/indices?v&h=index,health,pri,rep

# Why replica unassigned?
GET /_cluster/allocation/explain

# Shard allocation
GET /_cat/shards?v&h=index,shard,prirep,state,node
```

#### 5. **Test Failover Scenarios**
```bash
# Simulate node failure
# 1. Stop one node
# 2. Check cluster goes YELLOW
# 3. Verify queries still work
# 4. Check replica promotion
# 5. Restart node
# 6. Verify recovery to GREEN
```

### ❌ DON'T:

#### 1. **Don't Use 0 Replicas in Production**
```bash
❌ PUT /production-data
   {
     "settings": {"number_of_replicas": 0}
   }

✅ PUT /production-data
   {
     "settings": {"number_of_replicas": 1}
   }
```

#### 2. **Don't Use Too Many Replicas**
```bash
❌ "number_of_replicas": 5  # Overkill! Waste of resources

✅ "number_of_replicas": 1-2  # Sufficient for most cases
```

#### 3. **Don't Assume Replicas = Backups**
```
❌ "We have replicas, don't need snapshots!"

✅ "We have replicas FOR availability + snapshots FOR backups"
```

#### 4. **Don't Ignore Yellow Status**
```bash
❌ Cluster: YELLOW for days
   "Meh, queries still work..."

✅ Investigate immediately:
   GET /_cluster/allocation/explain
   Fix missing replicas!
```

---

## 📊 Monitoring

### Health Check Commands

```bash
# Overall cluster health
GET /_cluster/health

# Per-index health
GET /_cluster/health/products?level=indices

# Shard-level details
GET /_cluster/health/products?level=shards

# List all indices with replica info
GET /_cat/indices?v&h=index,health,status,pri,rep

# Replica allocation status
GET /_cat/shards?v&h=index,shard,prirep,state,docs,store,node
```

### Key Metrics to Monitor

```bash
# 1. Cluster health color
{
  "status": "green"  # ✅ All replicas allocated
  "status": "yellow" # ⚠️ Some replicas missing
  "status": "red"    # ❌ Some primaries missing
}

# 2. Unassigned shards
{
  "unassigned_shards": 0  # ✅ Good
  "unassigned_shards": 5  # ❌ Problem!
}

# 3. Replica status per index
GET /_cat/indices?v
# Look for: rep (replica count) and health

# 4. Shard distribution
GET /_cat/allocation?v
# Check even distribution across nodes
```

### Alerting Thresholds

```
⚠️ ALERT when:
- Cluster status: YELLOW for > 5 minutes
- Cluster status: RED (immediately!)
- Unassigned shards > 0
- Replica not allocated on critical indices

📧 NOTIFY:
- On-call engineer
- DevOps team
- Slack channel
```

---

## 🔧 Troubleshooting

### Problem 1: Cluster YELLOW (Missing Replicas)

**Symptoms:**
```bash
GET /_cluster/health

{
  "status": "yellow",
  "unassigned_shards": 3,
  "active_primary_shards": 10,
  "active_shards": 17  # Should be 20 (10 primary + 10 replicas)
}
```

**Diagnosis:**
```bash
GET /_cluster/allocation/explain
{
  "index": "products",
  "shard": 0,
  "primary": false
}
```

**Common Causes & Solutions:**

#### **Cause 1: Not Enough Nodes**
```json
{
  "explanation": "cannot allocate replica on same node as primary"
}
```
**Solution:** Add more nodes or reduce replicas
```bash
# Option 1: Add node (recommended)
# Start another Elasticsearch node

# Option 2: Reduce replicas (temporary)
PUT /products/_settings
{
  "number_of_replicas": 0  # Temporary! Increase later
}
```

#### **Cause 2: Disk Space**
```json
{
  "explanation": "disk usage exceeded watermark [85%]"
}
```
**Solution:** Add disk space or delete old data
```bash
# Check disk usage
GET /_cat/allocation?v

# Delete old indices
DELETE /logs-2025-*

# Or add more disk space
```

#### **Cause 3: Shard Allocation Disabled**
```json
{
  "explanation": "allocation is disabled"
}
```
**Solution:** Re-enable allocation
```bash
PUT /_cluster/settings
{
  "persistent": {
    "cluster.routing.allocation.enable": "all"
  }
}
```

### Problem 2: Replica Lag (Async Mode)

**Symptoms:**
- Write acknowledged quickly
- But replica has old data

**Check Lag:**
```bash
GET /products/_stats

# Compare:
# - primary documents count
# - replica documents count
# Should be same!
```

**Solution:**
```bash
# Force replica sync
POST /products/_refresh

# Or wait (replicas catch up automatically)
```

### Problem 3: Unbalanced Replica Distribution

**Symptoms:**
```bash
GET /_cat/allocation?v

# Output:
shards disk.used
node-1    10      100gb
node-2     5       50gb
node-3     2       20gb
# Unbalanced!
```

**Solution: Force Rebalancing**
```bash
# Enable rebalancing
PUT /_cluster/settings
{
  "transient": {
    "cluster.routing.rebalance.enable": "all"
  }
}

# Or manually move shard
POST /_cluster/reroute
{
  "commands": [
    {
      "move": {
        "index": "products",
        "shard": 0,
        "from_node": "node-1",
        "to_node": "node-3"
      }
    }
  ]
}
```

### Problem 4: Slow Replica Recovery

**Symptoms:**
- Node joined cluster
- But replicas take hours to allocate

**Check Recovery Status:**
```bash
GET /_cat/recovery?v&h=index,shard,type,stage,time,bytes_percent

# Look for:
# - stage: DONE means complete
# - bytes_percent: progress percentage
```

**Speed Up Recovery:**
```bash
# Increase recovery speed (temporarily)
PUT /_cluster/settings
{
  "transient": {
    "indices.recovery.max_bytes_per_sec": "100mb"  # Default: 40mb
  }
}

# After recovery complete, reset:
PUT /_cluster/settings
{
  "transient": {
    "indices.recovery.max_bytes_per_sec": "40mb"
  }
}
```

---

## 📚 Related Topics

- **[SHARDS.md](./SHARDS.md)** - Understanding primary shards
- **[INDICES.md](./INDICES.md)** - Index management
- **[CLUSTERS-NODES.md](./CLUSTERS-NODES.md)** - Cluster architecture

---

## 🎓 Summary

**Key Takeaways:**

1. ✅ **Replicas = Availability** (not backups!)
2. ✅ **1-2 replicas** sufficient for most production
3. ✅ **Synchronous replication** by default (consistency)
4. ✅ **Read scaling** = linear with replicas
5. ⚠️ **Storage cost** = (1 + replicas) × index size
6. ⚠️ **Write latency** increases with replicas
7. ❌ **Not backups** - use snapshots!
8. ❌ **Don't use 0 replicas** in production

**Decision Matrix:**

| Scenario | Replicas | Why |
|----------|----------|-----|
| Development | 0 | Save resources |
| Standard Production | 1 | Balance cost/availability |
| Critical Production | 2 | Max availability |
| Read-Heavy | 2-3 | Scale reads |
| Write-Heavy | 1 | Minimize write overhead |
| Single Node | 0 | Can't have replicas |

---

*Cập nhật: 31 Tháng 1, 2026*
