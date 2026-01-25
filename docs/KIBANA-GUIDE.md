# Kibana User Guide - File Processing System

Complete guide to using Kibana for monitoring and searching your file processing system.

---

## 📋 Table of Contents

1. [Quick Access](#quick-access)
2. [First Time Setup](#first-time-setup)
3. [Discover - Search Your Files](#discover---search-your-files)
4. [Dev Tools - Advanced Queries](#dev-tools---advanced-queries)
5. [Visualizations](#visualizations)
6. [Dashboard Creation](#dashboard-creation)
7. [Common Use Cases](#common-use-cases)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Access

**Kibana URL:** http://localhost:5601

**Index Name:** `file-chunks`

**Key Fields:**
- `content` - Full text content of chunk
- `fileName` - Name of uploaded file
- `fileId` - Unique file identifier
- `chunkIndex` - Position in file (0, 1, 2...)
- `metadata.fileSize` - Original file size
- `startByte` / `endByte` - Byte positions

---

## 🎯 First Time Setup

### Step 1: Open Kibana

```
Open browser: http://localhost:5601
```

### Step 2: Create Data View

1. Click **hamburger menu (☰)** → **Management** → **Stack Management**
2. In sidebar: **Kibana** → **Data Views**
3. Click **Create data view**
4. Fill in:
   ```
   Name: File Chunks
   Index pattern: file-chunks
   Timestamp field: @timestamp (or leave default)
   ```
5. Click **Save data view to Kibana**

✅ **Done!** Now you can explore your data.

---

## 🔍 Discover - Search Your Files

### Access Discover

☰ Menu → **Analytics** → **Discover**

### Your Index Structure

```json
{
  "fileId": "02c3fe01-9be3-4fe8-9e3a-33b6b32a8192",
  "chunkIndex": 0,
  "content": "# EKS Terraform Configuration...",
  "startByte": 0,
  "endByte": 28089,
  "metadata": {
    "fileName": "README.md",
    "fileSize": 28089,
    "chunkSize": 28089
  }
}
```

### Basic Search Examples

#### 1. Search for Text Content

```kql
content: "terraform"
```

#### 2. Search Specific File

```kql
metadata.fileName: "README.md"
```

#### 3. Find Large Chunks

```kql
metadata.chunkSize > 10000
```

#### 4. Search by File ID

```kql
fileId: "02c3fe01-9be3-4fe8-9e3a-33b6b32a8192"
```

#### 5. Combined Search

```kql
content: "kubernetes" AND metadata.fileName: "*.md"
```

#### 6. Multi-term Search

```kql
content: (terraform OR kubernetes OR docker)
```

### Time Range

**Top-right corner** → Click time picker:
- Last 15 minutes
- Last 24 hours
- Last 7 days
- **Custom range**

💡 **Tip:** Use "Last 7 days" for development

### View Full Document

1. Click **>** arrow next to any result
2. See all fields in **Table** or **JSON** view
3. Click **View surrounding documents** for context

---

## 🛠️ Dev Tools - Advanced Queries

### Access Dev Tools

☰ Menu → **Management** → **Dev Tools**

### Essential Queries for File Processing

#### 1. Count Total Documents

```json
GET file-chunks/_count
```

**Expected:**
```json
{
  "count": 5
}
```

#### 2. List All Files

```json
GET file-chunks/_search
{
  "size": 0,
  "aggs": {
    "unique_files": {
      "terms": {
        "field": "metadata.fileName.keyword",
        "size": 100
      }
    }
  }
}
```

#### 3. Search Full-Text with Highlighting

```json
GET file-chunks/_search
{
  "query": {
    "match": {
      "content": "terraform kubernetes"
    }
  },
  "highlight": {
    "fields": {
      "content": {
        "pre_tags": ["<mark>"],
        "post_tags": ["</mark>"],
        "fragment_size": 150,
        "number_of_fragments": 3
      }
    }
  },
  "sort": [
    "_score"
  ],
  "size": 10
}
```

#### 4. Get Chunks for Specific File

```json
GET file-chunks/_search
{
  "query": {
    "term": {
      "fileId": "02c3fe01-9be3-4fe8-9e3a-33b6b32a8192"
    }
  },
  "sort": [
    { "chunkIndex": "asc" }
  ]
}
```

#### 5. File Statistics

```json
GET file-chunks/_search
{
  "size": 0,
  "aggs": {
    "files": {
      "terms": {
        "field": "metadata.fileName.keyword",
        "size": 50
      },
      "aggs": {
        "total_chunks": {
          "cardinality": {
            "field": "chunkIndex"
          }
        },
        "total_size": {
          "sum": {
            "field": "metadata.fileSize"
          }
        },
        "avg_chunk_size": {
          "avg": {
            "field": "metadata.chunkSize"
          }
        }
      }
    }
  }
}
```

#### 6. Search by Byte Position

```json
GET file-chunks/_search
{
  "query": {
    "range": {
      "startByte": {
        "gte": 0,
        "lte": 10000
      }
    }
  }
}
```

#### 7. Recent Uploads (if timestamp exists)

```json
GET file-chunks/_search
{
  "query": {
    "range": {
      "@timestamp": {
        "gte": "now-1d"
      }
    }
  },
  "sort": [
    { "@timestamp": "desc" }
  ],
  "size": 20
}
```

#### 8. Delete Specific File's Chunks

```json
POST file-chunks/_delete_by_query
{
  "query": {
    "term": {
      "fileId": "file-id-to-delete"
    }
  }
}
```

---

## 📊 Visualizations

### 1. Metric - Total Chunks Indexed

**Purpose:** Show total number of chunks

**Steps:**
1. ☰ Menu → **Visualize Library** → **Create visualization**
2. Select **Metric**
3. Select data view: `file-chunks`
4. Aggregation: **Count**
5. Click **Update**
6. **Save** as "Total Chunks"

**Display:**
```
┌──────────────────┐
│   Total Chunks   │
│       1,234      │
└──────────────────┘
```

---

### 2. Bar Chart - Chunks per File

**Purpose:** Compare chunk count across files

**Steps:**
1. Create visualization → **Bar vertical**
2. **Metrics:**
   - Y-axis: Count
3. **Buckets:**
   - X-axis: Terms
   - Field: `metadata.fileName.keyword`
   - Size: 20
4. Click **Update**
5. **Save** as "Chunks per File"

**Display:**
```
┌────────────────────────────┐
│   Chunks per File          │
│                            │
│  ████████████ README.md    │
│  ████████ setup.md         │
│  █████ config.yaml         │
└────────────────────────────┘
```

---

### 3. Pie Chart - File Size Distribution

**Purpose:** Show storage used by each file

**Steps:**
1. Create visualization → **Pie**
2. **Metrics:**
   - Slice size: Sum
   - Field: `metadata.fileSize`
3. **Buckets:**
   - Split slices: Terms
   - Field: `metadata.fileName.keyword`
   - Size: 10
4. **Save** as "File Size Distribution"

---

### 4. Data Table - File Summary

**Purpose:** Tabular view of all files

**Steps:**
1. Create visualization → **Data table**
2. **Metrics:**
   - Metric 1: Count (rename to "Chunks")
   - Metric 2: Max → `metadata.fileSize` (rename to "Size")
3. **Buckets:**
   - Split rows: Terms
   - Field: `metadata.fileName.keyword`
   - Size: 50
4. **Save** as "File Summary Table"

**Display:**
```
┌─────────────────┬────────┬──────────┐
│ File Name       │ Chunks │ Size (B) │
├─────────────────┼────────┼──────────┤
│ README.md       │   50   │  28,089  │
│ WORKFLOW.md     │   30   │  15,234  │
│ config.yaml     │   10   │   5,678  │
└─────────────────┴────────┴──────────┘
```

---

### 5. Tag Cloud - Common Words

**Purpose:** Most frequent terms in content

**Steps:**
1. Create visualization → **Tag cloud**
2. **Metrics:** Count
3. **Buckets:**
   - Tags: Significant Terms
   - Field: `content`
   - Size: 50
4. **Save** as "Common Terms"

---

## 📈 Dashboard Creation

### Create "File Processing Monitor" Dashboard

#### Step 1: Create Dashboard

1. ☰ Menu → **Analytics** → **Dashboard**
2. Click **Create dashboard**

#### Step 2: Add Visualizations

1. Click **Add panel**
2. Select **Add from library**
3. Add these visualizations:
   - Total Chunks (Metric)
   - Chunks per File (Bar)
   - File Size Distribution (Pie)
   - File Summary Table (Table)

#### Step 3: Arrange Layout

Drag and resize panels:

```
┌────────────────────────────────────────────────┐
│  File Processing Dashboard      [⟳ Refresh]   │
├──────────────┬──────────────┬──────────────────┤
│ Total Chunks │ Total Files  │ Avg Chunk Size   │
│    1,234     │      45      │     850 bytes    │
├──────────────┴──────────────┴──────────────────┤
│                                                 │
│  Chunks Per File (Bar Chart)                   │
│  ██████████████ README.md (500)                │
│  ████████ WORKFLOW.md (300)                    │
│  ████ config.yaml (150)                        │
│                                                 │
├────────────────────┬────────────────────────────┤
│  File Size Dist.   │  File Summary Table       │
│  (Pie Chart)       │                           │
│                    │  File     | Chunks | Size │
│   ● README 60%     │  README   |   50   | 28KB│
│   ● WORKFLOW 30%   │  WORKFLOW |   30   | 15KB│
│   ● Config 10%     │  Config   |   10   | 5KB │
└────────────────────┴────────────────────────────┘
```

#### Step 4: Add Auto-Refresh

1. Top-right → Click **clock icon**
2. Select **30 seconds**

#### Step 5: Save Dashboard

1. Click **Save**
2. Name: "File Processing Monitor"
3. ✅ **Store time with dashboard**

---

## 🎯 Common Use Cases

### Use Case 1: Find Where Text Appears

**Goal:** Find all chunks containing "kubernetes"

**In Discover:**
```kql
content: "kubernetes"
```

**In Dev Tools:**
```json
GET file-chunks/_search
{
  "query": {
    "match": {
      "content": "kubernetes"
    }
  },
  "highlight": {
    "fields": {
      "content": {}
    }
  }
}
```

**Result:** Shows all chunks with highlighting

---

### Use Case 2: Verify File Upload

**Goal:** Check if file was processed correctly

**Steps:**
1. Get fileId from upload response:
   ```json
   {"fileId": "abc-123-def", ...}
   ```

2. In Discover, search:
   ```kql
   fileId: "abc-123-def"
   ```

3. Check:
   - ✅ Chunks are sequential (0, 1, 2...)
   - ✅ Total size matches original
   - ✅ Content is readable

---

### Use Case 3: Find Large Files

**Goal:** Identify files taking most storage

**Dev Tools:**
```json
GET file-chunks/_search
{
  "size": 0,
  "aggs": {
    "large_files": {
      "terms": {
        "field": "metadata.fileName.keyword",
        "size": 10,
        "order": {
          "total_size": "desc"
        }
      },
      "aggs": {
        "total_size": {
          "max": {
            "field": "metadata.fileSize"
          }
        }
      }
    }
  }
}
```

---

### Use Case 4: Search Multiple Terms

**Goal:** Find documents with terraform AND kubernetes

**Discover:**
```kql
content: "terraform" AND content: "kubernetes"
```

**Dev Tools:**
```json
GET file-chunks/_search
{
  "query": {
    "bool": {
      "must": [
        { "match": { "content": "terraform" } },
        { "match": { "content": "kubernetes" } }
      ]
    }
  }
}
```

---

### Use Case 5: Reconstruct Original File

**Goal:** Get all chunks of a file in order

**Dev Tools:**
```json
GET file-chunks/_search
{
  "query": {
    "term": {
      "fileId": "your-file-id"
    }
  },
  "sort": [
    { "chunkIndex": "asc" }
  ],
  "size": 1000,
  "_source": ["content", "chunkIndex"]
}
```

**Process:**
1. Get all chunks sorted by chunkIndex
2. Concatenate `content` fields
3. Result = original file

---

### Use Case 6: Performance Analysis

**Goal:** Check indexing performance

**Dev Tools:**
```json
GET file-chunks/_search
{
  "size": 0,
  "aggs": {
    "processing_time": {
      "date_histogram": {
        "field": "@timestamp",
        "calendar_interval": "hour"
      },
      "aggs": {
        "chunk_count": {
          "value_count": {
            "field": "fileId"
          }
        }
      }
    }
  }
}
```

---

## 🐛 Troubleshooting

### Issue 1: No Data in Discover

**Symptom:** Discover shows "No results found"

**Solutions:**

1. **Check Time Range**
   - Expand to "Last 7 days"
   - Or use "Last 30 days"

2. **Verify Index**
   ```json
   GET file-chunks/_count
   ```
   - If count = 0: No data indexed
   - Upload files first

3. **Refresh Data View**
   - Management → Data Views
   - Select `file-chunks`
   - Click **Refresh field list** (top-right)

---

### Issue 2: Field Not Searchable

**Symptom:** Cannot search on specific field

**Solution:**

1. Check field type:
   ```json
   GET file-chunks/_mapping
   ```

2. For text search, field should be `type: "text"`
3. For exact match, use `.keyword` suffix:
   ```kql
   metadata.fileName.keyword: "README.md"
   ```

---

### Issue 3: Slow Searches

**Symptom:** Queries take > 5 seconds

**Solutions:**

1. **Add size limit:**
   ```json
   GET file-chunks/_search
   {
     "size": 10,  // Limit results
     "query": {...}
   }
   ```

2. **Use filters instead of queries:**
   ```json
   {
     "query": {
       "bool": {
         "filter": [
           { "term": { "fileId": "abc-123" } }
         ]
       }
     }
   }
   ```

3. **Check index stats:**
   ```json
   GET file-chunks/_stats
   ```

---

### Issue 4: Cannot Create Visualization

**Symptom:** Error when creating chart

**Solution:**

1. **Ensure data view exists**
   - Management → Data Views
   - Should see `file-chunks`

2. **Refresh field list**
   - Click refresh icon

3. **Check field mappings**
   - Some aggregations need specific field types
   - Use `.keyword` for terms aggregation

---

### Issue 5: Dashboard Not Updating

**Symptom:** Dashboard shows old data

**Solutions:**

1. **Manual refresh**
   - Click **Refresh** button (top-right)

2. **Enable auto-refresh**
   - Click clock icon
   - Select interval (e.g., 30 seconds)

3. **Clear cache**
   - Refresh browser: Ctrl+F5

---

## 💡 Pro Tips

### 1. Save Frequent Searches

In Discover:
1. Create your search query
2. Click **Save** (top menu)
3. Name it (e.g., "Terraform Files")
4. Reuse anytime from saved searches

### 2. Use Filters Over Queries

Filters are faster:
```
✅ Filter: fileId is "abc-123"
❌ Query: fileId: "abc-123"
```

### 3. Pin Important Filters

1. Create filter
2. Click **pin icon**
3. Filter persists across navigation

### 4. Export Data

1. In Discover, search for data
2. Top menu → **Share**
3. **CSV Reports** → Generate CSV
4. Download results

### 5. Use Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Run query (Dev Tools) | Ctrl + Enter |
| Auto-complete | Ctrl + Space |
| Format query | Ctrl + I |
| Focus search | / |

### 6. Create Index Pattern Aliases

For easier queries:
```json
POST _aliases
{
  "actions": [
    {
      "add": {
        "index": "file-chunks",
        "alias": "files"
      }
    }
  ]
}
```

Now query `files` instead of `file-chunks`

---

## 📊 Monitoring Checklist

### Daily Checks

- [ ] Total chunks count increasing?
- [ ] Any failed uploads? (check for errors)
- [ ] Search response times < 1 second?
- [ ] Disk space sufficient?

### Weekly Review

- [ ] Top uploaded files (by size)
- [ ] Most searched terms
- [ ] Average chunk size trends
- [ ] Index size growth rate

### Monthly Analysis

- [ ] Index optimization needed?
- [ ] Cleanup old files?
- [ ] Adjust chunk size?
- [ ] Review search patterns

---

## 🔗 Quick Links

- **Kibana**: http://localhost:5601
- **Elasticsearch**: http://localhost:9200
- **API**: http://localhost:3000
- **Full Docs**: [README.md](./README.md)

---

## 📚 Additional Resources

### Kibana Documentation
- [Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/8.11/query-dsl.html)
- [KQL Syntax](https://www.elastic.co/guide/en/kibana/8.11/kuery-query.html)
- [Visualizations](https://www.elastic.co/guide/en/kibana/8.11/dashboard.html)

### Your System Docs
- [WORKFLOW.md](./WORKFLOW.md) - Complete workflow
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [QUICKSTART.md](./QUICKSTART.md) - Setup guide

---

**Created:** January 25, 2026  
**Version:** 1.0  
**Kibana Version:** 8.11.0  
**Index:** file-chunks  

---

*Happy exploring your file chunks! 🔍*
