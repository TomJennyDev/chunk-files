# Elasticsearch Indices - Hướng Dẫn Chi Tiết

> **Index** là collection của documents trong Elasticsearch, tương tự như table trong SQL database nhưng linh hoạt và mạnh mẽ hơn nhiều.

---

## 📋 Mục Lục

1. [Index là gì?](#index-là-gì)
2. [Index vs SQL Table](#index-vs-sql-table)
3. [Index Structure](#index-structure)
4. [Index Naming Conventions](#index-naming-conventions)
5. [Index Operations](#index-operations)
6. [Index Settings](#index-settings)
7. [Index Templates](#index-templates)
8. [Index Aliases](#index-aliases)
9. [Index Lifecycle Management (ILM)](#index-lifecycle-management-ilm)
10. [Index Performance](#index-performance)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

---

## 📚 Index là gì?

**Index** trong Elasticsearch là:
- **Collection** của documents tương tự nhau
- **Logical namespace** để organize data
- **Unit of search** và aggregation
- **Container** có settings và mappings riêng

### Ví dụ trực quan:

```
Cluster: "e-commerce"
│
├── Index: "products"
│   ├── Document: {id: 1, name: "Laptop", ...}
│   ├── Document: {id: 2, name: "Mouse", ...}
│   └── Document: {id: 3, name: "Keyboard", ...}
│
├── Index: "customers"
│   ├── Document: {id: 1, name: "John", ...}
│   ├── Document: {id: 2, name: "Jane", ...}
│   └── Document: {id: 3, name: "Bob", ...}
│
└── Index: "orders"
    ├── Document: {id: 1, customer: "John", ...}
    ├── Document: {id: 2, customer: "Jane", ...}
    └── Document: {id: 3, customer: "Bob", ...}
```

---

## 🔄 Index vs SQL Table

### Tương đồng:

| SQL | Elasticsearch |
|-----|---------------|
| **Database** | Cluster |
| **Table** | Index |
| **Row** | Document |
| **Column** | Field |
| **Schema** | Mapping |
| **Primary Key** | _id |
| **Index (B-tree)** | Inverted Index |

### Khác biệt quan trọng:

#### 1. **Schema Flexibility**

**SQL (Strict Schema):**
```sql
CREATE TABLE products (
  id INT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL
);

-- Thêm column mới:
ALTER TABLE products ADD COLUMN description TEXT;
-- ⚠️ Downtime! Migration needed!
```

**Elasticsearch (Dynamic Schema):**
```bash
# Không cần define schema trước!
POST /products/_doc/1
{
  "name": "Laptop",
  "price": 999.99
}

# Thêm field mới? Just do it!
POST /products/_doc/2
{
  "name": "Mouse",
  "price": 29.99,
  "description": "Wireless mouse"  # New field!
}
# ✅ No downtime! No migration!
```

#### 2. **JOINs vs Denormalization**

**SQL (Normalized with JOINs):**
```sql
SELECT p.name, c.name as category
FROM products p
JOIN categories c ON p.category_id = c.id;
```

**Elasticsearch (Denormalized):**
```json
{
  "product_name": "Laptop",
  "category_id": 1,
  "category_name": "Electronics"  // Denormalized!
}
```

#### 3. **Full-Text Search**

**SQL:**
```sql
-- Limited text search
SELECT * FROM products 
WHERE description LIKE '%laptop%';
-- ❌ Slow! No relevance scoring!
```

**Elasticsearch:**
```json
GET /products/_search
{
  "query": {
    "match": {
      "description": "laptop"
    }
  }
}
// ✅ Fast! Relevance scoring! Typo tolerance!
```

---

## 🏗️ Index Structure

### Index Components:

```
Index: "products"
│
├── Settings (cấu hình)
│   ├── number_of_shards: 3
│   ├── number_of_replicas: 2
│   ├── refresh_interval: 1s
│   └── analyzers: {...}
│
├── Mappings (schema)
│   ├── name: text
│   ├── price: float
│   ├── category: keyword
│   └── description: text
│
└── Documents (data)
    ├── Doc 1: {name: "Laptop", price: 999}
    ├── Doc 2: {name: "Mouse", price: 29}
    └── Doc 3: {name: "Keyboard", price: 79}
```

### Inverted Index (Behind the scenes):

```
Index "products" với 3 documents:
Doc 1: "fast laptop"
Doc 2: "wireless mouse"
Doc 3: "mechanical keyboard"

Inverted Index tạo ra:
┌──────────┬─────────────┐
│  Term    │ Document ID │
├──────────┼─────────────┤
│ fast     │ [1]         │
│ laptop   │ [1]         │
│ wireless │ [2]         │
│ mouse    │ [2]         │
│ mechanical│ [3]        │
│ keyboard │ [3]         │
└──────────┴─────────────┘

Search "laptop" → Instant lookup → Doc 1 ✅
```

---

## 📝 Index Naming Conventions

### Quy tắc đặt tên:

✅ **GOOD Names:**
```
products
products-2026-01
products_v2
logs-app-production
users-active
search-history-2026-01-31
```

**Characteristics:**
- Lowercase chữ thường
- Hyphen `-` hoặc underscore `_`
- Descriptive (mô tả rõ ràng)
- Include date for time-series data
- Version suffix if needed

❌ **BAD Names:**
```
Products              # Uppercase
my index              # Space (not allowed!)
.internal-index       # Leading dot (system reserved)
_hidden               # Leading underscore (system reserved)
index1, index2        # Không mô tả
data, test            # Too vague
```

### Time-Series Naming Pattern:

```bash
# Daily indices
logs-2026-01-01
logs-2026-01-02
logs-2026-01-03

# Monthly indices
products-2026-01
products-2026-02

# Hourly indices (high volume)
metrics-2026-01-31-00
metrics-2026-01-31-01
metrics-2026-01-31-02
```

**Benefits:**
- ✅ Easy to delete old data (drop entire index)
- ✅ Queries can target specific date ranges
- ✅ Better performance (smaller indices)
- ✅ ILM automation

### Wildcard Patterns:

```bash
# Search across multiple indices
GET /logs-2026-01-*/_search
# Searches: logs-2026-01-01, logs-2026-01-02, ...

GET /products-*/_search
# Searches: products-2026-01, products-2026-02, ...

GET /logs-*,metrics-*/_search
# Searches both logs and metrics indices
```

---

## ⚙️ Index Operations

### 1. CREATE Index

#### Basic Creation:
```bash
PUT /products
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 2
  },
  "mappings": {
    "properties": {
      "name": {
        "type": "text"
      },
      "price": {
        "type": "float"
      },
      "category": {
        "type": "keyword"
      }
    }
  }
}

# Response:
{
  "acknowledged": true,
  "shards_acknowledged": true,
  "index": "products"
}
```

#### Create with Aliases:
```bash
PUT /products-v2
{
  "aliases": {
    "products": {}  # Alias pointing to this index
  },
  "settings": {...},
  "mappings": {...}
}
```

#### Create with Advanced Settings:
```bash
PUT /logs-2026-01
{
  "settings": {
    "number_of_shards": 5,
    "number_of_replicas": 1,
    "refresh_interval": "30s",
    "max_result_window": 10000,
    "analysis": {
      "analyzer": {
        "custom_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "stop"]
        }
      }
    }
  },
  "mappings": {...}
}
```

### 2. READ Index Info

```bash
# Get specific index
GET /products

# Get multiple indices
GET /products,customers

# Get all indices
GET /_all
GET /*

# List all indices (compact view)
GET /_cat/indices?v

# Output:
health status index     pri rep docs.count store.size
green  open   products    3   2      10000     50.2mb
yellow open   customers   1   1       5000     20.1mb
green  open   orders      2   1      50000    150.5mb
```

### 3. UPDATE Index Settings

```bash
# Update dynamic settings (no restart needed)
PUT /products/_settings
{
  "index": {
    "number_of_replicas": 1,        # Can change
    "refresh_interval": "30s"       # Can change
  }
}

# ⚠️ Cannot change static settings:
PUT /products/_settings
{
  "index": {
    "number_of_shards": 5  # ❌ ERROR: Cannot change shards!
  }
}
```

**Static vs Dynamic Settings:**

| Static (Cannot Change) | Dynamic (Can Change) |
|------------------------|----------------------|
| `number_of_shards` | `number_of_replicas` |
| `codec` | `refresh_interval` |
| `routing_partition_size` | `max_result_window` |

**To change static settings → Reindex!**

### 4. DELETE Index

```bash
# Delete single index
DELETE /products

# Delete multiple indices
DELETE /products,customers

# Delete pattern
DELETE /logs-2025-*

# Delete all indices (⚠️ DANGER!)
DELETE /_all  # Usually disabled in production!
```

**Safety Check:**
```bash
# Enable/disable wildcard deletions
PUT /_cluster/settings
{
  "persistent": {
    "action.destructive_requires_name": true  # Prevent accidental deletion
  }
}
```

### 5. CLOSE / OPEN Index

**Why close an index?**
- Temporarily not needed
- Save memory (closed index uses almost no memory)
- Keep data but don't search it

```bash
# Close index (no searches, no indexing)
POST /old-logs/_close

# Index still exists but uses minimal resources
GET /_cat/indices?v
# Status: close

# Open again when needed
POST /old-logs/_open
```

**Comparison:**

| Operation | Storage | Memory | Searchable |
|-----------|---------|--------|------------|
| **Open** | Yes | Yes | Yes |
| **Closed** | Yes | Minimal | No |
| **Deleted** | No | No | No |

### 6. REINDEX

**When to reindex:**
- Change number of shards
- Change field types
- Rename fields
- Migrate to new index with better settings

```bash
POST /_reindex
{
  "source": {
    "index": "products-old"
  },
  "dest": {
    "index": "products-new"
  }
}

# With query (partial reindex):
POST /_reindex
{
  "source": {
    "index": "products-old",
    "query": {
      "range": {
        "price": {"gte": 100}
      }
    }
  },
  "dest": {
    "index": "products-expensive"
  }
}

# Transform during reindex:
POST /_reindex
{
  "source": {
    "index": "products-old"
  },
  "dest": {
    "index": "products-new"
  },
  "script": {
    "source": "ctx._source.price = ctx._source.price * 1.1"  # Increase 10%
  }
}
```

### 7. REFRESH

**Understanding Refresh:**
- New documents not immediately searchable
- Refresh makes them searchable
- Default refresh interval: 1 second

```bash
# Force refresh (make recent docs searchable immediately)
POST /products/_refresh

# Disable auto-refresh (bulk loading)
PUT /products/_settings
{
  "index.refresh_interval": "-1"  # Disable
}

# Re-enable after bulk load
PUT /products/_settings
{
  "index.refresh_interval": "1s"  # Default
}
```

---

## 🎛️ Index Settings

### Essential Settings:

#### 1. **Shards & Replicas**

```bash
{
  "settings": {
    "number_of_shards": 3,      # Static (cannot change)
    "number_of_replicas": 2     # Dynamic (can change)
  }
}
```

**Calculation:**
```
Total shards = primaries × (1 + replicas)
             = 3 × (1 + 2)
             = 9 shards total
```

**Recommendations:**
- **Small index (<50GB):** 1 shard
- **Medium index (50-500GB):** 3-5 shards
- **Large index (>500GB):** 10-30 shards
- **Shard size:** 10-50GB optimal

#### 2. **Refresh Interval**

```bash
{
  "settings": {
    "index.refresh_interval": "1s"  # Default
  }
}
```

**Options:**
- `"1s"` (default) - Near real-time search
- `"30s"` - Reduce refresh overhead (better indexing performance)
- `"-1"` - Disable auto-refresh (bulk loading)
- `"5m"` - Rare searches, prioritize indexing

**Trade-off:**
```
Shorter interval (1s):
✅ Faster search visibility
❌ Higher indexing overhead

Longer interval (30s):
✅ Better indexing performance
❌ Slower search visibility
```

#### 3. **Max Result Window**

```bash
{
  "settings": {
    "index.max_result_window": 10000  # Default
  }
}
```

**Why the limit?**
```bash
# This would require sorting 100,000 docs in memory:
GET /products/_search
{
  "from": 90000,
  "size": 10000
}
# ❌ ERROR: Result window too large!
```

**Solutions:**
```bash
# 1. Use search_after (pagination)
# 2. Use scroll API (full scan)
# 3. Increase limit (not recommended)
PUT /products/_settings
{
  "index.max_result_window": 50000
}
```

#### 4. **Number of Routing Shards**

```bash
{
  "settings": {
    "number_of_routing_shards": 30
  }
}
```

**Purpose:** Enable future shard splitting

```
Initial: 3 shards
routing_shards: 30

Can split to:
- 6 shards (30 / 5)
- 10 shards (30 / 3)
- 15 shards (30 / 2)
- 30 shards (30 / 1)
```

#### 5. **Translog Settings**

```bash
{
  "settings": {
    "index.translog.durability": "request",  # or "async"
    "index.translog.sync_interval": "5s",
    "index.translog.flush_threshold_size": "512mb"
  }
}
```

**Durability options:**
- `"request"` (default) - Fsync after every request (slower, safer)
- `"async"` - Fsync every 5s (faster, risk of data loss)

#### 6. **Compression**

```bash
{
  "settings": {
    "index.codec": "best_compression"  # or "default"
  }
}
```

**Comparison:**

| Codec | Compression | Speed | Use Case |
|-------|-------------|-------|----------|
| `default` | Standard | Fast | Most cases |
| `best_compression` | High (DEFLATE) | Slower | Save storage |

### Complete Settings Example:

```bash
PUT /products-optimized
{
  "settings": {
    // Sharding
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "number_of_routing_shards": 30,
    
    // Performance
    "refresh_interval": "30s",
    "max_result_window": 10000,
    
    // Durability
    "translog.durability": "async",
    "translog.sync_interval": "5s",
    
    // Storage
    "codec": "best_compression",
    
    // Analysis
    "analysis": {
      "analyzer": {
        "custom_text": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "stop", "snowball"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "analyzer": "custom_text"
      },
      "price": {"type": "float"},
      "category": {"type": "keyword"}
    }
  }
}
```

---

## 📋 Index Templates

**Problem:** Creating many similar indices manually is tedious

**Solution:** Index Templates automatically apply settings to new indices

### Basic Template:

```bash
PUT /_index_template/logs_template
{
  "index_patterns": ["logs-*"],  # Apply to indices matching pattern
  "template": {
    "settings": {
      "number_of_shards": 2,
      "number_of_replicas": 1,
      "refresh_interval": "30s"
    },
    "mappings": {
      "properties": {
        "timestamp": {"type": "date"},
        "level": {"type": "keyword"},
        "message": {"type": "text"},
        "service": {"type": "keyword"}
      }
    }
  }
}
```

**Usage:**
```bash
# Create index matching pattern
PUT /logs-2026-01-31

# Template automatically applied! ✅
# Already has settings and mappings from template
```

### Advanced Template with Aliases:

```bash
PUT /_index_template/products_template
{
  "index_patterns": ["products-*"],
  "template": {
    "settings": {
      "number_of_shards": 3,
      "number_of_replicas": 2
    },
    "mappings": {...},
    "aliases": {
      "products": {},  # Auto-create alias
      "all_products": {}
    }
  },
  "priority": 100,  # Higher priority wins if multiple templates match
  "version": 1
}
```

### Component Templates (Reusable):

```bash
# 1. Create component template for common settings
PUT /_component_template/common_settings
{
  "template": {
    "settings": {
      "number_of_shards": 3,
      "codec": "best_compression"
    }
  }
}

# 2. Create component template for log mappings
PUT /_component_template/log_mappings
{
  "template": {
    "mappings": {
      "properties": {
        "timestamp": {"type": "date"},
        "level": {"type": "keyword"},
        "message": {"type": "text"}
      }
    }
  }
}

# 3. Compose index template from components
PUT /_index_template/logs_template
{
  "index_patterns": ["logs-*"],
  "composed_of": ["common_settings", "log_mappings"],
  "priority": 100
}
```

**Benefits:**
- ✅ DRY (Don't Repeat Yourself)
- ✅ Consistent configurations
- ✅ Easy to update (change component → affects all)
- ✅ Modular design

---

## 🔀 Index Aliases

**Alias** = Pointer to one or more indices

### Why Use Aliases?

#### 1. **Zero-Downtime Reindex**

```bash
# Current state:
products-v1 (alias: products) ← Application queries here

# Create new index
PUT /products-v2 {...}

# Reindex data
POST /_reindex
{
  "source": {"index": "products-v1"},
  "dest": {"index": "products-v2"}
}

# Atomic switch alias
POST /_aliases
{
  "actions": [
    {"remove": {"index": "products-v1", "alias": "products"}},
    {"add": {"index": "products-v2", "alias": "products"}}
  ]
}

# Application now queries products-v2 ✅
# No code changes needed!

# Delete old index
DELETE /products-v1
```

#### 2. **Multi-Index Queries**

```bash
# Create alias spanning multiple indices
POST /_aliases
{
  "actions": [
    {"add": {"index": "logs-2026-01-*", "alias": "logs-january"}},
    {"add": {"index": "logs-2026-02-*", "alias": "logs-february"}}
  ]
}

# Query alias (searches all underlying indices)
GET /logs-january/_search
# Searches: logs-2026-01-01, logs-2026-01-02, ..., logs-2026-01-31
```

#### 3. **Filtered Aliases**

```bash
POST /_aliases
{
  "actions": [
    {
      "add": {
        "index": "products",
        "alias": "electronics",
        "filter": {
          "term": {"category": "electronics"}
        }
      }
    }
  ]
}

# Query alias (auto-filtered!)
GET /electronics/_search
{
  "query": {"match": {"name": "laptop"}}
}
# Only searches electronics products ✅
```

### Alias Operations:

```bash
# Add alias
POST /_aliases
{
  "actions": [
    {"add": {"index": "products-v1", "alias": "products"}}
  ]
}

# Remove alias
POST /_aliases
{
  "actions": [
    {"remove": {"index": "products-v1", "alias": "products"}}
  ]
}

# Atomic swap (zero downtime)
POST /_aliases
{
  "actions": [
    {"remove": {"index": "old_index", "alias": "my_alias"}},
    {"add": {"index": "new_index", "alias": "my_alias"}}
  ]
}

# List aliases
GET /_cat/aliases?v

# Get specific alias
GET /_alias/products

# Get all aliases for index
GET /products-v1/_alias
```

### Write Alias:

```bash
POST /_aliases
{
  "actions": [
    {
      "add": {
        "index": "logs-2026-01-31",
        "alias": "logs-write",
        "is_write_index": true  # Allow writes
      }
    }
  ]
}

# Write to alias
POST /logs-write/_doc
{
  "message": "New log entry"
}
# Written to logs-2026-01-31 ✅
```

---

## ♻️ Index Lifecycle Management (ILM)

**ILM** = Automate index lifecycle based on age/size

### Lifecycle Phases:

```
Hot → Warm → Cold → Frozen → Delete
```

#### **Hot Phase:**
- Actively writing and querying
- Fast storage (SSD)
- All shards

#### **Warm Phase:**
- No more writes
- Still querying
- Reduce replicas
- Move to slower storage

#### **Cold Phase:**
- Rare queries
- Searchable snapshots
- Minimal resources

#### **Frozen Phase:**
- Very rare queries
- Mounted from snapshot
- Almost no heap usage

#### **Delete Phase:**
- Delete old data

### ILM Policy Example:

```bash
PUT /_ilm/policy/logs_policy
{
  "policy": {
    "phases": {
      "hot": {
        "actions": {
          "rollover": {
            "max_size": "50GB",
            "max_age": "7d"
          }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "shrink": {
            "number_of_shards": 1
          },
          "forcemerge": {
            "max_num_segments": 1
          }
        }
      },
      "cold": {
        "min_age": "30d",
        "actions": {
          "freeze": {}
        }
      },
      "delete": {
        "min_age": "90d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

### Apply ILM to Index Template:

```bash
PUT /_index_template/logs_template
{
  "index_patterns": ["logs-*"],
  "template": {
    "settings": {
      "index.lifecycle.name": "logs_policy",
      "index.lifecycle.rollover_alias": "logs"
    }
  }
}
```

### Bootstrap First Index:

```bash
PUT /logs-000001
{
  "aliases": {
    "logs": {
      "is_write_index": true
    }
  }
}
```

**ILM will automatically:**
1. Rollover to `logs-000002` when conditions met
2. Move old indices through phases
3. Delete indices after 90 days

---

## 💡 Best Practices

### ✅ DO:

#### 1. **Use Descriptive Names**
```bash
✅ products-2026-01
✅ logs-application-production
✅ users-active-v2

❌ index1
❌ data
❌ test
```

#### 2. **Plan Shard Strategy**
```bash
# Small index (<50GB):
"number_of_shards": 1

# Medium index (50-500GB):
"number_of_shards": 3

# Large index (>500GB):
"number_of_shards": 10-30
```

#### 3. **Use Index Templates**
```bash
# Don't create indices manually!
# Use templates for consistency
```

#### 4. **Use Aliases**
```bash
# Applications should query aliases, not indices directly
GET /products/_search  # Alias
# Not: GET /products-v1/_search
```

#### 5. **Implement ILM**
```bash
# Automate lifecycle
# Don't manually delete old data
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

#### 3. **Don't Store Everything in One Index**
```bash
❌ All data in "data" index
✅ Separate indices: products, customers, orders
```

#### 4. **Don't Query Wildcard Unless Needed**
```bash
❌ GET /*/_search (all indices!)
✅ GET /products/_search (specific index)
```

---

## 🔧 Troubleshooting

### Problem 1: Index Creation Failed

**Error:**
```json
{
  "error": {
    "type": "invalid_index_name_exception",
    "reason": "Invalid index name [Products]"
  }
}
```

**Solution:**
```bash
# Use lowercase
PUT /products  # ✅
```

### Problem 2: Cannot Change Shards

**Error:**
```json
{
  "error": {
    "type": "illegal_argument_exception",
    "reason": "Can't update non dynamic settings [[index.number_of_shards]]"
  }
}
```

**Solution:**
```bash
# Must reindex
POST /_reindex
{
  "source": {"index": "old_index"},
  "dest": {"index": "new_index"}
}
```

### Problem 3: Too Many Shards

**Symptoms:**
- High memory usage
- Slow cluster state updates
- Circuit breaker errors

**Solution:**
```bash
# Check shard count
GET /_cat/shards?v

# Reduce shards:
# 1. Reindex to fewer shards
# 2. Use shrink API
POST /source_index/_shrink/target_index
{
  "settings": {
    "index.number_of_shards": 1
  }
}
```

---

## 📚 Related Topics

- **[DOCUMENTS.md](./DOCUMENTS.md)** - Understanding documents
- **[SHARDS.md](./SHARDS.md)** - Deep dive into sharding
- **[MAPPING.md](./MAPPING.md)** - Define index structure

---

*Cập nhật: 31 Tháng 1, 2026*
