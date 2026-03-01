# Elasticsearch Documents - Hướng Dẫn Chi Tiết

> **Document** là đơn vị cơ bản nhất của dữ liệu trong Elasticsearch. Hiểu rõ về Documents là nền tảng để làm việc hiệu quả với Elasticsearch.

---

## 📋 Mục Lục

1. [Document là gì?](#document-là-gì)
2. [Tại sao Elasticsearch sử dụng Document?](#tại-sao-elasticsearch-sử-dụng-document)
3. [Cấu trúc của Document](#cấu-trúc-của-document)
4. [Các thuộc tính Metadata](#các-thuộc-tính-metadata)
5. [CRUD Operations](#crud-operations)
6. [Bulk Operations](#bulk-operations)
7. [Versioning & Concurrency](#versioning--concurrency)
8. [Ưu điểm của Document Model](#ưu-điểm-của-document-model)
9. [Nhược điểm của Document Model](#nhược-điểm-của-document-model)
10. [Best Practices](#best-practices)
11. [Use Cases](#use-cases)
12. [Troubleshooting](#troubleshooting)

---

## 📄 Document là gì?

**Document** trong Elasticsearch tương tự như:
- **Row (dòng)** trong SQL database
- **Document** trong MongoDB
- **Record** trong hệ thống truyền thống
- **Object** trong lập trình hướng đối tượng

### Đặc điểm chính:

```json
{
  "id": "product-123",
  "name": "Laptop Dell XPS 13",
  "price": 1299.99,
  "category": "electronics",
  "brand": "Dell",
  "in_stock": true,
  "tags": ["laptop", "ultrabook", "premium"],
  "specs": {
    "screen": "13.3 inch",
    "processor": "Intel Core i7",
    "ram": "16GB",
    "storage": "512GB SSD"
  },
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-31T14:20:00Z"
}
```

**Key Points:**
- ✅ Định dạng JSON (dễ đọc, dễ xử lý)
- ✅ Schema linh hoạt (không cần định nghĩa trước)
- ✅ Hỗ trợ nested objects (đối tượng lồng nhau)
- ✅ Self-describing (tự mô tả cấu trúc của nó)
- ✅ Có thể index và search toàn bộ nội dung

---

## 🤔 Tại sao Elasticsearch sử dụng Document?

### 1. **Tính linh hoạt về Schema**

**SQL (Rigid Schema):**
```sql
-- Phải định nghĩa trước mọi column
CREATE TABLE products (
  id INT PRIMARY KEY,
  name VARCHAR(255),
  price DECIMAL(10,2)
);

-- Thêm field mới? Phải ALTER TABLE!
ALTER TABLE products ADD COLUMN description TEXT;
```

**Elasticsearch (Flexible Schema):**
```json
// Document 1: Chỉ có thông tin cơ bản
{
  "name": "Basic Mouse",
  "price": 19.99
}

// Document 2: Có thêm specs (KHÔNG cần thay đổi schema!)
{
  "name": "Gaming Mouse",
  "price": 79.99,
  "specs": {
    "dpi": "16000",
    "buttons": 8,
    "rgb": true
  }
}

// Document 3: Hoàn toàn khác biệt
{
  "name": "Wireless Keyboard",
  "price": 129.99,
  "battery_life": "6 months",
  "layout": "US"
}
```

**Lợi ích:**
- ✅ Không cần migration khi thêm field mới
- ✅ Mỗi document có thể có structure khác nhau
- ✅ Phát triển nhanh hơn (no downtime cho schema changes)
- ✅ Phù hợp với agile development

### 2. **Nested Objects tự nhiên**

**SQL (Cần nhiều tables + JOINs):**
```sql
-- Products table
CREATE TABLE products (
  id INT PRIMARY KEY,
  name VARCHAR(255)
);

-- Specs table (riêng biệt)
CREATE TABLE product_specs (
  id INT PRIMARY KEY,
  product_id INT,
  key VARCHAR(100),
  value VARCHAR(255),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Lấy product + specs: Cần JOIN!
SELECT p.*, ps.key, ps.value
FROM products p
LEFT JOIN product_specs ps ON p.id = ps.product_id
WHERE p.id = 123;
```

**Elasticsearch (Nested tự nhiên):**
```json
// Tất cả trong 1 document!
{
  "id": "123",
  "name": "Laptop",
  "specs": {
    "cpu": "Intel i7",
    "ram": "16GB",
    "storage": "512GB SSD",
    "screen": {
      "size": "15.6 inch",
      "resolution": "1920x1080",
      "type": "IPS"
    }
  }
}

// Truy vấn: KHÔNG cần JOIN!
GET /products/_doc/123
```

**Lợi ích:**
- ✅ Đọc nhanh hơn (1 query thay vì JOIN)
- ✅ Cấu trúc dữ liệu tự nhiên
- ✅ Không có N+1 query problem
- ✅ Dễ hiểu và maintain

### 3. **Self-Contained Data**

**Microservices-Friendly:**
```json
// Product Service document
{
  "product_id": "123",
  "name": "Laptop",
  "price": 999.99,
  
  // Denormalized user info (không cần gọi User Service!)
  "seller": {
    "id": "user-456",
    "name": "John Store",
    "rating": 4.8
  },
  
  // Denormalized category info
  "category": {
    "id": "cat-789",
    "name": "Electronics",
    "path": "Electronics > Computers > Laptops"
  }
}
```

**Lợi ích:**
- ✅ Mỗi service có đủ data cần thiết
- ✅ Giảm inter-service calls
- ✅ Tăng performance
- ✅ Fault tolerant (service khác down vẫn hoạt động)

### 4. **Easy Replication**

```
Traditional DB với Foreign Keys:
┌─────────────┐      ┌─────────────┐
│  Products   │─────>│  Categories │
└─────────────┘      └─────────────┘
       │
       │ Foreign Key
       v
┌─────────────┐
│   Brands    │
└─────────────┘

Replication khó khăn:
❌ Phải đồng bộ nhiều tables
❌ Foreign keys phức tạp
❌ Referential integrity issues
```

```
Elasticsearch Documents (Self-contained):
┌─────────────────────────────┐
│  Product Document           │
│  {                          │
│    id: 123,                 │
│    name: "Laptop",          │
│    category: "Electronics", │
│    brand: "Dell"            │
│  }                          │
└─────────────────────────────┘

Replication đơn giản:
✅ Copy document sang node khác
✅ Không có dependencies
✅ Mỗi document độc lập
```

---

## 🏗️ Cấu trúc của Document

### Document hoàn chỉnh với metadata:

```json
{
  // ============ METADATA (do Elasticsearch quản lý) ============
  "_index": "products",              // Index chứa document
  "_id": "product-123",              // ID duy nhất
  "_version": 5,                     // Phiên bản (tăng mỗi lần update)
  "_seq_no": 42,                     // Sequence number (Optimistic Concurrency)
  "_primary_term": 1,                // Primary term (phát hiện split-brain)
  "_score": 4.532,                   // Relevance score (chỉ có khi search)
  "_routing": "user-456",            // Custom routing (optional)
  
  // ============ SOURCE DATA (dữ liệu thực tế) ============
  "_source": {
    // Basic Info
    "name": "Dell XPS 13 Laptop",
    "sku": "DELL-XPS13-2026",
    "description": "Premium ultrabook with stunning display",
    
    // Pricing
    "price": 1299.99,
    "currency": "USD",
    "discount_percentage": 10,
    "final_price": 1169.99,
    
    // Categorization
    "category": "Electronics",
    "subcategory": "Computers",
    "tags": ["laptop", "ultrabook", "premium", "dell"],
    "brand": {
      "id": "brand-dell",
      "name": "Dell",
      "country": "USA"
    },
    
    // Stock & Availability
    "in_stock": true,
    "quantity": 45,
    "warehouse_locations": ["WH-NY", "WH-LA", "WH-TX"],
    
    // Specifications (Nested Object)
    "specs": {
      "screen": {
        "size": "13.3 inch",
        "resolution": "1920x1200",
        "type": "InfinityEdge Display",
        "touch": true
      },
      "processor": {
        "brand": "Intel",
        "model": "Core i7-1165G7",
        "cores": 4,
        "threads": 8,
        "base_clock": "2.8 GHz"
      },
      "memory": {
        "ram": "16GB",
        "type": "LPDDR4x",
        "speed": "4267 MHz"
      },
      "storage": {
        "type": "SSD",
        "capacity": "512GB",
        "interface": "PCIe NVMe"
      },
      "graphics": "Intel Iris Xe",
      "battery": "52WHr",
      "weight": "2.64 lbs",
      "ports": ["2x Thunderbolt 4", "1x USB-C 3.2", "microSD"]
    },
    
    // Reviews & Ratings
    "rating": {
      "average": 4.7,
      "count": 1234,
      "distribution": {
        "5_star": 800,
        "4_star": 300,
        "3_star": 100,
        "2_star": 20,
        "1_star": 14
      }
    },
    
    // SEO & Marketing
    "seo": {
      "title": "Dell XPS 13 - Premium Ultrabook 2026",
      "meta_description": "Buy Dell XPS 13 with Intel i7...",
      "keywords": ["dell xps", "ultrabook", "premium laptop"]
    },
    
    // Images
    "images": [
      {
        "url": "https://cdn.example.com/xps13-front.jpg",
        "alt": "Dell XPS 13 Front View",
        "primary": true
      },
      {
        "url": "https://cdn.example.com/xps13-side.jpg",
        "alt": "Dell XPS 13 Side View",
        "primary": false
      }
    ],
    
    // Seller Info
    "seller": {
      "id": "seller-456",
      "name": "Official Dell Store",
      "rating": 4.9,
      "verified": true
    },
    
    // Shipping
    "shipping": {
      "free_shipping": true,
      "estimated_days": "2-3",
      "international": true
    },
    
    // Timestamps
    "created_at": "2026-01-15T10:30:00Z",
    "updated_at": "2026-01-31T14:20:00Z",
    "published_at": "2026-01-16T09:00:00Z",
    
    // Audit Trail
    "created_by": "admin@example.com",
    "last_modified_by": "editor@example.com",
    
    // Status
    "status": "published",
    "visibility": "public"
  }
}
```

---

## 🔑 Các thuộc tính Metadata

### 1. `_index`

**Mục đích:** Xác định document thuộc index nào

```json
{
  "_index": "products-2026-01"
}
```

**Tại sao quan trọng:**
- Index giống như "database table" trong SQL
- Logical grouping của các documents tương tự nhau
- Có thể có nhiều indices: `products-2026-01`, `products-2026-02`, ...
- Index có thể có settings và mappings riêng

**Best Practices:**
```bash
# ✅ GOOD: Descriptive index names
products-2026-01
logs-application-prod-2026-01-31
users_v2

# ❌ BAD: Vague or uppercase names
Index1
MY_INDEX
data
```

### 2. `_id`

**Mục đích:** Unique identifier cho document

#### **Auto-generated ID:**
```bash
POST /products/_doc
{
  "name": "Mouse"
}

# Response:
{
  "_id": "aB3dE5fG7hI9jK1L",  # Auto UUID
  "_version": 1
}
```

#### **Custom ID:**
```bash
PUT /products/_doc/product-mouse-001
{
  "name": "Wireless Mouse"
}

# Response:
{
  "_id": "product-mouse-001",  # Your custom ID
  "_version": 1
}
```

**Khi nào dùng Custom ID?**

✅ **NÊN dùng khi:**
- Bạn có business key duy nhất (SKU, email, username)
- Cần update document theo ID từ hệ thống khác
- Cần idempotent operations
- Có external system đã có IDs

```json
// E-commerce: Dùng SKU
{"_id": "SKU-LAPTOP-DELL-XPS13"}

// Users: Dùng email hoặc username
{"_id": "user-john.doe@example.com"}

// Logs: Dùng timestamp + hostname
{"_id": "2026-01-31-server1-12345"}
```

❌ **KHÔNG nên dùng khi:**
- Không có business key tự nhiên
- Auto-incrementing IDs (tạo hotspots!)
- Sequential IDs (unbalanced shards)

**Vấn đề với Sequential IDs:**
```bash
# ❌ BAD: Sequential IDs
{"_id": "1"}
{"_id": "2"}
{"_id": "3"}
# Tất cả đi vào cùng 1 shard! (hash(1) % 3 = hash(2) % 3 = ...)

# ✅ GOOD: Random/UUID IDs
{"_id": "a1b2c3d4"}
{"_id": "x9y8z7w6"}
{"_id": "m5n4o3p2"}
# Distributed đều across shards
```

### 3. `_version`

**Mục đích:** Optimistic Concurrency Control

```bash
# Tạo document
PUT /products/_doc/123
{
  "name": "Laptop",
  "price": 999
}
# Response: {"_version": 1}

# Update lần 1
POST /products/_update/123
{
  "doc": {"price": 899}
}
# Response: {"_version": 2}

# Update lần 2
POST /products/_update/123
{
  "doc": {"price": 799}
}
# Response: {"_version": 3}
```

**Sử dụng version để tránh conflicts:**

```bash
# User A đọc document (version: 5)
GET /products/_doc/123
# {"_version": 5, "_source": {"price": 999}}

# User B cũng đọc document (version: 5)
GET /products/_doc/123
# {"_version": 5, "_source": {"price": 999}}

# User A update
PUT /products/_doc/123?if_seq_no=5&if_primary_term=1
{
  "name": "Laptop",
  "price": 899  # User A giảm giá
}
# Success! Version now: 6

# User B cũng update
PUT /products/_doc/123?if_seq_no=5&if_primary_term=1
{
  "name": "Laptop",
  "price": 799  # User B cũng giảm giá
}
# ❌ ERROR: version_conflict!
# Document đã thay đổi (version = 6), không phải 5 nữa
```

### 4. `_seq_no` và `_primary_term`

**Modern Optimistic Concurrency (từ Elasticsearch 7.x):**

```bash
GET /products/_doc/123

# Response:
{
  "_seq_no": 42,
  "_primary_term": 1,
  "_source": {...}
}

# Update với optimistic concurrency
PUT /products/_doc/123?if_seq_no=42&if_primary_term=1
{
  "name": "Updated Laptop"
}
# ✅ Success nếu chưa ai update
# ❌ Error nếu đã có người update
```

**So sánh `_version` vs `_seq_no`:**

| Feature | `_version` | `_seq_no` + `_primary_term` |
|---------|------------|------------------------------|
| Elasticsearch Version | < 7.0 (deprecated) | >= 7.0 (recommended) |
| Scope | Per-document | Per-shard sequence |
| Accuracy | Good | Better |
| Use Case | Simple OCC | Production systems |

### 5. `_score`

**Mục đích:** Relevance score (độ liên quan) trong search results

```bash
GET /products/_search
{
  "query": {
    "match": {
      "description": "fast laptop"
    }
  }
}

# Response:
{
  "hits": {
    "hits": [
      {
        "_score": 8.234,  # Highly relevant
        "_source": {"name": "Lightning Fast Laptop", "description": "Super fast laptop..."}
      },
      {
        "_score": 5.123,  # Moderately relevant
        "_source": {"name": "Budget Laptop", "description": "Decent laptop for daily use..."}
      },
      {
        "_score": 2.456,  # Less relevant
        "_source": {"name": "Gaming Mouse", "description": "Fast response gaming mouse..."}
      }
    ]
  }
}
```

**Factors ảnh hưởng score:**
- **TF (Term Frequency):** Từ xuất hiện bao nhiêu lần trong document
- **IDF (Inverse Document Frequency):** Từ hiếm hay phổ biến
- **Field Length:** Field ngắn → score cao hơn
- **Boosting:** Tăng/giảm trọng số của field

**Xem giải thích chi tiết của score:**
```bash
GET /products/_search
{
  "query": {
    "match": {"description": "laptop"}
  },
  "explain": true  # Show score calculation
}
```

### 6. `_source`

**Mục đích:** Chứa document JSON gốc

```bash
GET /products/_doc/123

# Response:
{
  "_index": "products",
  "_id": "123",
  "_version": 1,
  "_source": {      # <-- Document gốc ở đây
    "name": "Laptop",
    "price": 999
  }
}
```

**Control `_source` storage:**

```bash
# 1. Disable _source (KHÔNG khuyến khích!)
PUT /products
{
  "mappings": {
    "_source": {
      "enabled": false  # Tiết kiệm storage nhưng mất nhiều tính năng!
    }
  }
}
# ❌ Không thể update
# ❌ Không thể reindex
# ❌ Highlight không hoạt động

# 2. Include only specific fields
PUT /products
{
  "mappings": {
    "_source": {
      "includes": ["name", "price"],
      "excludes": ["internal_notes"]
    }
  }
}

# 3. Exclude fields khi search (không ảnh hưởng storage)
GET /products/_search
{
  "_source": ["name", "price"],  # Chỉ trả về 2 fields
  "query": {"match_all": {}}
}

GET /products/_search
{
  "_source": false,  # Không trả về _source (chỉ metadata)
  "query": {"match_all": {}}
}
```

---

## ⚙️ CRUD Operations

### **CREATE**

#### 1. Auto-generated ID:
```bash
POST /products/_doc
{
  "name": "Wireless Mouse",
  "price": 29.99,
  "brand": "Logitech"
}

# Response:
{
  "_index": "products",
  "_id": "aB3dE5fG7hI9",  # Auto UUID
  "_version": 1,
  "result": "created"
}
```

#### 2. Custom ID (idempotent):
```bash
PUT /products/_doc/mouse-logitech-001
{
  "name": "Wireless Mouse",
  "price": 29.99,
  "brand": "Logitech"
}

# Response:
{
  "_index": "products",
  "_id": "mouse-logitech-001",
  "_version": 1,
  "result": "created"
}

# Chạy lại → Version tăng
PUT /products/_doc/mouse-logitech-001
{
  "name": "Wireless Mouse",
  "price": 29.99,
  "brand": "Logitech"
}
# Response: {"_version": 2, "result": "updated"}
```

#### 3. CREATE only (fail if exists):
```bash
PUT /products/_create/mouse-001
{
  "name": "Mouse",
  "price": 29.99
}
# ✅ Success first time

PUT /products/_create/mouse-001
{
  "name": "Mouse",
  "price": 29.99
}
# ❌ ERROR: version_conflict_engine_exception (document already exists!)
```

### **READ**

#### 1. Get by ID:
```bash
GET /products/_doc/mouse-001

# Response:
{
  "_index": "products",
  "_id": "mouse-001",
  "_version": 1,
  "_seq_no": 0,
  "_primary_term": 1,
  "found": true,
  "_source": {
    "name": "Mouse",
    "price": 29.99
  }
}
```

#### 2. Get specific fields only:
```bash
GET /products/_doc/mouse-001?_source=name,price

# Response:
{
  "_source": {
    "name": "Mouse",
    "price": 29.99
    // Other fields excluded
  }
}
```

#### 3. Check if exists (no _source):
```bash
HEAD /products/_doc/mouse-001
# Returns: 200 OK (exists) or 404 Not Found
```

#### 4. Multi-Get:
```bash
GET /_mget
{
  "docs": [
    {"_index": "products", "_id": "mouse-001"},
    {"_index": "products", "_id": "keyboard-001"},
    {"_index": "users", "_id": "user-123"}
  ]
}

# Or same index:
GET /products/_mget
{
  "ids": ["mouse-001", "keyboard-001", "laptop-001"]
}
```

### **UPDATE**

#### 1. Partial Update (recommended):
```bash
POST /products/_update/mouse-001
{
  "doc": {
    "price": 24.99,           # Update price
    "discount": 17            # Add new field
  }
}
# Other fields (name, brand) giữ nguyên ✅
```

#### 2. Scripted Update:
```bash
POST /products/_update/mouse-001
{
  "script": {
    "source": "ctx._source.price -= params.discount",
    "lang": "painless",
    "params": {
      "discount": 5.00
    }
  }
}
# price = current_price - 5.00
```

#### 3. Upsert (Update or Insert):
```bash
POST /products/_update/mouse-new
{
  "doc": {
    "name": "New Mouse",
    "price": 19.99
  },
  "doc_as_upsert": true
}
# Nếu tồn tại → Update
# Nếu không tồn tại → Create
```

#### 4. Update với Retry on Conflict:
```bash
POST /products/_update/mouse-001?retry_on_conflict=3
{
  "doc": {
    "price": 19.99
  }
}
# Retry 3 lần nếu có version conflict
```

#### 5. Full Replace (careful!):
```bash
PUT /products/_doc/mouse-001
{
  "name": "Mouse",
  "price": 19.99
}
# ⚠️ REPLACES ENTIRE document!
# Nếu document cũ có field "brand": "Logitech" → BỊ XÓA!
```

### **DELETE**

#### 1. Delete by ID:
```bash
DELETE /products/_doc/mouse-001

# Response:
{
  "_index": "products",
  "_id": "mouse-001",
  "_version": 6,  # Version increases even on delete
  "result": "deleted"
}
```

#### 2. Delete by Query:
```bash
POST /products/_delete_by_query
{
  "query": {
    "range": {
      "price": {
        "lt": 10  # Delete products < $10
      }
    }
  }
}

# Response:
{
  "deleted": 15,  # 15 documents deleted
  "failures": []
}
```

---

## 🚀 Bulk Operations

**Tại sao dùng Bulk?**
- ✅ Nhanh hơn 10-100× so với single operations
- ✅ Giảm network overhead
- ✅ Efficient batching

### Bulk API Syntax:

```bash
POST /_bulk
{"index": {"_index": "products", "_id": "1"}}
{"name": "Mouse", "price": 29.99}
{"create": {"_index": "products", "_id": "2"}}
{"name": "Keyboard", "price": 79.99}
{"update": {"_index": "products", "_id": "1"}}
{"doc": {"price": 24.99}}
{"delete": {"_index": "products", "_id": "3"}}
```

**Format:**
```
ACTION_METADATA\n
DOCUMENT_DATA\n
ACTION_METADATA\n
DOCUMENT_DATA\n
...
```

### Các loại Action:

#### 1. **index** (create or replace):
```bash
POST /_bulk
{"index": {"_index": "products", "_id": "mouse-001"}}
{"name": "Mouse", "price": 29.99, "brand": "Logitech"}
{"index": {"_index": "products", "_id": "keyboard-001"}}
{"name": "Keyboard", "price": 79.99, "brand": "Corsair"}
```

#### 2. **create** (fail if exists):
```bash
POST /_bulk
{"create": {"_index": "products", "_id": "new-mouse"}}
{"name": "New Mouse", "price": 19.99}
{"create": {"_index": "products", "_id": "new-keyboard"}}
{"name": "New Keyboard", "price": 59.99}
```

#### 3. **update** (partial):
```bash
POST /_bulk
{"update": {"_index": "products", "_id": "mouse-001"}}
{"doc": {"price": 24.99}}
{"update": {"_index": "products", "_id": "keyboard-001"}}
{"doc": {"discount": 10}}
```

#### 4. **delete**:
```bash
POST /_bulk
{"delete": {"_index": "products", "_id": "old-mouse"}}
{"delete": {"_index": "products", "_id": "old-keyboard"}}
```

### Bulk với cùng Index:

```bash
POST /products/_bulk
{"index": {"_id": "1"}}
{"name": "Mouse", "price": 29.99}
{"index": {"_id": "2"}}
{"name": "Keyboard", "price": 79.99}
{"update": {"_id": "1"}}
{"doc": {"price": 24.99}}
{"delete": {"_id": "3"}}
```

### Bulk from File:

```bash
# data.json:
{"index": {"_index": "products", "_id": "1"}}
{"name": "Mouse", "price": 29.99}
{"index": {"_index": "products", "_id": "2"}}
{"name": "Keyboard", "price": 79.99}

# Execute:
curl -X POST "localhost:9200/_bulk" \
  -H "Content-Type: application/x-ndjson" \
  --data-binary @data.json
```

### Performance Tips:

#### **Optimal Batch Size:**
```bash
# ❌ TOO SMALL: Too many network calls
POST /_bulk (10 documents) → 1000 calls for 10K docs

# ✅ OPTIMAL: Balance latency & throughput
POST /_bulk (1000-5000 documents per request)

# ❌ TOO LARGE: Request timeout, memory issues
POST /_bulk (100000 documents) → Timeout!
```

**Recommended:**
- **Batch size:** 1000-5000 documents
- **Batch data size:** 5-15 MB
- **Test and tune** for your specific use case

#### **Error Handling:**
```bash
POST /_bulk
{"index": {"_index": "products", "_id": "1"}}
{"name": "Mouse", "price": 29.99}
{"index": {"_index": "products", "_id": "2"}}
{"name": "Invalid"}  # Missing required field!
{"index": {"_index": "products", "_id": "3"}}
{"name": "Keyboard", "price": 79.99}

# Response:
{
  "errors": true,  # ⚠️ Some operations failed
  "items": [
    {
      "index": {
        "_index": "products",
        "_id": "1",
        "status": 201,  # ✅ Success
        "result": "created"
      }
    },
    {
      "index": {
        "_index": "products",
        "_id": "2",
        "status": 400,  # ❌ Failed
        "error": {
          "type": "mapper_parsing_exception",
          "reason": "Failed to parse field [price]"
        }
      }
    },
    {
      "index": {
        "_index": "products",
        "_id": "3",
        "status": 201,  # ✅ Success (others continue!)
        "result": "created"
      }
    }
  ]
}
```

**Key Points:**
- ✅ Bulk operations **don't stop on error**
- ✅ Each operation independent
- ⚠️ Check `errors: true` to detect failures
- ⚠️ Parse `items` array to see which failed

---

## 🔄 Versioning & Concurrency

### Vấn đề: Lost Updates

```
Timeline:

T1: User A reads product (price: $100)
T2: User B reads product (price: $100)
T3: User A sets price to $90
T4: User B sets price to $80
Result: User A's update LOST! 💥
```

### Giải pháp: Optimistic Concurrency Control

#### **Modern Approach (Elasticsearch 7.x+):**

```bash
# 1. Read document with seq_no & primary_term
GET /products/_doc/laptop-001

# Response:
{
  "_seq_no": 10,
  "_primary_term": 1,
  "_source": {"name": "Laptop", "price": 999}
}

# 2. Update with concurrency control
PUT /products/_doc/laptop-001?if_seq_no=10&if_primary_term=1
{
  "name": "Laptop",
  "price": 899
}

# ✅ Success if nobody else updated
# ❌ Conflict if someone else updated:
{
  "error": {
    "type": "version_conflict_engine_exception",
    "reason": "[laptop-001]: version conflict, current version [11] is different than the one provided [10]"
  }
}
```

#### **Legacy Approach (Elasticsearch < 7.0):**

```bash
# Using external version
PUT /products/_doc/laptop-001?version=5&version_type=external
{
  "name": "Laptop",
  "price": 899
}
```

### Retry Strategy:

```javascript
async function updateWithRetry(id, updateFn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // 1. Get current document
      const { body } = await client.get({
        index: 'products',
        id: id
      });
      
      const doc = body._source;
      const seqNo = body._seq_no;
      const primaryTerm = body._primary_term;
      
      // 2. Apply update function
      const updatedDoc = updateFn(doc);
      
      // 3. Update with concurrency control
      await client.index({
        index: 'products',
        id: id,
        body: updatedDoc,
        if_seq_no: seqNo,
        if_primary_term: primaryTerm
      });
      
      return; // Success!
      
    } catch (error) {
      if (error.statusCode === 409 && i < maxRetries - 1) {
        // Version conflict, retry
        console.log(`Retry ${i + 1}/${maxRetries}`);
        await sleep(100 * Math.pow(2, i)); // Exponential backoff
        continue;
      }
      throw error; // Give up or other error
    }
  }
  throw new Error('Max retries exceeded');
}

// Usage:
await updateWithRetry('laptop-001', (doc) => {
  doc.price = doc.price * 0.9; // 10% discount
  return doc;
});
```

---

## ✅ Ưu điểm của Document Model

### 1. **Schema Flexibility**

```json
// Wave 1: MVP Launch (basic fields)
{
  "name": "Product A",
  "price": 19.99
}

// Wave 2: Add reviews (NO schema migration!)
{
  "name": "Product B",
  "price": 29.99,
  "reviews": [
    {"user": "John", "rating": 5, "comment": "Great!"}
  ]
}

// Wave 3: Add detailed specs
{
  "name": "Product C",
  "price": 39.99,
  "reviews": [...],
  "specs": {
    "weight": "500g",
    "dimensions": "10x20x5 cm"
  }
}
```

**VS SQL:**
```sql
-- Wave 1: Create table
CREATE TABLE products (name VARCHAR, price DECIMAL);

-- Wave 2: Add reviews → Need new table + migration!
CREATE TABLE reviews (...);
ALTER TABLE products ADD COLUMN ...;

-- Wave 3: Add specs → Another migration!
ALTER TABLE products ADD COLUMN ...;
```

### 2. **Fast Reads (No JOINs)**

```bash
# Elasticsearch: 1 query
GET /products/_doc/123
# Returns complete document in ~1ms

# SQL equivalent: Multiple JOINs
SELECT p.*, c.name as category_name, b.name as brand_name,
       r.rating, r.comment
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN brands b ON p.brand_id = b.id
LEFT JOIN reviews r ON p.id = r.product_id
WHERE p.id = 123;
# Much slower! (~50-100ms)
```

### 3. **Natural Data Modeling**

```json
{
  "order_id": "ORD-123",
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "zipcode": "10001"
    }
  },
  "items": [
    {
      "product": "Laptop",
      "quantity": 1,
      "price": 999.99
    },
    {
      "product": "Mouse",
      "quantity": 2,
      "price": 29.99
    }
  ],
  "total": 1059.97
}
```

**Reflects real-world structure naturally!**

### 4. **Microservices Friendly**

```
Order Service document (self-contained):
{
  "order_id": "123",
  "customer": {...},        // Denormalized from User Service
  "products": [...],        // Denormalized from Product Service
  "shipping": {...}         // Denormalized from Shipping Service
}

Benefits:
✅ No inter-service calls needed for reads
✅ Service can work independently
✅ Fault tolerant (other services down? Still work!)
✅ Fast response times
```

### 5. **Easy Replication**

```
Node 1: [Doc A] [Doc B]
Node 2: [Doc A] [Doc B]  ← Simple copy!
Node 3: [Doc A] [Doc B]

Each document independent → Easy to replicate
```

---

## ❌ Nhược điểm của Document Model

### 1. **Data Duplication**

```json
// Problem: Brand info duplicated in EVERY product!
{
  "_id": "product-1",
  "name": "Laptop Dell XPS",
  "brand": {
    "id": "dell",
    "name": "Dell",
    "country": "USA",
    "founded": 1984
  }
}

{
  "_id": "product-2",
  "name": "Monitor Dell U2720Q",
  "brand": {
    "id": "dell",
    "name": "Dell",      // Duplicated!
    "country": "USA",    // Duplicated!
    "founded": 1984      // Duplicated!
  }
}

// If Dell changes name → Must update ALL products! 💥
```

**Solution: Strategic Denormalization**
```json
// Only store frequently accessed fields
{
  "_id": "product-1",
  "name": "Laptop Dell XPS",
  "brand_id": "dell",        // Reference for updates
  "brand_name": "Dell"       // Denormalized for display
  // Don't store rarely used fields (country, founded)
}
```

### 2. **Update Complexity**

```bash
# Problem: Brand name changed
# Must update ALL products with that brand!

POST /products/_update_by_query
{
  "script": {
    "source": "ctx._source.brand_name = 'Dell Technologies'",
    "lang": "painless"
  },
  "query": {
    "term": {"brand_id": "dell"}
  }
}

# If you have 1 million Dell products → 1 million updates! 💥
```

**SQL comparison:**
```sql
-- SQL: Update once!
UPDATE brands SET name = 'Dell Technologies' WHERE id = 'dell';
-- Done! All products automatically see new name via JOIN
```

### 3. **No Transactions**

```bash
# Problem: Transfer money between accounts
# Debit Account A: $100
POST /accounts/_update/account-a
{
  "script": "ctx._source.balance -= 100"
}

# ⚠️ Server crashes here! 💥

# Credit Account B: $100
POST /accounts/_update/account-b
{
  "script": "ctx._source.balance += 100"
}

# Result: $100 disappeared! No atomicity! 💰💸
```

**Elasticsearch CANNOT guarantee ACID transactions across documents!**

### 4. **Size Limits**

```bash
# Default limit: 100MB per document
# Recommended: < 10MB per document

# ❌ BAD: Huge document
{
  "product_id": "123",
  "reviews": [
    /* 100,000 reviews here → 50MB! */
  ]
}

# Problems:
# - Slow to index
# - Slow to retrieve
# - High memory usage
# - Search performance degrades

# ✅ GOOD: Use parent-child relationship
# Product:
{"product_id": "123", "name": "Laptop"}

# Reviews (separate documents):
{"product_id": "123", "user": "John", "rating": 5}
{"product_id": "123", "user": "Jane", "rating": 4}
```

### 5. **No Referential Integrity**

```json
// Product references category:
{
  "name": "Laptop",
  "category_id": "electronics"
}

// Someone deletes category:
DELETE /categories/_doc/electronics

// Result: Orphaned product! 💀
// category_id now points to nothing
// Elasticsearch doesn't prevent this!
```

---

## 💡 Best Practices

### ✅ DO:

#### 1. **Use Meaningful IDs**
```json
// ✅ GOOD
{"_id": "user-john.doe@example.com"}
{"_id": "product-laptop-dell-xps-13-2026"}
{"_id": "order-2026-01-31-1234"}

// ❌ BAD
{"_id": "1"}
{"_id": "abc123"}
{"_id": "doc"}
```

#### 2. **Include Timestamps**
```json
{
  "created_at": "2026-01-31T10:30:00Z",
  "updated_at": "2026-01-31T14:20:00Z"
}
```

#### 3. **Use Arrays for Multi-valued Fields**
```json
{
  "tags": ["laptop", "premium", "dell"],
  "colors": ["silver", "black"],
  "sizes": ["13-inch", "15-inch"]
}
```

#### 4. **Strategic Denormalization**
```json
// ✅ GOOD: Denormalize frequently accessed data
{
  "product_id": "123",
  "product_name": "Laptop",  // Denormalized for display
  "category_id": "electronics",
  "category_name": "Electronics"  // Denormalized for display
}

// ❌ BAD: Denormalize everything
{
  "product_id": "123",
  "category": {
    /* entire category document with 50 fields */
  }
}
```

#### 5. **Use Bulk for Multiple Operations**
```javascript
// ✅ GOOD: Batch operations
const bulk = [];
for (const product of products) {
  bulk.push({ index: { _index: 'products', _id: product.id } });
  bulk.push(product);
}
await client.bulk({ body: bulk });

// ❌ BAD: Individual operations
for (const product of products) {
  await client.index({
    index: 'products',
    id: product.id,
    body: product
  });
}
```

### ❌ DON'T:

#### 1. **Don't Store Huge Nested Objects**
```json
// ❌ BAD
{
  "product_id": "123",
  "reviews": [
    /* 10,000 reviews → 10MB document! */
  ]
}

// ✅ GOOD: Use parent-child or separate index
// Parent:
{"product_id": "123", "name": "Laptop"}

// Children (separate documents):
{"review_id": "1", "product_id": "123", "rating": 5}
{"review_id": "2", "product_id": "123", "rating": 4}
```

#### 2. **Don't Use for Transactional Data**
```json
// ❌ BAD: Bank account in Elasticsearch
{
  "account_id": "123",
  "balance": 1000.00
}
// No ACID → Use PostgreSQL/MySQL!

// ✅ GOOD: Use Elasticsearch for search/analytics
{
  "transaction_id": "tx-456",
  "account_id": "123",
  "amount": 100.00,
  "type": "debit",
  "timestamp": "2026-01-31T10:30:00Z"
}
```

#### 3. **Don't Store Unnecessary Data**
```json
// ❌ BAD: Store everything
{
  "product_id": "123",
  "internal_notes": "blah blah blah",  // Not needed for search
  "debug_info": {...},                  // Not needed
  "temp_data": {...}                    // Not needed
}

// ✅ GOOD: Store only what you search/display
{
  "product_id": "123",
  "name": "Laptop",
  "price": 999.99,
  "description": "..."
}
```

#### 4. **Don't Use Sequential IDs**
```json
// ❌ BAD: Sequential IDs → Unbalanced shards
{"_id": "1"}
{"_id": "2"}
{"_id": "3"}

// ✅ GOOD: Random/UUID/Business IDs
{"_id": "a1b2c3d4"}
{"_id": "product-laptop-001"}
{"_id": "user-john@example.com"}
```

---

## 🎯 Use Cases

### ✅ Perfect For:

#### 1. **E-Commerce Product Catalog**
```json
{
  "product_id": "laptop-001",
  "name": "Dell XPS 13",
  "description": "Premium ultrabook with stunning display...",
  "price": 1299.99,
  "category": "Electronics",
  "brand": "Dell",
  "specs": {...},
  "reviews": {...},
  "images": [...]
}
```
**Why:** Fast full-text search, flexible schema, rich queries

#### 2. **Log Aggregation**
```json
{
  "timestamp": "2026-01-31T10:30:00Z",
  "level": "ERROR",
  "service": "api-gateway",
  "message": "Connection timeout",
  "user_id": "user-123",
  "request_id": "req-456"
}
```
**Why:** High write throughput, time-series data, analytics

#### 3. **Content Management**
```json
{
  "article_id": "art-123",
  "title": "Getting Started with Elasticsearch",
  "content": "Elasticsearch is a distributed search engine...",
  "author": "John Doe",
  "tags": ["elasticsearch", "tutorial"],
  "published_at": "2026-01-31T10:00:00Z"
}
```
**Why:** Full-text search, relevance ranking, fast retrieval

#### 4. **User Profiles**
```json
{
  "user_id": "user-123",
  "name": "John Doe",
  "email": "john@example.com",
  "preferences": {...},
  "activity": {...}
}
```
**Why:** Fast lookups, flexible schema for different user types

### ❌ Not Ideal For:

#### 1. **Financial Transactions**
```
❌ No ACID transactions
❌ No strict consistency guarantees
→ Use: PostgreSQL, MySQL
```

#### 2. **Highly Relational Data**
```
❌ No JOINs (expensive workarounds)
❌ Data duplication issues
→ Use: PostgreSQL with proper normalization
```

#### 3. **Frequently Updated Counters**
```
❌ Version conflicts under high concurrency
❌ Slow for rapid updates
→ Use: Redis, memcached
```

---

## 🔧 Troubleshooting

### Problem 1: Version Conflict

**Error:**
```json
{
  "error": {
    "type": "version_conflict_engine_exception"
  }
}
```

**Solution:**
```bash
# Use retry_on_conflict
POST /products/_update/laptop-001?retry_on_conflict=3
{
  "doc": {"price": 899}
}

# Or implement retry logic in application
```

### Problem 2: Document Too Large

**Error:**
```json
{
  "error": {
    "type": "illegal_argument_exception",
    "reason": "Document size exceeds 100MB"
  }
}
```

**Solution:**
```bash
# 1. Split into multiple documents
# 2. Use parent-child relationship
# 3. Store large fields externally (S3) and reference
```

### Problem 3: Slow Indexing

**Symptoms:**
- High indexing latency
- Growing queue

**Solutions:**
```bash
# 1. Use bulk operations
POST /_bulk

# 2. Increase refresh interval
PUT /products/_settings
{
  "index.refresh_interval": "30s"  # Default: 1s
}

# 3. Disable replicas during bulk load
PUT /products/_settings
{
  "number_of_replicas": 0
}
# Re-enable after:
PUT /products/_settings
{
  "number_of_replicas": 1
}
```

### Problem 4: ID Collision

**Error:**
```json
{
  "error": {
    "type": "version_conflict_engine_exception",
    "reason": "Document already exists"
  }
}
```

**Solution:**
```bash
# Use _create endpoint
PUT /products/_create/laptop-001
{
  "name": "Laptop"
}

# Or check if exists first
HEAD /products/_doc/laptop-001
```

---

## 📚 Related Topics

- **[INDICES.md](./INDICES.md)** - Working with Elasticsearch indices
- **[SHARDS.md](./SHARDS.md)** - Understanding sharding strategy
- **[MAPPING.md](./MAPPING.md)** - Defining document structure
- **[SEARCH-IMPLEMENTATION.md](./SEARCH-IMPLEMENTATION.md)** - Searching documents

---

## 🎓 Summary

**Key Takeaways:**

1. ✅ **Documents = JSON objects** (flexible, self-describing)
2. ✅ **Schema-less** (add fields without migration)
3. ✅ **Fast reads** (no JOINs needed)
4. ✅ **Use Bulk API** for better performance
5. ⚠️ **Version conflicts** (use optimistic concurrency)
6. ⚠️ **Data duplication** (accept it or denormalize strategically)
7. ❌ **Not for ACID transactions**
8. ❌ **Not for highly relational data**

---

*Cập nhật: 31 Tháng 1, 2026*
