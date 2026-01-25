# Kibana Quick Reference Guide

## 🌐 Access Kibana

**URL:** http://localhost:5601

---

## 📋 Common Queries (Dev Tools Console)

### 1. View All Documents
```json
GET file-chunks/_search
{
  "size": 10,
  "sort": [
    { "timestamp": "desc" }
  ]
}
```

### 2. Count Documents
```json
GET file-chunks/_count
```

### 3. Search by Text
```json
GET file-chunks/_search
{
  "query": {
    "match": {
      "text": "terraform"
    }
  },
  "highlight": {
    "fields": {
      "text": {}
    }
  }
}
```

### 4. Search by File ID
```json
GET file-chunks/_search
{
  "query": {
    "term": {
      "fileId": "02c3fe01-9be3-4fe8-9e3a-33b6b32a8192"
    }
  }
}
```

### 5. Get Index Mapping
```json
GET file-chunks/_mapping
```

### 6. Get Index Stats
```json
GET file-chunks/_stats
```

### 7. Aggregation - Files Count
```json
GET file-chunks/_search
{
  "size": 0,
  "aggs": {
    "files": {
      "terms": {
        "field": "fileName.keyword",
        "size": 10
      }
    }
  }
}
```

### 8. Full-text Search with Position
```json
GET file-chunks/_search
{
  "query": {
    "bool": {
      "must": [
        { "match": { "text": "terraform" } }
      ],
      "filter": [
        { "term": { "fileId": "your-file-id" } }
      ]
    }
  },
  "_source": ["fileName", "chunkIndex", "text", "position"],
  "sort": [
    { "chunkIndex": "asc" }
  ],
  "highlight": {
    "fields": {
      "text": {
        "pre_tags": ["<mark>"],
        "post_tags": ["</mark>"],
        "fragment_size": 150
      }
    }
  }
}
```

### 9. Delete All Documents (Careful!)
```json
POST file-chunks/_delete_by_query
{
  "query": {
    "match_all": {}
  }
}
```

### 10. Delete Specific File's Chunks
```json
POST file-chunks/_delete_by_query
{
  "query": {
    "term": {
      "fileId": "your-file-id-to-delete"
    }
  }
}
```

---

## 🔍 Discover Tab Filters

### Filter by Date Range
```
timestamp >= "2026-01-25" AND timestamp < "2026-01-26"
```

### Filter by Text
```
text: "terraform"
```

### Filter by File
```
fileName.keyword: "README.md"
```

### Combined Filters
```
text: "terraform" AND fileName.keyword: "README.md"
```

---

## 📊 Visualizations

### 1. Create Bar Chart - Documents per File

1. Menu → **Visualize Library**
2. Click **"Create visualization"**
3. Select **"Bar vertical"**
4. Configure:
   - **Index pattern:** file-chunks
   - **X-axis:** Terms → fileName.keyword
   - **Y-axis:** Count

### 2. Create Timeline - Upload Activity

1. Create visualization → **"Line"**
2. Configure:
   - **X-axis:** Date Histogram → timestamp (interval: 1 hour)
   - **Y-axis:** Count

### 3. Create Metric - Total Chunks

1. Create visualization → **"Metric"**
2. Configure:
   - **Metric:** Count

---

## 🎯 Dashboard Creation

1. Menu → **Dashboard**
2. Click **"Create dashboard"**
3. Click **"Add from library"**
4. Select visualizations you created
5. Arrange and save

---

## 🔧 Index Management

### View Index
```
Menu → Stack Management → Index Management
```

### View Index Pattern
```
Menu → Stack Management → Data Views
```

### Refresh Index
```json
POST file-chunks/_refresh
```

---

## 💡 Useful Shortcuts

| Action | Shortcut |
|--------|----------|
| Open Command | `Ctrl + /` |
| Run Query | `Ctrl + Enter` |
| Format Query | `Ctrl + I` |
| Auto-complete | `Ctrl + Space` |

---

## 🎨 Sample Dashboard Layout

```
┌─────────────────────────────────────────────┐
│  Total Chunks: 1,234                        │
│  Total Files: 15                            │
│  Avg Chunk Size: 850 chars                  │
└─────────────────────────────────────────────┘

┌──────────────────────┬──────────────────────┐
│  Upload Timeline     │  Files Bar Chart     │
│  (Line chart)        │  (Bar chart)         │
│                      │                      │
│    ▁▃▅▇█            │   ████              │
│                      │   ██                │
└──────────────────────┴──────────────────────┘

┌─────────────────────────────────────────────┐
│  Recent Documents (Table)                   │
│  FileName | ChunkIndex | Text Preview      │
│  README.md | 5 | To deploy terraform...    │
│  config.yml | 2 | AWS configuration...     │
└─────────────────────────────────────────────┘
```

---

## 🚀 Next Steps

1. **Create Data View** for `file-chunks`
2. **Explore Discover** tab to see your data
3. **Try Dev Tools** queries above
4. **Create Visualizations** for monitoring
5. **Build Dashboard** for overview

---

## 📚 Resources

- **Kibana Docs:** https://www.elastic.co/guide/en/kibana/8.11/index.html
- **Query DSL:** https://www.elastic.co/guide/en/elasticsearch/reference/8.11/query-dsl.html
- **KQL Syntax:** https://www.elastic.co/guide/en/kibana/8.11/kuery-query.html

---

## ⚠️ Important Notes

- **Dev Environment Only** - Don't expose Kibana publicly without authentication
- **No Security** - Current setup has `xpack.security.enabled=false`
- **Data Persistence** - Elasticsearch data persists between restarts
- **Resource Usage** - Kibana uses ~300MB RAM

---

## 🔄 Restart Kibana

```bash
cd /d/devops/terraform/terraform-eks/localstack
docker compose restart kibana

# View logs
docker logs -f kibana-local
```

---

**Created:** January 25, 2026  
**Kibana Version:** 8.11.0  
**Elasticsearch:** http://localhost:9200  
**Kibana:** http://localhost:5601
