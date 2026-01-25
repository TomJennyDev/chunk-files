# Elasticsearch Enterprise Use Cases

Real-world enterprise architectures, implementations, and patterns from leading companies.

---

## 📋 Table of Contents

1. [E-Commerce Search](#e-commerce-search)
2. [Log Analytics (ELK Stack)](#log-analytics-elk-stack)
3. [Security Analytics (SIEM)](#security-analytics-siem)
4. [Application Performance Monitoring](#application-performance-monitoring)
5. [Enterprise Search](#enterprise-search)
6. [Real-Time Analytics](#real-time-analytics)
7. [Recommendation Systems](#recommendation-systems)
8. [Multi-Tenancy Strategies](#multi-tenancy-strategies)
9. [Scaling Patterns](#scaling-patterns)
10. [Cost Optimization](#cost-optimization)

---

## 🛒 E-Commerce Search

### Real-World Example: Amazon-Style Product Search

**Scale:**
- 100M+ products
- 10K+ searches/second
- <100ms response time
- 99.99% availability

---

### Architecture

```
┌────────────────────────────────────────────────────────┐
│                  Load Balancer (ALB)                   │
└────────────────────────────────────────────────────────┘
                         ↓
    ┌────────────────────┼────────────────────┐
    ↓                    ↓                    ↓
┌─────────┐        ┌─────────┐        ┌─────────┐
│ Coord-1 │        │ Coord-2 │        │ Coord-3 │
└─────────┘        └─────────┘        └─────────┘
                         ↓
    ┌────────────────────┼────────────────────┐
    ↓                    ↓                    ↓
┌─────────┐        ┌─────────┐        ┌─────────┐
│ Hot-1   │        │ Hot-2   │        │ Hot-3   │
│ Recent  │        │ Recent  │        │ Recent  │
│ Products│        │ Products│        │ Products│
└─────────┘        └─────────┘        └─────────┘
    ↓                    ↓                    ↓
┌─────────┐        ┌─────────┐        ┌─────────┐
│ Warm-1  │        │ Warm-2  │        │ Warm-3  │
│ Archive │        │ Archive │        │ Archive │
│ Products│        │ Products│        │ Products│
└─────────┘        └─────────┘        └─────────┘
```

---

### Index Design

```bash
PUT /products
{
  "settings": {
    "number_of_shards": 10,
    "number_of_replicas": 2,
    "refresh_interval": "30s",  # Balance indexing speed vs freshness
    "analysis": {
      "analyzer": {
        "product_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "asciifolding", "synonym", "stemmer"]
        },
        "autocomplete_analyzer": {
          "type": "custom",
          "tokenizer": "edge_ngram_tokenizer",
          "filter": ["lowercase"]
        }
      },
      "tokenizer": {
        "edge_ngram_tokenizer": {
          "type": "edge_ngram",
          "min_gram": 2,
          "max_gram": 10,
          "token_chars": ["letter", "digit"]
        }
      },
      "filter": {
        "synonym": {
          "type": "synonym",
          "synonyms": [
            "laptop, notebook, computer",
            "phone, smartphone, mobile"
          ]
        },
        "stemmer": {
          "type": "stemmer",
          "language": "english"
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "analyzer": "product_analyzer",
        "fields": {
          "keyword": {"type": "keyword"},
          "autocomplete": {
            "type": "text",
            "analyzer": "autocomplete_analyzer"
          }
        }
      },
      "description": {
        "type": "text",
        "analyzer": "product_analyzer"
      },
      "brand": {
        "type": "keyword"
      },
      "category": {
        "type": "keyword"
      },
      "price": {
        "type": "scaled_float",
        "scaling_factor": 100
      },
      "rating": {
        "type": "half_float"
      },
      "reviews_count": {
        "type": "integer"
      },
      "in_stock": {
        "type": "boolean"
      },
      "tags": {
        "type": "keyword"
      },
      "created_at": {
        "type": "date"
      },
      "sales_rank": {
        "type": "rank_feature"  # Boost popular products
      },
      "attributes": {
        "type": "nested",
        "properties": {
          "key": {"type": "keyword"},
          "value": {"type": "keyword"}
        }
      }
    }
  }
}
```

---

### Search Query

```bash
GET /products/_search
{
  "query": {
    "function_score": {
      "query": {
        "bool": {
          "must": [
            {
              "multi_match": {
                "query": "gaming laptop",
                "fields": [
                  "name^3",           # Name most important
                  "name.autocomplete^2",
                  "description",
                  "brand^2",
                  "category"
                ],
                "type": "best_fields",
                "fuzziness": "AUTO"
              }
            }
          ],
          "filter": [
            {"term": {"in_stock": true}},
            {"range": {"price": {"gte": 500, "lte": 2000}}},
            {"terms": {"brand": ["Dell", "HP", "Lenovo"]}}
          ]
        }
      },
      "functions": [
        {
          "filter": {"match_all": {}},
          "weight": 1.5,
          "field_value_factor": {
            "field": "sales_rank",
            "modifier": "log1p",
            "missing": 1
          }
        },
        {
          "filter": {"match_all": {}},
          "gauss": {
            "rating": {
              "origin": 5,
              "scale": 1,
              "decay": 0.5
            }
          },
          "weight": 2
        },
        {
          "filter": {"match_all": {}},
          "script_score": {
            "script": {
              "source": "Math.log(2 + doc['reviews_count'].value)"
            }
          }
        }
      ],
      "score_mode": "sum",
      "boost_mode": "multiply"
    }
  },
  "aggs": {
    "brands": {
      "terms": {"field": "brand", "size": 20}
    },
    "categories": {
      "terms": {"field": "category", "size": 10}
    },
    "price_ranges": {
      "range": {
        "field": "price",
        "ranges": [
          {"to": 500, "key": "Under $500"},
          {"from": 500, "to": 1000, "key": "$500-$1000"},
          {"from": 1000, "to": 2000, "key": "$1000-$2000"},
          {"from": 2000, "key": "Over $2000"}
        ]
      }
    }
  },
  "highlight": {
    "fields": {
      "name": {},
      "description": {
        "fragment_size": 150,
        "number_of_fragments": 3
      }
    }
  },
  "from": 0,
  "size": 20,
  "sort": [
    "_score",
    {"created_at": "desc"}
  ]
}
```

---

### Performance Optimizations

**1. Caching**
```bash
PUT /products/_settings
{
  "index.queries.cache.enabled": true,
  "index.requests.cache.enable": true
}
```

**2. Routing**
```bash
# Index with routing by category
PUT /products/_doc/123?routing=electronics
{
  "name": "Laptop",
  "category": "electronics"
}

# Search with routing (hits fewer shards)
GET /products/_search?routing=electronics
{
  "query": {"match": {"name": "laptop"}}
}
```

**3. Index Sorting**
```bash
PUT /products
{
  "settings": {
    "index.sort.field": ["sales_rank", "_doc"],
    "index.sort.order": ["desc", "asc"]
  }
}
# Early termination for sorted queries
```

---

### Key Metrics

**Amazon's Reported Numbers:**
- 100ms search latency increases revenue by 1%
- 1 second delay = 7% loss in conversions
- Personalization increases revenue by 30%

**SLA Targets:**
- **P50 latency:** <50ms
- **P95 latency:** <200ms
- **P99 latency:** <500ms
- **Availability:** 99.99% (52 minutes downtime/year)

---

## 📊 Log Analytics (ELK Stack)

### Real-World Example: Uber's Logging Infrastructure

**Scale:**
- 100TB+ logs/day
- 10M+ events/second
- 5PB+ total storage
- 7-day hot, 90-day warm, 1-year cold

---

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                         │
│  (10,000+ microservices generating logs)                    │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    Beats / Logstash                         │
│  - Filebeat: Collect logs                                   │
│  - Metricbeat: Collect metrics                              │
│  - Logstash: Parse and transform                            │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  Kafka Buffer (Optional)                    │
│  - Handle traffic spikes                                    │
│  - Decouple collection from indexing                        │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│               Elasticsearch Cluster                         │
│                                                             │
│  Hot Tier (7 days)                                          │
│  ├── 20 nodes × 32GB heap × 1TB NVMe SSD                   │
│  └── Indices: logs-2026-01-25, logs-2026-01-24, ...        │
│                                                             │
│  Warm Tier (90 days)                                        │
│  ├── 10 nodes × 32GB heap × 5TB SATA SSD                   │
│  └── Indices: logs-2025-12-*, logs-2025-11-*, ...          │
│                                                             │
│  Cold Tier (1 year)                                         │
│  ├── 5 nodes × 16GB heap × 10TB HDD                        │
│  └── Indices: logs-2025-*, logs-2024-*, ...                │
│                                                             │
│  Snapshot to S3 (Archive)                                   │
│  └── All indices older than 1 year                          │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                       Kibana                                │
│  - Dashboards for monitoring                                │
│  - Alerting for critical errors                             │
│  - Log exploration and debugging                            │
└─────────────────────────────────────────────────────────────┘
```

---

### Index Template

```bash
PUT /_index_template/logs-template
{
  "index_patterns": ["logs-*"],
  "template": {
    "settings": {
      "number_of_shards": 3,
      "number_of_replicas": 1,
      "refresh_interval": "5s",
      "codec": "best_compression",  # Save 30-50% disk space
      "index.lifecycle.name": "logs-policy"
    },
    "mappings": {
      "properties": {
        "@timestamp": {"type": "date"},
        "level": {"type": "keyword"},
        "message": {
          "type": "text",
          "fields": {
            "keyword": {
              "type": "keyword",
              "ignore_above": 256
            }
          }
        },
        "service": {"type": "keyword"},
        "host": {"type": "keyword"},
        "env": {"type": "keyword"},
        "trace_id": {"type": "keyword"},
        "user_id": {"type": "keyword"},
        "request_id": {"type": "keyword"},
        "duration_ms": {"type": "float"},
        "status_code": {"type": "integer"},
        "error": {
          "properties": {
            "type": {"type": "keyword"},
            "message": {"type": "text"},
            "stack_trace": {"type": "text"}
          }
        },
        "metadata": {
          "type": "object",
          "enabled": false  # Don't index, just store
        }
      }
    }
  }
}
```

---

### Index Lifecycle Management (ILM)

```bash
PUT /_ilm/policy/logs-policy
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_primary_shard_size": "50GB",
            "max_age": "1d"
          },
          "set_priority": {
            "priority": 100
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
          },
          "allocate": {
            "require": {
              "data_tier": "warm"
            }
          },
          "set_priority": {
            "priority": 50
          }
        }
      },
      "cold": {
        "min_age": "90d",
        "actions": {
          "allocate": {
            "require": {
              "data_tier": "cold"
            }
          },
          "set_priority": {
            "priority": 0
          }
        }
      },
      "delete": {
        "min_age": "365d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

---

### Common Log Queries

**1. Error Rate Dashboard**
```bash
GET /logs-*/_search
{
  "size": 0,
  "query": {
    "range": {
      "@timestamp": {
        "gte": "now-1h"
      }
    }
  },
  "aggs": {
    "errors_over_time": {
      "date_histogram": {
        "field": "@timestamp",
        "fixed_interval": "1m"
      },
      "aggs": {
        "error_rate": {
          "filter": {
            "term": {"level": "ERROR"}
          }
        }
      }
    },
    "top_errors": {
      "filter": {
        "term": {"level": "ERROR"}
      },
      "aggs": {
        "error_types": {
          "terms": {
            "field": "error.type",
            "size": 10
          }
        }
      }
    }
  }
}
```

**2. Trace Request Across Services**
```bash
GET /logs-*/_search
{
  "query": {
    "term": {
      "trace_id": "abc-123-xyz"
    }
  },
  "sort": [
    {"@timestamp": "asc"}
  ],
  "size": 100
}
```

**3. Slow Requests**
```bash
GET /logs-*/_search
{
  "query": {
    "bool": {
      "must": [
        {"range": {"@timestamp": {"gte": "now-15m"}}},
        {"range": {"duration_ms": {"gte": 5000}}}
      ]
    }
  },
  "aggs": {
    "slow_services": {
      "terms": {
        "field": "service",
        "size": 10
      },
      "aggs": {
        "avg_duration": {
          "avg": {"field": "duration_ms"}
        },
        "max_duration": {
          "max": {"field": "duration_ms"}
        }
      }
    }
  }
}
```

---

### Cost Optimization

**1. Compression**
```
Standard codec: 1TB/day
Best compression: 500GB/day (50% savings)
```

**2. Tiered Storage**
```
All hot: $10,000/month
Hot+Warm+Cold: $4,000/month (60% savings)
With snapshots: $2,500/month (75% savings)
```

**3. Rollup**
```bash
PUT /_rollup/job/logs-rollup
{
  "index_pattern": "logs-*",
  "rollup_index": "logs-rollup",
  "cron": "0 0 * * * ?",
  "page_size": 1000,
  "groups": {
    "date_histogram": {
      "field": "@timestamp",
      "fixed_interval": "1h"
    },
    "terms": {
      "fields": ["service", "level"]
    }
  },
  "metrics": [
    {
      "field": "duration_ms",
      "metrics": ["avg", "max", "min"]
    }
  ]
}

# Result: 1TB raw logs → 10GB rollup (100x compression!)
```

---

## 🔒 Security Analytics (SIEM)

### Real-World Example: Elastic Security

**Use Cases:**
- Threat detection
- Incident response
- Compliance monitoring
- User behavior analytics

---

### Security Event Index

```bash
PUT /security-events
{
  "mappings": {
    "properties": {
      "@timestamp": {"type": "date"},
      "event": {
        "properties": {
          "type": {"type": "keyword"},
          "category": {"type": "keyword"},
          "action": {"type": "keyword"},
          "outcome": {"type": "keyword"},
          "severity": {"type": "byte"}
        }
      },
      "source": {
        "properties": {
          "ip": {"type": "ip"},
          "port": {"type": "integer"},
          "geo": {
            "properties": {
              "country": {"type": "keyword"},
              "city": {"type": "keyword"},
              "location": {"type": "geo_point"}
            }
          }
        }
      },
      "destination": {
        "properties": {
          "ip": {"type": "ip"},
          "port": {"type": "integer"}
        }
      },
      "user": {
        "properties": {
          "name": {"type": "keyword"},
          "id": {"type": "keyword"},
          "role": {"type": "keyword"}
        }
      },
      "file": {
        "properties": {
          "path": {"type": "keyword"},
          "hash": {"type": "keyword"}
        }
      },
      "process": {
        "properties": {
          "name": {"type": "keyword"},
          "pid": {"type": "long"},
          "parent": {
            "properties": {
              "name": {"type": "keyword"},
              "pid": {"type": "long"}
            }
          }
        }
      }
    }
  }
}
```

---

### Threat Detection Rules

**1. Brute Force Login Detection**
```bash
# Watcher alert
PUT _watcher/watch/brute-force-alert
{
  "trigger": {
    "schedule": {"interval": "5m"}
  },
  "input": {
    "search": {
      "request": {
        "indices": ["security-events"],
        "body": {
          "query": {
            "bool": {
              "must": [
                {"range": {"@timestamp": {"gte": "now-5m"}}},
                {"term": {"event.action": "login_failed"}}
              ]
            }
          },
          "aggs": {
            "by_user": {
              "terms": {
                "field": "user.name",
                "min_doc_count": 10
              }
            }
          }
        }
      }
    }
  },
  "condition": {
    "compare": {
      "ctx.payload.aggregations.by_user.buckets.length": {
        "gt": 0
      }
    }
  },
  "actions": {
    "send_alert": {
      "email": {
        "to": "security@company.com",
        "subject": "Brute force attack detected",
        "body": "User {{ctx.payload.aggregations.by_user.buckets.0.key}} had {{ctx.payload.aggregations.by_user.buckets.0.doc_count}} failed logins"
      }
    }
  }
}
```

**2. Anomaly Detection with Machine Learning**
```bash
PUT _ml/anomaly_detectors/network-anomaly
{
  "description": "Detect unusual network traffic patterns",
  "analysis_config": {
    "bucket_span": "15m",
    "detectors": [
      {
        "function": "high_count",
        "by_field_name": "source.ip"
      },
      {
        "function": "rare",
        "by_field_name": "destination.port"
      }
    ],
    "influencers": ["source.ip", "user.name"]
  },
  "data_description": {
    "time_field": "@timestamp"
  }
}
```

---

## 📈 Application Performance Monitoring

**Example: Datadog/New Relic-style APM**

### Spans Index (Distributed Tracing)

```bash
PUT /apm-spans
{
  "mappings": {
    "properties": {
      "trace_id": {"type": "keyword"},
      "span_id": {"type": "keyword"},
      "parent_span_id": {"type": "keyword"},
      "service": {"type": "keyword"},
      "operation": {"type": "keyword"},
      "start_time": {"type": "date"},
      "duration_ms": {"type": "float"},
      "status": {"type": "keyword"},
      "tags": {
        "type": "object",
        "dynamic": true
      }
    }
  }
}
```

### Query: Find Slow Traces

```bash
GET /apm-spans/_search
{
  "query": {
    "bool": {
      "must": [
        {"range": {"start_time": {"gte": "now-1h"}}},
        {"range": {"duration_ms": {"gte": 1000}}}
      ],
      "must_not": [
        {"term": {"parent_span_id": {"value": ""}}}
      ]
    }
  },
  "aggs": {
    "by_service": {
      "terms": {"field": "service"},
      "aggs": {
        "avg_duration": {"avg": {"field": "duration_ms"}},
        "p95_duration": {
          "percentiles": {
            "field": "duration_ms",
            "percents": [95]
          }
        }
      }
    }
  }
}
```

---

## 🏢 Enterprise Search

**Example: Internal Document Search (Confluence/Sharepoint)**

### Document Index

```bash
PUT /documents
{
  "mappings": {
    "properties": {
      "title": {
        "type": "text",
        "analyzer": "standard"
      },
      "content": {
        "type": "text",
        "analyzer": "standard",
        "term_vector": "with_positions_offsets"  # For highlighting
      },
      "author": {"type": "keyword"},
      "department": {"type": "keyword"},
      "created_at": {"type": "date"},
      "updated_at": {"type": "date"},
      "permissions": {
        "type": "nested",
        "properties": {
          "user_id": {"type": "keyword"},
          "access_level": {"type": "keyword"}
        }
      },
      "attachments": {
        "type": "nested",
        "properties": {
          "filename": {"type": "keyword"},
          "content": {
            "type": "text",
            "analyzer": "standard"
          }
        }
      }
    }
  }
}
```

### Permission-Aware Search

```bash
GET /documents/_search
{
  "query": {
    "bool": {
      "must": [
        {
          "multi_match": {
            "query": "quarterly results",
            "fields": ["title^2", "content", "attachments.content"]
          }
        }
      ],
      "filter": [
        {
          "nested": {
            "path": "permissions",
            "query": {
              "bool": {
                "should": [
                  {"term": {"permissions.user_id": "user-123"}},
                  {"term": {"permissions.access_level": "public"}}
                ]
              }
            }
          }
        }
      ]
    }
  }
}
```

---

## 🎯 Multi-Tenancy Strategies

### Strategy 1: Index Per Tenant (Best Isolation)

```
tenant-1-products
tenant-2-products
tenant-3-products
...

Pros:
✅ Complete data isolation
✅ Easy per-tenant backup
✅ Easy tenant deletion
✅ Independent scaling

Cons:
❌ Many indices (cluster state overhead if >1000 tenants)
❌ Resource overhead per index
```

### Strategy 2: Shared Index with Filtering (Best Scale)

```
products (single index)

Document: {
  "tenant_id": "tenant-1",
  "name": "Laptop",
  ...
}

Query:
GET /products/_search
{
  "query": {
    "bool": {
      "must": [{"match": {"name": "laptop"}}],
      "filter": [{"term": {"tenant_id": "tenant-1"}}]
    }
  }
}

Pros:
✅ Scales to 100K+ tenants
✅ Single index to manage
✅ Efficient resource usage

Cons:
❌ No data isolation (must filter correctly!)
❌ Cannot delete tenant data easily
❌ Shared shard resources
```

### Strategy 3: Routing (Best Performance)

```
GET /products/_search?routing=tenant-1
{
  "query": {...}
}

Pros:
✅ Queries only hit specific shards
✅ Better performance
✅ Scales well

Cons:
❌ Requires client to know tenant
❌ Uneven shard distribution if tenant sizes vary
```

---

## 📈 Scaling Patterns

### Horizontal Scaling (Add Nodes)

```
Current: 3 nodes, 50GB each
Add 3 more nodes
→ Elasticsearch automatically rebalances shards
→ Capacity: 150GB → 300GB
```

### Vertical Scaling (Bigger Nodes)

```
Current: 16GB heap
Upgrade: 32GB heap
→ More filter cache, more field data
→ Better for heavy aggregations
```

### Hybrid Scaling

```
Hot tier: High-end nodes (NVMe, 32GB heap)
Warm tier: Mid-range nodes (SSD, 16GB heap)
Cold tier: Cheap nodes (HDD, 8GB heap)
```

---

## 💰 Cost Optimization

### 1. Storage Optimization

```
Technique                 Savings
─────────────────────────────────
best_compression codec    30-50%
ILM with tiering         60-75%
Rollup jobs              90-95%
Index sorting            10-20% (better compression)
```

### 2. Compute Optimization

```
Strategy                           Savings
────────────────────────────────────────────
Query caching                      20-40%
Filter context (vs query)          10-20%
Routing to specific shards         30-50%
Reduce replicas (dev/test)         50%
```

### 3. Real-World Costs (AWS)

**Small Setup (Dev/Test):**
```
1 × t3.large.elasticsearch (4GB)
50GB storage
= $60/month
```

**Medium Setup (Production):**
```
3 × m5.xlarge.elasticsearch (16GB)
500GB SSD
= $800/month
```

**Large Setup (Enterprise):**
```
10 × r5.4xlarge.elasticsearch (128GB)
5TB SSD, hot+warm+cold tiering
= $15,000/month
```

---

## 🎯 Key Takeaways

1. **E-Commerce:** Focus on relevance scoring and faceted search
2. **Logging:** ILM and tiered storage are essential
3. **Security:** Nested objects for complex relationships
4. **Multi-Tenancy:** Choose strategy based on scale
5. **Scaling:** Plan for growth, use tiered storage
6. **Cost:** Compression + ILM = 75% savings

---

## 📚 Next Steps

- ✅ Completed **ENTERPRISE-USE-CASES.md** ← You are here
- ➡️ Next: [OPTIMIZATION.md](./OPTIMIZATION.md) - Performance tuning
- 📖 Back to: [README.md](./README.md) - Main guide

---

*Last Updated: January 25, 2026*
