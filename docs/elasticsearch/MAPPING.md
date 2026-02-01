# Elasticsearch Mapping - Hướng Dẫn Chi Tiết

> **Mapping** là schema definition của Elasticsearch, định nghĩa cách documents được indexed và stored.

---

## 📋 Mục Lục

1. [Mapping là gì?](#mapping-là-gì)
2. [Dynamic vs Explicit Mapping](#dynamic-vs-explicit-mapping)
3. [Field Data Types](#field-data-types)
4. [Mapping Parameters](#mapping-parameters)
5. [Index Templates](#index-templates)
6. [Reindexing](#reindexing)
7. [Mapping Updates](#mapping-updates)
8. [Best Practices](#best-practices)
9. [Common Patterns](#common-patterns)
10. [Troubleshooting](#troubleshooting)

---

## 🗺️ Mapping là gì?

**Mapping** giống như **schema** trong SQL database:

```
SQL Database:
┌────────────────────────────────┐
│  CREATE TABLE products (       │
│    id INT PRIMARY KEY,         │
│    name VARCHAR(255),          │
│    price DECIMAL(10,2),        │
│    created_at TIMESTAMP        │
│  );                            │
└────────────────────────────────┘

Elasticsearch Mapping:
┌────────────────────────────────┐
│  PUT /products                 │
│  {                             │
│    "mappings": {               │
│      "properties": {           │
│        "id": {"type": "integer"},
│        "name": {"type": "text"},
│        "price": {"type": "float"},
│        "created_at": {"type": "date"}
│      }                         │
│    }                           │
│  }                             │
└────────────────────────────────┘
```

### Mapping Defines:

1. **Field Types** (text, keyword, integer, etc.)
2. **Analyzers** (how text is processed)
3. **Index Settings** (store? searchable?)
4. **Relationships** (nested, parent-child)

---

## 🤖 Dynamic vs Explicit Mapping

### Dynamic Mapping (Auto-detected)

Elasticsearch tự động detect field types khi index document:

```bash
# NO mapping defined
POST /products/_doc/1
{
  "name": "Laptop",
  "price": 999,
  "tags": ["electronics", "computer"],
  "created_at": "2026-01-31"
}

# Elasticsearch auto-generates:
GET /products/_mapping
```

**Response (Auto-generated):**
```json
{
  "products": {
    "mappings": {
      "properties": {
        "name": {
          "type": "text",  # String → text
          "fields": {
            "keyword": {"type": "keyword"}  # + keyword subfield
          }
        },
        "price": {
          "type": "long"  # Number → long
        },
        "tags": {
          "type": "text",  # Array of strings → text
          "fields": {
            "keyword": {"type": "keyword"}
          }
        },
        "created_at": {
          "type": "date"  # ISO date string → date
        }
      }
    }
  }
}
```

**Dynamic Type Detection Rules:**

| JSON Data Type | Elasticsearch Type |
|----------------|-------------------|
| `true`/`false` | `boolean` |
| `123` | `long` |
| `123.45` | `float` |
| `"2026-01-31"` | `date` (if matches format) |
| `"hello"` | `text` + `keyword` subfield |
| `[1, 2, 3]` | `long` (array of numbers) |
| `null` | Ignored (no mapping) |

### Explicit Mapping (Defined in Advance)

Define mapping BEFORE indexing documents:

```bash
# Create index with explicit mapping
PUT /products
{
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "analyzer": "standard"
      },
      "price": {
        "type": "scaled_float",
        "scaling_factor": 100
      },
      "sku": {
        "type": "keyword"  # Exact match only
      },
      "description": {
        "type": "text",
        "analyzer": "english"
      },
      "created_at": {
        "type": "date",
        "format": "yyyy-MM-dd||epoch_millis"
      }
    }
  }
}
```

### Dynamic vs Explicit Comparison

| Feature | Dynamic | Explicit |
|---------|---------|----------|
| **Setup** | Zero config | Define upfront |
| **Flexibility** | Auto-adapts | Fixed schema |
| **Performance** | Good | Optimized |
| **Control** | Limited | Full control |
| **Type Mistakes** | Easy | Prevented |
| **Best For** | Development, prototyping | Production |

---

## 📊 Field Data Types

### 1. Text Types

#### **text** - Full-text search
```bash
PUT /articles
{
  "mappings": {
    "properties": {
      "title": {
        "type": "text",
        "analyzer": "standard"
      }
    }
  }
}

# Index document
POST /articles/_doc/1
{
  "title": "Quick Brown Fox"
}

# How it's analyzed:
# Input: "Quick Brown Fox"
# Tokens: ["quick", "brown", "fox"]
# Stored inverted index:
# quick → [doc1]
# brown → [doc1]
# fox → [doc1]

# Search (case-insensitive, partial match):
GET /articles/_search
{
  "query": {
    "match": {"title": "brown"}  # ✅ Finds "Quick Brown Fox"
  }
}
```

#### **keyword** - Exact match
```bash
PUT /users
{
  "mappings": {
    "properties": {
      "email": {
        "type": "keyword"  # Exact match only!
      }
    }
  }
}

# Index
POST /users/_doc/1
{
  "email": "john@example.com"
}

# Search (case-sensitive, exact):
GET /users/_search
{
  "query": {
    "term": {"email": "john@example.com"}  # ✅ Exact match
  }
}

GET /users/_search
{
  "query": {
    "term": {"email": "JOHN@example.com"}  # ❌ No match (case-sensitive)
  }
}
```

**When to use text vs keyword?**

| Use Case | Type | Why |
|----------|------|-----|
| Email addresses | `keyword` | Exact match |
| Product SKU | `keyword` | Exact match |
| Status codes | `keyword` | Exact match |
| Blog post title | `text` | Full-text search |
| Product description | `text` | Full-text search |
| Tags | `keyword` | Aggregations, exact |

### 2. Numeric Types

```bash
PUT /products
{
  "mappings": {
    "properties": {
      "id": {"type": "integer"},        # -2^31 to 2^31-1
      "quantity": {"type": "long"},     # -2^63 to 2^63-1
      "price": {"type": "float"},       # 32-bit floating
      "rating": {"type": "half_float"}, # 16-bit (saves space)
      "exact_price": {
        "type": "scaled_float",
        "scaling_factor": 100  # Store 19.99 as 1999
      }
    }
  }
}
```

**Numeric Type Comparison:**

| Type | Size | Range | Use Case |
|------|------|-------|----------|
| `byte` | 8-bit | -128 to 127 | Small numbers, age |
| `short` | 16-bit | -32K to 32K | Counts |
| `integer` | 32-bit | -2B to 2B | IDs, quantities |
| `long` | 64-bit | -9E18 to 9E18 | Timestamps |
| `float` | 32-bit | Decimal | Prices (approx) |
| `double` | 64-bit | Decimal | Scientific |
| `half_float` | 16-bit | Decimal | Ratings (save space) |
| `scaled_float` | 64-bit | Fixed decimal | Money (exact) |

### 3. Date Type

```bash
PUT /events
{
  "mappings": {
    "properties": {
      "created_at": {
        "type": "date",
        "format": "yyyy-MM-dd||yyyy-MM-dd HH:mm:ss||epoch_millis"
      }
    }
  }
}

# Index - multiple formats accepted:
POST /events/_doc/1
{
  "created_at": "2026-01-31"  # ✅ yyyy-MM-dd
}

POST /events/_doc/2
{
  "created_at": "2026-01-31 14:30:00"  # ✅ yyyy-MM-dd HH:mm:ss
}

POST /events/_doc/3
{
  "created_at": 1738339200000  # ✅ epoch millis (Jan 31, 2026)
}

# Range query:
GET /events/_search
{
  "query": {
    "range": {
      "created_at": {
        "gte": "2026-01-01",
        "lte": "2026-12-31"
      }
    }
  }
}
```

### 4. Boolean Type

```bash
PUT /products
{
  "mappings": {
    "properties": {
      "in_stock": {"type": "boolean"}
    }
  }
}

# Accepts: true, false, "true", "false"
POST /products/_doc/1
{
  "in_stock": true  # ✅
}

POST /products/_doc/2
{
  "in_stock": "false"  # ✅ Also works
}
```

### 5. Object & Nested Types

#### **object** (Default for nested JSON)
```bash
PUT /users
{
  "mappings": {
    "properties": {
      "name": {"type": "text"},
      "address": {
        "properties": {
          "street": {"type": "text"},
          "city": {"type": "keyword"},
          "zip": {"type": "keyword"}
        }
      }
    }
  }
}

# Index nested object:
POST /users/_doc/1
{
  "name": "John",
  "address": {
    "street": "123 Main St",
    "city": "NYC",
    "zip": "10001"
  }
}

# Search nested field:
GET /users/_search
{
  "query": {
    "match": {"address.city": "NYC"}  # ✅ Works
  }
}
```

**Problem with Object Type:**

```bash
# Array of objects loses relationship:
POST /resumes/_doc/1
{
  "name": "John",
  "jobs": [
    {"company": "Google", "role": "Engineer"},
    {"company": "Facebook", "role": "Manager"}
  ]
}

# WRONG QUERY (but matches!):
GET /resumes/_search
{
  "query": {
    "bool": {
      "must": [
        {"match": {"jobs.company": "Google"}},
        {"match": {"jobs.role": "Manager"}}  # ❌ Finds John!
      ]
    }
  }
}
# Problem: Relationship lost! John never was Manager at Google!
```

#### **nested** (Preserves relationship)
```bash
PUT /resumes
{
  "mappings": {
    "properties": {
      "name": {"type": "text"},
      "jobs": {
        "type": "nested",  # Preserve array relationships!
        "properties": {
          "company": {"type": "keyword"},
          "role": {"type": "keyword"}
        }
      }
    }
  }
}

# Index same data
POST /resumes/_doc/1
{
  "name": "John",
  "jobs": [
    {"company": "Google", "role": "Engineer"},
    {"company": "Facebook", "role": "Manager"}
  ]
}

# CORRECT QUERY (must use nested query):
GET /resumes/_search
{
  "query": {
    "nested": {
      "path": "jobs",
      "query": {
        "bool": {
          "must": [
            {"match": {"jobs.company": "Google"}},
            {"match": {"jobs.role": "Manager"}}
          ]
        }
      }
    }
  }
}
# Result: No match! ✅ Correct behavior
```

---

## ⚙️ Mapping Parameters

### 1. **index** (Searchable?)

```bash
PUT /users
{
  "mappings": {
    "properties": {
      "email": {
        "type": "keyword",
        "index": true  # Default: searchable
      },
      "password_hash": {
        "type": "keyword",
        "index": false  # Not searchable (but stored)
      }
    }
  }
}

# Can search email:
GET /users/_search
{
  "query": {"term": {"email": "john@example.com"}}  # ✅ Works
}

# Cannot search password:
GET /users/_search
{
  "query": {"term": {"password_hash": "abc123"}}  # ❌ Error!
}
```

**Use `index: false` for:**
- Sensitive data (passwords, tokens)
- Large fields never searched (base64 images)
- Saves disk space & indexing time

### 2. **store** (Retrieve without _source?)

```bash
PUT /logs
{
  "mappings": {
    "properties": {
      "message": {
        "type": "text",
        "store": true  # Store separately from _source
      },
      "metadata": {
        "type": "object",
        "enabled": false  # Don't index OR store
      }
    }
  }
}

# Retrieve only stored fields:
GET /logs/_search
{
  "stored_fields": ["message"],  # Only return 'message'
  "_source": false  # Don't return full _source
}
```

**When to use `store: true`:**
- Large documents, only need specific fields
- `_source` disabled
- Highlight without _source

### 3. **doc_values** (Aggregations/Sorting)

```bash
PUT /products
{
  "mappings": {
    "properties": {
      "price": {
        "type": "float",
        "doc_values": true  # Default: true
      },
      "description": {
        "type": "text",
        "doc_values": false  # text fields don't have doc_values
      }
    }
  }
}

# Can aggregate on price:
GET /products/_search
{
  "aggs": {
    "avg_price": {"avg": {"field": "price"}}  # ✅ Works
  }
}
```

**doc_values disabled = Cannot:**
- ❌ Aggregate
- ❌ Sort
- ❌ Script access

**Use `doc_values: false` to:**
- ✅ Save disk space (~30-40%)
- ✅ Faster indexing
- Use only if field never aggregated/sorted

### 4. **null_value** (Default for null)

```bash
PUT /products
{
  "mappings": {
    "properties": {
      "quantity": {
        "type": "integer",
        "null_value": 0  # Default null to 0
      }
    }
  }
}

# Index with null:
POST /products/_doc/1
{
  "quantity": null  # Treated as 0
}

# Search for null values:
GET /products/_search
{
  "query": {
    "term": {"quantity": 0}  # Finds documents with null
  }
}
```

### 5. **copy_to** (Copy to another field)

```bash
PUT /articles
{
  "mappings": {
    "properties": {
      "title": {
        "type": "text",
        "copy_to": "full_content"  # Copy here
      },
      "body": {
        "type": "text",
        "copy_to": "full_content"  # Copy here too
      },
      "full_content": {
        "type": "text"  # Combined field
      }
    }
  }
}

# Index:
POST /articles/_doc/1
{
  "title": "Elasticsearch Guide",
  "body": "This is a comprehensive guide..."
}

# Search combined field:
GET /articles/_search
{
  "query": {
    "match": {"full_content": "guide"}  # Searches BOTH title & body
  }
}
```

**Use `copy_to` for:**
- Search multiple fields at once
- Create combined search field
- Save query complexity

---

## 📝 Index Templates

**Templates** auto-apply mappings to new indices matching a pattern:

```bash
# Create template for logs-*
PUT /_index_template/logs_template
{
  "index_patterns": ["logs-*"],  # Apply to logs-2026-01, logs-2026-02, etc.
  "template": {
    "settings": {
      "number_of_shards": 3,
      "number_of_replicas": 1
    },
    "mappings": {
      "properties": {
        "timestamp": {
          "type": "date",
          "format": "yyyy-MM-dd HH:mm:ss"
        },
        "level": {
          "type": "keyword"
        },
        "message": {
          "type": "text"
        },
        "user_id": {
          "type": "keyword"
        }
      }
    }
  },
  "priority": 100  # Higher priority wins
}

# Now create index (auto-applies template):
PUT /logs-2026-01

# Check mapping (has template settings):
GET /logs-2026-01/_mapping
```

**Template Priority:**
```
Multiple templates match:
- Template A: priority 100
- Template B: priority 200 ← WINS!
- Template C: priority 50

Higher priority = used
```

---

## 🔄 Reindexing

### Why Reindex?

**Mapping changes NOT allowed:**
- ❌ Change field type (text → keyword)
- ❌ Change analyzer
- ❌ Add new required field with default

**Must reindex!**

### Reindex Process

```bash
# Step 1: Create NEW index with updated mapping
PUT /products_v2
{
  "mappings": {
    "properties": {
      "sku": {
        "type": "keyword"  # Changed from text!
      },
      "name": {"type": "text"},
      "price": {"type": "float"}
    }
  }
}

# Step 2: Copy data from old to new
POST /_reindex
{
  "source": {
    "index": "products"  # Old index
  },
  "dest": {
    "index": "products_v2"  # New index
  }
}

# Step 3: Check progress
GET /_tasks?detailed=true&actions=*reindex

# Step 4: Switch alias (zero downtime!)
POST /_aliases
{
  "actions": [
    {"remove": {"index": "products", "alias": "products_current"}},
    {"add": {"index": "products_v2", "alias": "products_current"}}
  ]
}

# Step 5: Delete old index (after verification)
DELETE /products
```

### Reindex with Transform

```bash
# Reindex with script transformation
POST /_reindex
{
  "source": {"index": "products"},
  "dest": {"index": "products_v2"},
  "script": {
    "source": """
      ctx._source.price = ctx._source.price * 1.1;  // Increase 10%
      ctx._source.updated_at = new Date();
    """
  }
}
```

---

## 🔧 Mapping Updates

### What CAN be updated?

✅ **Add new fields**
```bash
PUT /products/_mapping
{
  "properties": {
    "new_field": {"type": "keyword"}
  }
}
```

✅ **Update parameters (some)**
```bash
PUT /products/_mapping
{
  "properties": {
    "description": {
      "type": "text",
      "fields": {
        "keyword": {"type": "keyword", "ignore_above": 256}
      }
    }
  }
}
```

### What CANNOT be updated?

❌ **Change field type**
```bash
# ERROR! Cannot change text → keyword
PUT /products/_mapping
{
  "properties": {
    "sku": {"type": "keyword"}  # Was text before
  }
}
```

❌ **Change analyzer**
```bash
# ERROR! Cannot change analyzer after indexing
PUT /products/_mapping
{
  "properties": {
    "name": {
      "type": "text",
      "analyzer": "english"  # Was standard before
    }
  }
}
```

**Solution: Reindex!**

---

## 💡 Best Practices

### ✅ DO:

#### 1. **Define Explicit Mappings in Production**
```bash
✅ PUT /products
   {
     "mappings": {
       "properties": {
         "sku": {"type": "keyword"},
         "name": {"type": "text"}
       }
     }
   }

❌ POST /products/_doc/1 {"sku": "ABC123"}  # Dynamic mapping
```

#### 2. **Use keyword for exact match, text for search**
```bash
✅ "email": {"type": "keyword"}  # Exact
✅ "description": {"type": "text"}  # Search

❌ "email": {"type": "text"}  # Wrong! Analyzed
❌ "description": {"type": "keyword"}  # Wrong! No full-text
```

#### 3. **Disable dynamic mapping in production**
```bash
PUT /products
{
  "mappings": {
    "dynamic": "strict",  # Reject unknown fields
    "properties": {
      "name": {"type": "text"}
    }
  }
}

# Try to index unknown field:
POST /products/_doc/1
{
  "name": "Laptop",
  "unknown_field": "value"  # ❌ ERROR! Rejected
}
```

#### 4. **Use multi-fields for flexibility**
```bash
PUT /products
{
  "mappings": {
    "properties": {
      "name": {
        "type": "text",  # Full-text search
        "fields": {
          "keyword": {"type": "keyword"},  # Exact match
          "english": {
            "type": "text",
            "analyzer": "english"  # Stemming
          }
        }
      }
    }
  }
}

# Search options:
# - name (full-text)
# - name.keyword (exact)
# - name.english (stemmed)
```

#### 5. **Use scaled_float for money**
```bash
✅ "price": {
     "type": "scaled_float",
     "scaling_factor": 100
   }

❌ "price": {"type": "float"}  # Rounding errors!
```

### ❌ DON'T:

#### 1. **Don't rely on dynamic mapping**
```bash
❌ Just index documents, let ES figure it out

✅ Define explicit mapping first
```

#### 2. **Don't use text for aggregations**
```bash
❌ GET /products/_search
   {
     "aggs": {
       "by_name": {"terms": {"field": "name"}}  # text field!
     }
   }
   # ERROR or high memory usage

✅ Use name.keyword or define as keyword
```

#### 3. **Don't change mapping after indexing**
```bash
❌ Change field type after data indexed

✅ Plan mapping carefully
✅ Use reindex if needed
```

---

## 📋 Common Patterns

### Pattern 1: **Product Catalog**
```bash
PUT /products
{
  "mappings": {
    "properties": {
      "sku": {"type": "keyword"},  # Exact match
      "name": {
        "type": "text",
        "fields": {"keyword": {"type": "keyword"}}  # Also exact
      },
      "description": {"type": "text", "analyzer": "english"},
      "price": {"type": "scaled_float", "scaling_factor": 100},
      "category": {"type": "keyword"},  # For aggregations
      "tags": {"type": "keyword"},  # Array, exact match
      "in_stock": {"type": "boolean"},
      "created_at": {"type": "date"}
    }
  }
}
```

### Pattern 2: **User Profiles**
```bash
PUT /users
{
  "mappings": {
    "properties": {
      "username": {"type": "keyword"},
      "email": {"type": "keyword"},
      "full_name": {"type": "text"},
      "bio": {"type": "text"},
      "age": {"type": "integer"},
      "address": {
        "properties": {
          "street": {"type": "text"},
          "city": {"type": "keyword"},
          "zip": {"type": "keyword"}
        }
      },
      "preferences": {"type": "object", "enabled": false}  # Not searchable
    }
  }
}
```

### Pattern 3: **Logs/Time-Series**
```bash
PUT /_index_template/logs
{
  "index_patterns": ["logs-*"],
  "template": {
    "mappings": {
      "properties": {
        "timestamp": {"type": "date"},
        "level": {"type": "keyword"},
        "message": {"type": "text"},
        "logger": {"type": "keyword"},
        "thread": {"type": "keyword"},
        "exception": {"type": "text", "index": false}  # Store but don't index
      }
    }
  }
}
```

---

## 🔧 Troubleshooting

### Problem 1: Field type mismatch

**Error:**
```json
{
  "error": {
    "type": "mapper_parsing_exception",
    "reason": "failed to parse field [price] of type [long] in document"
  }
}
```

**Cause:** Sending string to numeric field
```bash
POST /products/_doc/1
{
  "price": "not a number"  # ❌
}
```

**Solution:**
```bash
# Option 1: Fix data
POST /products/_doc/1
{
  "price": 999  # ✅ Correct type
}

# Option 2: Change mapping (reindex needed)
```

### Problem 2: Cannot aggregate on text field

**Error:**
```json
{
  "error": {
    "type": "illegal_argument_exception",
    "reason": "Fielddata is disabled on text fields by default"
  }
}
```

**Cause:** Trying to aggregate on `text` field
```bash
GET /products/_search
{
  "aggs": {
    "by_name": {"terms": {"field": "name"}}  # name is text!
  }
}
```

**Solution:**
```bash
# Use keyword subfield:
GET /products/_search
{
  "aggs": {
    "by_name": {"terms": {"field": "name.keyword"}}  # ✅ Works
  }
}
```

### Problem 3: Mapping explosion

**Symptoms:**
- Thousands of fields
- Slow indexing
- High memory usage

**Cause:** Dynamic mapping creating too many fields
```bash
POST /logs/_doc/1
{
  "user_data": {
    "field1": "value1",
    "field2": "value2",
    # ... thousands of dynamic fields
  }
}
```

**Solution: Limit fields**
```bash
PUT /logs/_settings
{
  "index.mapping.total_fields.limit": 1000  # Default: 1000
}

# Or use enabled: false for dynamic objects:
PUT /logs
{
  "mappings": {
    "properties": {
      "user_data": {
        "type": "object",
        "enabled": false  # Don't index, just store
      }
    }
  }
}
```

---

## 📚 Summary

**Key Takeaways:**

1. ✅ **Mapping = Schema** (defines field types)
2. ✅ **Explicit > Dynamic** (always define in production)
3. ✅ **text = Full-text**, **keyword = Exact match**
4. ✅ **Multi-fields** for flexibility
5. ✅ **Cannot change** field type after indexing
6. ✅ **Reindex** when mapping changes needed
7. ⚠️ **Nested** for array relationships
8. ⚠️ **Templates** for auto-applying mappings

---

*Cập nhật: 31 Tháng 1, 2026*
