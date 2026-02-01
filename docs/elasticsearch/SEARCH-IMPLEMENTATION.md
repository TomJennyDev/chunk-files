# Search Implementation - Từ Cơ Bản Đến Nâng Cao

> **Complete Guide** về các loại search trong Elasticsearch và cách implement từ simple queries đến advanced AI-powered search.

---

## 📋 Mục Lục

1. [Search Overview](#search-overview)
2. [Basic Search - Match Queries](#basic-search---match-queries)
3. [Term-Level Searches](#term-level-searches)
4. [Full-Text Searches](#full-text-searches)
5. [Boolean Queries](#boolean-queries)
6. [Fuzzy Search](#fuzzy-search)
7. [Phrase Matching](#phrase-matching)
8. [Wildcard & Regex Search](#wildcard--regex-search)
9. [Range Queries](#range-queries)
10. [Aggregations](#aggregations)
11. [Semantic Search (Vector)](#semantic-search-vector)
12. [Hybrid Search](#hybrid-search)
13. [Search-as-You-Type](#search-as-you-type)
14. [Geospatial Search](#geospatial-search)
15. [Multi-Language Search](#multi-language-search)
16. [Performance Optimization](#performance-optimization)

---

## 🔍 Search Overview

### Elasticsearch Search Types:

```
┌──────────────────────────────────────────┐
│         SEARCH TYPES                     │
├──────────────────────────────────────────┤
│                                          │
│  1. Term-Level Queries                   │
│     ├─ Exact match (keyword)             │
│     ├─ Terms (multiple values)           │
│     └─ Range queries                     │
│                                          │
│  2. Full-Text Queries                    │
│     ├─ Match (analyzed)                  │
│     ├─ Multi-match (multiple fields)     │
│     └─ Match phrase                      │
│                                          │
│  3. Compound Queries                     │
│     ├─ Bool (must/should/filter)         │
│     └─ Function score                    │
│                                          │
│  4. Advanced Queries                     │
│     ├─ Vector/Semantic search            │
│     ├─ Fuzzy search                      │
│     └─ Geospatial queries                │
│                                          │
└──────────────────────────────────────────┘
```

---

## 🎯 Basic Search - Match Queries

### 1. Simple Match

**Use Case:** Basic full-text search

```bash
GET /products/_search
{
  "query": {
    "match": {
      "name": "laptop"
    }
  }
}

# How it works:
# 1. Analyze "laptop" → ["laptop"]
# 2. Search inverted index for "laptop"
# 3. Return matching documents with scores
```

**Response:**
```json
{
  "hits": {
    "total": {"value": 15},
    "hits": [
      {
        "_score": 2.567,
        "_source": {"name": "Gaming Laptop", "price": 1200}
      },
      {
        "_score": 1.234,
        "_source": {"name": "Business Laptop", "price": 800}
      }
    ]
  }
}
```

### 2. Match All

**Use Case:** Get all documents

```bash
GET /products/_search
{
  "query": {
    "match_all": {}
  }
}

# Returns ALL documents (default _score = 1.0)
```

### 3. Match with Operator

```bash
# OR operator (default)
GET /products/_search
{
  "query": {
    "match": {
      "description": {
        "query": "laptop gaming",
        "operator": "or"  # Matches: "laptop" OR "gaming"
      }
    }
  }
}

# AND operator
GET /products/_search
{
  "query": {
    "match": {
      "description": {
        "query": "laptop gaming",
        "operator": "and"  # Matches: "laptop" AND "gaming" (both required)
      }
    }
  }
}

# Minimum should match
GET /products/_search
{
  "query": {
    "match": {
      "description": {
        "query": "laptop gaming powerful lightweight",
        "minimum_should_match": "75%"  # At least 3 of 4 terms
      }
    }
  }
}
```

---

## 🎯 Term-Level Searches

**Term-level** = Exact matches (NOT analyzed)

### 1. Term Query

**Use Case:** Exact value matching

```bash
GET /products/_search
{
  "query": {
    "term": {
      "status": "published"  # Exact match (case-sensitive)
    }
  }
}

# ✅ Matches: "published"
# ❌ Doesn't match: "Published", "PUBLISHED"
```

### 2. Terms Query (Multiple Values)

```bash
GET /products/_search
{
  "query": {
    "terms": {
      "category": ["laptop", "desktop", "tablet"]  # Matches ANY
    }
  }
}

# Similar to SQL: WHERE category IN ('laptop', 'desktop', 'tablet')
```

### 3. Exists Query

```bash
GET /products/_search
{
  "query": {
    "exists": {
      "field": "discount"  # Documents with discount field
    }
  }
}
```

### 4. IDs Query

```bash
GET /products/_search
{
  "query": {
    "ids": {
      "values": ["1", "2", "3"]  # Match by document IDs
    }
  }
}
```

### 5. Prefix Query

```bash
GET /products/_search
{
  "query": {
    "prefix": {
      "sku": "LAP-"  # Starts with "LAP-"
    }
  }
}

# ✅ Matches: "LAP-001", "LAP-123"
# ❌ Doesn't match: "DSK-001"
```

---

## 📝 Full-Text Searches

**Full-text** = Analyzed queries (tokenized, lowercased, stemmed)

### 1. Match Query (Single Field)

```bash
GET /articles/_search
{
  "query": {
    "match": {
      "title": "elasticsearch guide"
    }
  }
}

# Analyzed: ["elasticsearch", "guide"]
# Finds: "Elasticsearch", "GUIDE", "elasticsearch"
```

### 2. Multi-Match (Multiple Fields)

```bash
GET /articles/_search
{
  "query": {
    "multi_match": {
      "query": "elasticsearch",
      "fields": ["title^3", "content", "tags^2"]  # Boost title 3×, tags 2×
    }
  }
}

# Search across multiple fields with different weights
```

**Multi-Match Types:**

```bash
# best_fields (default) - Best matching field wins
{
  "multi_match": {
    "query": "elasticsearch guide",
    "fields": ["title", "content"],
    "type": "best_fields"
  }
}

# most_fields - Combine scores from all fields
{
  "multi_match": {
    "query": "elasticsearch",
    "fields": ["title", "content", "summary"],
    "type": "most_fields"
  }
}

# cross_fields - Treat as single field
{
  "multi_match": {
    "query": "john smith",
    "fields": ["first_name", "last_name"],
    "type": "cross_fields",
    "operator": "and"
  }
}

# phrase - Match phrase across fields
{
  "multi_match": {
    "query": "quick brown fox",
    "fields": ["title", "content"],
    "type": "phrase"
  }
}
```

### 3. Query String

**Use Case:** Google-like search syntax

```bash
GET /articles/_search
{
  "query": {
    "query_string": {
      "query": "elasticsearch AND (guide OR tutorial) NOT beginner",
      "default_field": "content"
    }
  }
}

# Supports:
# - AND, OR, NOT operators
# - Wildcards: elast*
# - Phrases: "exact phrase"
# - Field search: title:elasticsearch
# - Ranges: price:[100 TO 500]
```

**Examples:**
```bash
# Field-specific
"query": "title:elasticsearch AND author:john"

# Wildcards
"query": "elast* guide"

# Phrases
"query": "\"complete guide\" AND advanced"

# Ranges
"query": "price:[100 TO 500] AND rating:>=4"

# Fuzzy
"query": "elasticsearch~2"  # Up to 2 character changes
```

---

## 🔀 Boolean Queries

**Boolean** = Combine multiple queries

### Structure:

```
Bool Query:
┌────────────────────────────────────┐
│  must     - AND (scored)           │
│  filter   - AND (NOT scored)       │
│  should   - OR (scored)            │
│  must_not - NOT (NOT scored)       │
└────────────────────────────────────┘
```

### Example:

```bash
GET /products/_search
{
  "query": {
    "bool": {
      "must": [
        {"match": {"name": "laptop"}}  # Required, scored
      ],
      "filter": [
        {"term": {"status": "published"}},  # Required, NOT scored
        {"range": {"price": {"lte": 1500}}}
      ],
      "should": [
        {"match": {"tags": "gaming"}},  # Optional, boosts score
        {"match": {"tags": "portable"}}
      ],
      "must_not": [
        {"term": {"brand": "generic"}}  # Excluded
      ],
      "minimum_should_match": 1  # At least 1 "should" must match
    }
  }
}

# Translation:
# - Name contains "laptop" (MUST)
# - Status is "published" (FILTER)
# - Price <= $1500 (FILTER)
# - Has "gaming" OR "portable" tags (SHOULD, at least 1)
# - Brand is NOT "generic" (MUST_NOT)
```

### Nested Boolean:

```bash
GET /products/_search
{
  "query": {
    "bool": {
      "must": [
        {
          "bool": {
            "should": [
              {"match": {"name": "laptop"}},
              {"match": {"name": "notebook"}}
            ],
            "minimum_should_match": 1
          }
        }
      ],
      "filter": [
        {"range": {"price": {"gte": 500, "lte": 2000}}}
      ]
    }
  }
}

# (laptop OR notebook) AND price BETWEEN 500 AND 2000
```

---

## 🔤 Fuzzy Search

**Fuzzy** = Handle typos and spelling mistakes

### 1. Basic Fuzzy Query

```bash
GET /products/_search
{
  "query": {
    "fuzzy": {
      "name": {
        "value": "laptpo",  # Typo!
        "fuzziness": "AUTO"  # Auto calculate edit distance
      }
    }
  }
}

# Finds: "laptop" (1 character difference)
```

**Fuzziness Options:**

```bash
# AUTO - Automatically determine edit distance
"fuzziness": "AUTO"  
# 0-2 chars: 0 edits
# 3-5 chars: 1 edit
# 6+ chars: 2 edits

# Specific edit distance
"fuzziness": 1  # Allow 1 character change
"fuzziness": 2  # Allow 2 character changes

# No fuzziness
"fuzziness": 0  # Exact match only
```

### 2. Fuzzy Match Query

```bash
GET /products/_search
{
  "query": {
    "match": {
      "name": {
        "query": "laptpo gamng",
        "fuzziness": "AUTO",
        "prefix_length": 2,  # First 2 chars must match exactly
        "max_expansions": 50  # Limit fuzzy expansions
      }
    }
  }
}

# Finds: "laptop gaming"
```

### 3. Fuzzy Suggestions (Did You Mean?)

```bash
GET /products/_search
{
  "suggest": {
    "text": "laptpo",
    "simple_phrase": {
      "phrase": {
        "field": "name.trigram",
        "size": 1,
        "direct_generator": [{
          "field": "name.trigram",
          "suggest_mode": "always"
        }]
      }
    }
  }
}

# Suggests: "laptop"
```

---

## 📑 Phrase Matching

**Phrase** = Match exact word order

### 1. Match Phrase

```bash
GET /articles/_search
{
  "query": {
    "match_phrase": {
      "content": "quick brown fox"
    }
  }
}

# ✅ Matches: "the quick brown fox jumped"
# ❌ Doesn't match: "the brown quick fox"
```

### 2. Match Phrase with Slop

```bash
GET /articles/_search
{
  "query": {
    "match_phrase": {
      "content": {
        "query": "quick fox",
        "slop": 1  # Allow 1 word in between
      }
    }
  }
}

# ✅ Matches: "quick brown fox" (1 word between)
# ❌ Doesn't match: "quick small brown fox" (2 words between)
```

**Slop Examples:**

```bash
# slop: 0 - Exact phrase
"quick brown fox" ✅
"quick fox" ❌

# slop: 1 - Allow 1 word gap
"quick brown fox" ✅
"quick red fox" ✅
"quick small brown fox" ❌

# slop: 2 - Allow 2 word gap
"quick small brown fox" ✅
"quick very small brown fox" ❌
```

---

## 🃏 Wildcard & Regex Search

### 1. Wildcard Query

```bash
GET /products/_search
{
  "query": {
    "wildcard": {
      "sku": "LAP-*-2024"  # * = any characters
    }
  }
}

# Matches: "LAP-001-2024", "LAP-GAMING-2024"
```

**Wildcard Operators:**
- `*` = Zero or more characters
- `?` = Exactly one character

```bash
# Examples:
"LAP-*" → "LAP-001", "LAP-GAMING"
"LAP-???" → "LAP-001", "LAP-ABC" (exactly 3 chars)
"*gaming*" → "laptop-gaming", "gaming-pc"
```

### 2. Regexp Query

```bash
GET /products/_search
{
  "query": {
    "regexp": {
      "sku": "LAP-[0-9]{3}-.*"  # Regex pattern
    }
  }
}

# Matches: "LAP-001-2024", "LAP-999-GAMING"
```

**Regex Examples:**

```bash
# Email validation
"regexp": "[a-z0-9]+@[a-z]+\\.[a-z]+"

# Phone numbers
"regexp": "[0-9]{3}-[0-9]{3}-[0-9]{4}"

# Product codes
"regexp": "PROD-[A-Z]{2}-[0-9]{4}"
```

⚠️ **Warning:** Wildcard/regex queries are slow! Use sparingly.

---

## 📊 Range Queries

**Range** = Numeric, date, or IP ranges

### 1. Numeric Range

```bash
GET /products/_search
{
  "query": {
    "range": {
      "price": {
        "gte": 100,   # Greater than or equal
        "lte": 500    # Less than or equal
      }
    }
  }
}

# Operators:
# - gte: >= (greater than or equal)
# - gt:  >  (greater than)
# - lte: <= (less than or equal)
# - lt:  <  (less than)
```

### 2. Date Range

```bash
GET /logs/_search
{
  "query": {
    "range": {
      "timestamp": {
        "gte": "2026-01-01",
        "lte": "2026-01-31",
        "format": "yyyy-MM-dd"
      }
    }
  }
}

# Relative dates:
{
  "range": {
    "timestamp": {
      "gte": "now-7d",      # Last 7 days
      "lte": "now"
    }
  }
}

# Time units:
# - y (year), M (month), w (week)
# - d (day), h (hour), m (minute), s (second)
```

### 3. IP Range

```bash
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

# CIDR notation:
{
  "term": {
    "client_ip": "192.168.0.0/16"
  }
}
```

---

## 📈 Aggregations

**Aggregations** = Analytics and statistics on search results

### 1. Metric Aggregations

```bash
GET /products/_search
{
  "size": 0,  # Don't return documents, only aggregations
  "aggs": {
    "avg_price": {
      "avg": {"field": "price"}
    },
    "max_price": {
      "max": {"field": "price"}
    },
    "min_price": {
      "min": {"field": "price"}
    },
    "sum_revenue": {
      "sum": {"field": "revenue"}
    },
    "count_products": {
      "value_count": {"field": "product_id"}
    }
  }
}
```

### 2. Bucket Aggregations

**Terms Aggregation** (Group by field):

```bash
GET /products/_search
{
  "size": 0,
  "aggs": {
    "products_by_category": {
      "terms": {
        "field": "category",
        "size": 10  # Top 10 categories
      }
    }
  }
}

# Response:
{
  "aggregations": {
    "products_by_category": {
      "buckets": [
        {"key": "laptop", "doc_count": 150},
        {"key": "desktop", "doc_count": 85},
        {"key": "tablet", "doc_count": 45}
      ]
    }
  }
}
```

**Histogram Aggregation** (Numeric ranges):

```bash
GET /products/_search
{
  "size": 0,
  "aggs": {
    "price_ranges": {
      "histogram": {
        "field": "price",
        "interval": 500  # $500 buckets
      }
    }
  }
}

# Buckets: 0-500, 500-1000, 1000-1500, etc.
```

**Date Histogram** (Time series):

```bash
GET /logs/_search
{
  "size": 0,
  "aggs": {
    "logs_over_time": {
      "date_histogram": {
        "field": "timestamp",
        "calendar_interval": "1d"  # Daily buckets
      }
    }
  }
}
```

### 3. Nested Aggregations

```bash
GET /products/_search
{
  "size": 0,
  "aggs": {
    "categories": {
      "terms": {"field": "category"},
      "aggs": {
        "avg_price": {
          "avg": {"field": "price"}
        },
        "price_ranges": {
          "range": {
            "field": "price",
            "ranges": [
              {"to": 500},
              {"from": 500, "to": 1000},
              {"from": 1000}
            ]
          }
        }
      }
    }
  }
}

# Group by category → Calculate avg price per category
```

---

## 🧠 Semantic Search (Vector)

**Semantic Search** = Understanding meaning, not just keywords

### Setup: Vector Field Mapping

```bash
PUT /articles
{
  "mappings": {
    "properties": {
      "title": {"type": "text"},
      "content": {"type": "text"},
      "content_vector": {
        "type": "dense_vector",
        "dims": 768,  # Embedding dimensions
        "index": true,
        "similarity": "cosine"  # or "dot_product", "l2_norm"
      }
    }
  }
}
```

### Generate Embeddings (Python):

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')

# Generate embeddings
text = "Elasticsearch is a powerful search engine"
embedding = model.encode(text).tolist()  # [768 dimensions]

# Index with vector
from elasticsearch import Elasticsearch
es = Elasticsearch(['localhost:9200'])

es.index(index='articles', document={
    'title': 'Elasticsearch Guide',
    'content': text,
    'content_vector': embedding
})
```

### Vector Search Query:

```bash
GET /articles/_search
{
  "query": {
    "script_score": {
      "query": {"match_all": {}},
      "script": {
        "source": "cosineSimilarity(params.query_vector, 'content_vector') + 1.0",
        "params": {
          "query_vector": [0.123, 0.456, ...]  # Query embedding
        }
      }
    }
  }
}
```

### KNN Search (Elasticsearch 8.0+):

```bash
GET /articles/_search
{
  "knn": {
    "field": "content_vector",
    "query_vector": [0.123, 0.456, ...],  # Query embedding
    "k": 10,  # Return top 10 nearest neighbors
    "num_candidates": 100  # Consider top 100 candidates
  }
}
```

### Semantic Search Example:

```python
# Query: "machine learning tutorial"
query_text = "machine learning tutorial"
query_vector = model.encode(query_text).tolist()

# Search
results = es.search(index='articles', body={
    "knn": {
        "field": "content_vector",
        "query_vector": query_vector,
        "k": 5,
        "num_candidates": 50
    }
})

# Results include semantically similar content:
# ✅ "AI and deep learning guide"
# ✅ "Neural networks for beginners"
# ✅ "Introduction to ML algorithms"
# (Even if they don't contain exact words!)
```

---

## 🔄 Hybrid Search

**Hybrid** = Combine keyword + semantic search

### Implementation:

```bash
GET /articles/_search
{
  "query": {
    "bool": {
      "should": [
        {
          "multi_match": {
            "query": "machine learning",
            "fields": ["title^2", "content"],
            "boost": 1.0  # Keyword search weight
          }
        },
        {
          "script_score": {
            "query": {"match_all": {}},
            "script": {
              "source": "cosineSimilarity(params.query_vector, 'content_vector') + 1.0",
              "params": {"query_vector": [0.123, ...]}
            },
            "boost": 0.5  # Semantic search weight
          }
        }
      ]
    }
  }
}

# Final score = (keyword_score × 1.0) + (semantic_score × 0.5)
```

### Reciprocal Rank Fusion (RRF):

```python
def reciprocal_rank_fusion(keyword_results, semantic_results, k=60):
    """
    Combine rankings from keyword and semantic search
    
    RRF Score = Σ 1/(k + rank)
    """
    scores = {}
    
    # Score from keyword search
    for rank, doc in enumerate(keyword_results, 1):
        doc_id = doc['_id']
        scores[doc_id] = scores.get(doc_id, 0) + 1/(k + rank)
    
    # Score from semantic search
    for rank, doc in enumerate(semantic_results, 1):
        doc_id = doc['_id']
        scores[doc_id] = scores.get(doc_id, 0) + 1/(k + rank)
    
    # Sort by combined score
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)
```

---

## ⌨️ Search-as-You-Type

**Autocomplete** = Show suggestions as user types

### 1. Edge NGram Approach

**Setup:**

```bash
PUT /products
{
  "settings": {
    "analysis": {
      "analyzer": {
        "autocomplete": {
          "tokenizer": "autocomplete_tokenizer",
          "filter": ["lowercase"]
        }
      },
      "tokenizer": {
        "autocomplete_tokenizer": {
          "type": "edge_ngram",
          "min_gram": 2,
          "max_gram": 10,
          "token_chars": ["letter", "digit"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "analyzer": "autocomplete",
        "search_analyzer": "standard"  # Different for search!
      }
    }
  }
}
```

**Query:**

```bash
GET /products/_search
{
  "query": {
    "match": {
      "name": "lap"  # User types "lap"
    }
  }
}

# Returns: "Laptop", "Lap Desk", "Lapdance" (if exists 😅)
```

### 2. Completion Suggester

**Setup:**

```bash
PUT /products
{
  "mappings": {
    "properties": {
      "suggest": {
        "type": "completion"
      }
    }
  }
}

# Index with suggestions
POST /products/_doc/1
{
  "name": "Laptop",
  "suggest": {
    "input": ["Laptop", "Gaming Laptop", "Notebook"],
    "weight": 10  # Higher = ranked first
  }
}
```

**Query:**

```bash
GET /products/_search
{
  "suggest": {
    "product-suggest": {
      "prefix": "lap",  # User types "lap"
      "completion": {
        "field": "suggest",
        "size": 5,
        "skip_duplicates": true
      }
    }
  }
}

# Response:
{
  "suggest": {
    "product-suggest": [{
      "options": [
        {"text": "Laptop", "_score": 10},
        {"text": "Gaming Laptop", "_score": 10}
      ]
    }]
  }
}
```

---

## 🌍 Geospatial Search

**Geospatial** = Location-based search

### 1. Geo Distance Query

```bash
GET /locations/_search
{
  "query": {
    "bool": {
      "must": {"match_all": {}},
      "filter": {
        "geo_distance": {
          "distance": "5km",
          "location": {
            "lat": 40.748817,
            "lon": -73.985428
          }
        }
      }
    }
  }
}

# Find locations within 5km of Empire State Building
```

### 2. Geo Bounding Box

```bash
GET /locations/_search
{
  "query": {
    "geo_bounding_box": {
      "location": {
        "top_left": {
          "lat": 40.8,
          "lon": -74.0
        },
        "bottom_right": {
          "lat": 40.7,
          "lon": -73.9
        }
      }
    }
  }
}

# Find locations in rectangle area
```

### 3. Sort by Distance

```bash
GET /locations/_search
{
  "query": {"match_all": {}},
  "sort": [
    {
      "_geo_distance": {
        "location": {
          "lat": 40.748817,
          "lon": -73.985428
        },
        "order": "asc",
        "unit": "km"
      }
    }
  ]
}

# Sort by distance from point (nearest first)
```

---

## 🌐 Multi-Language Search

**Multi-language** = Support search across different languages

### 1. Language-Specific Analyzers

```bash
PUT /articles
{
  "settings": {
    "analysis": {
      "analyzer": {
        "english_analyzer": {
          "type": "english"
        },
        "french_analyzer": {
          "type": "french"
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "title_en": {
        "type": "text",
        "analyzer": "english_analyzer"
      },
      "title_fr": {
        "type": "text",
        "analyzer": "french_analyzer"
      }
    }
  }
}
```

### 2. Multi-Language Query

```bash
GET /articles/_search
{
  "query": {
    "multi_match": {
      "query": "machine learning",
      "fields": [
        "title_en",
        "title_fr",
        "title_es",
        "title_de"
      ]
    }
  }
}
```

### 3. Language Detection

```python
from langdetect import detect

def search_multi_language(query_text):
    # Detect language
    lang = detect(query_text)  # 'en', 'fr', 'es', etc.
    
    # Search appropriate field
    field = f"title_{lang}"
    
    return es.search(index='articles', body={
        "query": {
            "match": {
                field: query_text
            }
        }
    })
```

---

## ⚡ Performance Optimization

### 1. Use Filter Context

```bash
# ❌ Slow (scoring all results)
{
  "query": {
    "bool": {
      "must": [
        {"term": {"status": "published"}},
        {"range": {"price": {"lte": 1000}}}
      ]
    }
  }
}

# ✅ Fast (caching, no scoring)
{
  "query": {
    "bool": {
      "must": [
        {"match": {"name": "laptop"}}
      ],
      "filter": [
        {"term": {"status": "published"}},
        {"range": {"price": {"lte": 1000}}}
      ]
    }
  }
}
```

### 2. Limit Fields Returned

```bash
GET /products/_search
{
  "_source": ["name", "price"],  # Only return these fields
  "query": {"match_all": {}}
}

# Or exclude fields:
{
  "_source": {
    "excludes": ["large_description", "image_data"]
  }
}
```

### 3. Pagination (Search After)

```bash
# ❌ Slow for deep pagination
GET /products/_search
{
  "from": 10000,  # Skip 10,000 results
  "size": 10
}

# ✅ Fast (search_after)
GET /products/_search
{
  "size": 10,
  "query": {"match_all": {}},
  "search_after": [1234567890, "product_999"],  # From previous page
  "sort": [
    {"timestamp": "desc"},
    {"_id": "asc"}
  ]
}
```

### 4. Query Caching

```bash
# Requests cache (enabled by default)
GET /products/_search?request_cache=true
{
  "size": 0,
  "aggs": {
    "popular_categories": {
      "terms": {"field": "category"}
    }
  }
}

# Shard request cache - for aggregations
```

### 5. Index Settings

```bash
PUT /products
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "refresh_interval": "30s",  # Default: 1s (slower = better indexing)
    "index.queries.cache.enabled": true
  }
}
```

---

## 💡 Best Practices

### ✅ DO:

1. **Use appropriate query type**
```bash
✅ term/terms for exact matches (keyword fields)
✅ match/multi_match for full-text search
✅ bool for combining queries
```

2. **Use filter context for non-scoring queries**
```bash
✅ filter: {"term": {"status": "published"}}
❌ must: {"term": {"status": "published"}}
```

3. **Boost important fields**
```bash
✅ "fields": ["title^3", "content^1", "tags^2"]
```

4. **Limit returned fields**
```bash
✅ "_source": ["id", "title", "price"]
❌ "_source": true  # Returns everything
```

5. **Use aggregations for analytics**
```bash
✅ Group, count, average in single query
❌ Multiple queries to calculate stats
```

### ❌ DON'T:

1. **Don't use wildcard prefix**
```bash
❌ "query": "*something"  # Very slow!
✅ "query": "something*"
```

2. **Don't use must when filter is enough**
```bash
❌ "must": [{"term": {"status": "active"}}]
✅ "filter": [{"term": {"status": "active"}}]
```

3. **Don't deep paginate with from/size**
```bash
❌ "from": 10000, "size": 10
✅ Use search_after for deep pagination
```

4. **Don't return large fields**
```bash
❌ Return image_data, file_content in every search
✅ Exclude large fields, fetch separately
```

---

## 📚 Summary

**Key Takeaways:**

1. ✅ **Term-level** = Exact matches (keyword)
2. ✅ **Full-text** = Analyzed searches (text)
3. ✅ **Boolean** = Combine with must/should/filter
4. ✅ **Fuzzy** = Handle typos
5. ✅ **Semantic** = Understand meaning (vectors)
6. ✅ **Hybrid** = Combine keyword + semantic
7. ✅ **Aggregations** = Analytics on results
8. ⚠️ Use filter for non-scoring queries (faster)
9. ⚠️ Boost important fields
10. ⚠️ Test and optimize for your use case

**Search Strategy Decision Tree:**

```
What type of search?
├─ Exact match? → term/terms
├─ Full-text? → match/multi_match
├─ Typo-tolerant? → fuzzy
├─ Meaning-based? → semantic (vector)
├─ Best of both? → hybrid
├─ Location-based? → geospatial
└─ Multiple conditions? → bool query
```

---

*Cập nhật: 1 Tháng 2, 2026*
