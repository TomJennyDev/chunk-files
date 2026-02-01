# Elasticsearch Data Types - Complete Reference

> **Data Types** định nghĩa cách Elasticsearch lưu trữ và index từng field.

---

## 📋 Mục Lục

1. [Text Types](#text-types)
2. [Numeric Types](#numeric-types)
3. [Date Type](#date-type)
4. [Boolean Type](#boolean-type)
5. [Binary Type](#binary-type)
6. [Range Types](#range-types)
7. [Complex Types](#complex-types)
8. [Geo Types](#geo-types)
9. [Specialized Types](#specialized-types)
10. [Field Type Comparison](#field-type-comparison)

---

## 📝 Text Types

### **text** - Full-text search

```bash
PUT /articles
{
  "mappings": {
    "properties": {
      "content": {
        "type": "text",
        "analyzer": "standard"
      }
    }
  }
}
```

**Use for:** Blog posts, descriptions, articles

### **keyword** - Exact match

```bash
PUT /users
{
  "mappings": {
    "properties": {
      "email": {"type": "keyword"},
      "status": {"type": "keyword"}
    }
  }
}
```

**Use for:** IDs, emails, status codes, tags

### **text vs keyword**

| Feature | text | keyword |
|---------|------|---------|
| Analyzed | ✅ Yes | ❌ No |
| Full-text search | ✅ Yes | ❌ No |
| Exact match | ❌ No | ✅ Yes |
| Aggregations | ❌ No | ✅ Yes |
| Sorting | ❌ Slow | ✅ Fast |

---

## 🔢 Numeric Types

| Type | Size | Range | Use Case |
|------|------|-------|----------|
| `byte` | 8-bit | -128 to 127 | Age, small counts |
| `short` | 16-bit | -32,768 to 32,767 | Quantities |
| `integer` | 32-bit | -2^31 to 2^31-1 | IDs, counts |
| `long` | 64-bit | -2^63 to 2^63-1 | Timestamps, large IDs |
| `float` | 32-bit | Decimal | Approximate decimals |
| `double` | 64-bit | Decimal | Scientific data |
| `half_float` | 16-bit | Decimal | Ratings (save space) |
| `scaled_float` | 64-bit | Fixed decimal | Money (exact) |

### Examples:

```bash
PUT /products
{
  "mappings": {
    "properties": {
      "id": {"type": "integer"},
      "quantity": {"type": "long"},
      "price": {
        "type": "scaled_float",
        "scaling_factor": 100  # $19.99 → 1999
      },
      "rating": {"type": "half_float"}
    }
  }
}
```

---

## 📅 Date Type

**Accepts:**
- ISO 8601 strings: `"2026-01-31"` or `"2026-01-31T14:30:00Z"`
- Epoch milliseconds: `1738339200000`
- Custom formats

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

# Index examples:
POST /events/_doc/1
{"created_at": "2026-01-31"}

POST /events/_doc/2
{"created_at": "2026-01-31 14:30:00"}

POST /events/_doc/3
{"created_at": 1738339200000}

# All stored as epoch millis internally
```

**Range Queries:**
```bash
GET /events/_search
{
  "query": {
    "range": {
      "created_at": {
        "gte": "now-7d",
        "lte": "now"
      }
    }
  }
}
```

---

## ✅ Boolean Type

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
{"in_stock": true}

POST /products/_doc/2
{"in_stock": "false"}  # Also works
```

---

## 🔐 Binary Type

Store base64-encoded binary data:

```bash
PUT /files
{
  "mappings": {
    "properties": {
      "content": {"type": "binary"}
    }
  }
}

POST /files/_doc/1
{
  "content": "U29tZSBiaW5hcnkgYmxvYg=="  # Base64
}
```

**Note:** Not searchable! Use for storage only.

---

## 📏 Range Types

Store ranges of values:

### **integer_range**
```bash
PUT /products
{
  "mappings": {
    "properties": {
      "age_range": {"type": "integer_range"}
    }
  }
}

POST /products/_doc/1
{
  "age_range": {
    "gte": 18,
    "lte": 25
  }
}

# Search: Find products for age 20
GET /products/_search
{
  "query": {
    "range": {
      "age_range": {
        "relation": "contains",
        "gte": 20,
        "lte": 20
      }
    }
  }
}
```

### Other Range Types:
- `float_range`
- `long_range`
- `double_range`
- `date_range`
- `ip_range`

---

## 🏗️ Complex Types

### **object** (default for nested JSON)

```bash
PUT /users
{
  "mappings": {
    "properties": {
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

# Search nested field:
GET /users/_search
{
  "query": {
    "match": {"address.city": "NYC"}
  }
}
```

### **nested** (preserves array relationships)

```bash
PUT /resumes
{
  "mappings": {
    "properties": {
      "jobs": {
        "type": "nested",
        "properties": {
          "company": {"type": "keyword"},
          "role": {"type": "keyword"}
        }
      }
    }
  }
}

# Must use nested query:
GET /resumes/_search
{
  "query": {
    "nested": {
      "path": "jobs",
      "query": {
        "bool": {
          "must": [
            {"match": {"jobs.company": "Google"}},
            {"match": {"jobs.role": "Engineer"}}
          ]
        }
      }
    }
  }
}
```

### **flattened** (dynamic object fields)

```bash
PUT /logs
{
  "mappings": {
    "properties": {
      "metadata": {"type": "flattened"}
    }
  }
}

POST /logs/_doc/1
{
  "metadata": {
    "user_id": "123",
    "session_id": "abc",
    "any_field": "any_value"  # Dynamic!
  }
}

# Search any field:
GET /logs/_search
{
  "query": {
    "match": {"metadata.user_id": "123"}
  }
}
```

---

## 🌍 Geo Types

### **geo_point** (latitude/longitude)

```bash
PUT /locations
{
  "mappings": {
    "properties": {
      "location": {"type": "geo_point"}
    }
  }
}

# Index:
POST /locations/_doc/1
{
  "name": "Empire State Building",
  "location": {
    "lat": 40.748817,
    "lon": -73.985428
  }
}

# Or string format:
POST /locations/_doc/2
{
  "name": "Statue of Liberty",
  "location": "40.689247,-74.044502"
}

# Geo distance query:
GET /locations/_search
{
  "query": {
    "geo_distance": {
      "distance": "5km",
      "location": {
        "lat": 40.748817,
        "lon": -73.985428
      }
    }
  }
}
```

### **geo_shape** (polygons, lines, etc.)

```bash
PUT /cities
{
  "mappings": {
    "properties": {
      "boundary": {"type": "geo_shape"}
    }
  }
}

POST /cities/_doc/1
{
  "name": "Manhattan",
  "boundary": {
    "type": "polygon",
    "coordinates": [
      [
        [-74.0060, 40.7128],
        [-73.9352, 40.7306],
        [-74.0060, 40.7128]
      ]
    ]
  }
}
```

---

## 🎯 Specialized Types

### **ip** - IP addresses

```bash
PUT /logs
{
  "mappings": {
    "properties": {
      "client_ip": {"type": "ip"}
    }
  }
}

POST /logs/_doc/1
{"client_ip": "192.168.1.100"}

# Range query:
GET /logs/_search
{
  "query": {
    "range": {
      "client_ip": {
        "gte": "192.168.0.0",
        "lte": "192.168.255.255"
      }
    }
  }
}
```

### **completion** - Autocomplete

```bash
PUT /products
{
  "mappings": {
    "properties": {
      "suggest": {"type": "completion"}
    }
  }
}

POST /products/_doc/1
{
  "name": "Laptop",
  "suggest": ["Laptop", "Computer", "Notebook"]
}

# Autocomplete:
GET /products/_search
{
  "suggest": {
    "my-suggest": {
      "prefix": "lap",
      "completion": {
        "field": "suggest"
      }
    }
  }
}
```

### **token_count** - Count tokens

```bash
PUT /articles
{
  "mappings": {
    "properties": {
      "content": {"type": "text"},
      "word_count": {
        "type": "token_count",
        "analyzer": "standard"
      }
    }
  }
}

POST /articles/_doc/1
{
  "content": "The quick brown fox"
}
# word_count automatically calculated: 4
```

### **percolator** - Reverse search

Store queries and match documents against them:

```bash
PUT /queries
{
  "mappings": {
    "properties": {
      "query": {"type": "percolator"}
    }
  }
}

# Store query:
POST /queries/_doc/1
{
  "query": {
    "match": {"message": "error"}
  }
}

# Find matching queries:
GET /queries/_search
{
  "query": {
    "percolate": {
      "field": "query",
      "document": {
        "message": "error occurred"
      }
    }
  }
}
```

---

## 📊 Field Type Comparison

### When to use what?

| Use Case | Type | Why |
|----------|------|-----|
| Email | `keyword` | Exact match |
| Product name | `text` | Full-text search |
| Product SKU | `keyword` | Exact match, aggregations |
| Description | `text` | Full-text search |
| Price | `scaled_float` | Exact decimal values |
| Quantity | `integer` | Whole numbers |
| Created date | `date` | Date queries |
| User age | `byte` | Small numbers |
| In stock? | `boolean` | True/false |
| IP address | `ip` | Range queries |
| Coordinates | `geo_point` | Distance queries |
| Tags | `keyword` | Aggregations |
| Autocomplete | `completion` | Suggestions |

---

## 💡 Best Practices

### ✅ DO:

1. **Choose smallest type that fits:**
```bash
✅ "age": {"type": "byte"}  # -128 to 127
❌ "age": {"type": "long"}  # Wastes space
```

2. **Use scaled_float for money:**
```bash
✅ "price": {"type": "scaled_float", "scaling_factor": 100}
❌ "price": {"type": "float"}  # Rounding errors
```

3. **Use multi-fields:**
```bash
✅ "name": {
     "type": "text",
     "fields": {
       "keyword": {"type": "keyword"}
     }
   }
```

### ❌ DON'T:

1. **Don't use text for aggregations:**
```bash
❌ "category": {"type": "text"}
✅ "category": {"type": "keyword"}
```

2. **Don't use keyword for full-text:**
```bash
❌ "description": {"type": "keyword"}
✅ "description": {"type": "text"}
```

---

## 📚 Summary

**Key Takeaways:**

1. ✅ **text** = Full-text search
2. ✅ **keyword** = Exact match, aggregations
3. ✅ **scaled_float** = Money/currency
4. ✅ **date** = Timestamps, dates
5. ✅ **nested** = Array relationships
6. ✅ **geo_point** = Location data
7. ⚠️ Choose smallest type for efficiency

---

*Cập nhật: 31 Tháng 1, 2026*
