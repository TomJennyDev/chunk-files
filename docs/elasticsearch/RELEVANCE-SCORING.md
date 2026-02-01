# Elasticsearch Relevance Scoring - Hướng Dẫn Chi Tiết

> **Relevance Scoring** xác định mức độ liên quan của documents với search query, quyết định thứ tự kết quả.

---

## 📋 Mục Lục

1. [Scoring là gì?](#scoring-là-gì)
2. [TF-IDF Algorithm](#tf-idf-algorithm)
3. [BM25 Algorithm](#bm25-algorithm)
4. [Score Calculation](#score-calculation)
5. [Boosting](#boosting)
6. [Function Score Query](#function-score-query)
7. [Explain API](#explain-api)
8. [Best Practices](#best-practices)

---

## 🎯 Scoring là gì?

**Relevance Score** (`_score`) = số từ 0 đến vô cực, càng cao càng liên quan

```bash
GET /articles/_search
{
  "query": {
    "match": {"title": "elasticsearch guide"}
  }
}
```

**Response:**
```json
{
  "hits": {
    "hits": [
      {
        "_score": 4.567,
        "_source": {"title": "Ultimate Elasticsearch Guide"}
      },
      {
        "_score": 2.123,
        "_source": {"title": "Elasticsearch Basics"}
      },
      {
        "_score": 0.987,
        "_source": {"title": "Getting Started"}
      }
    ]
  }
}
```

**Factors affecting score:**
- **Term Frequency (TF)**: Từ xuất hiện bao nhiêu lần trong document?
- **Inverse Document Frequency (IDF)**: Từ hiếm hay phổ biến trong toàn bộ index?
- **Field Length**: Document ngắn hay dài?
- **Boosting**: Manual importance adjustment

---

## 📊 TF-IDF Algorithm

**TF-IDF** (Term Frequency - Inverse Document Frequency) - Thuật toán cũ (trước ES 5.0)

### Formula:

```
score = TF × IDF × norm

Where:
- TF = √(term frequency)
- IDF = 1 + ln(total docs / docs with term)
- norm = 1 / √(field length)
```

### Example:

```
Index: 1000 documents
Query: "elasticsearch"

Document A:
- Content: "elasticsearch elasticsearch guide" (3 words)
- "elasticsearch" appears 2 times
- 50 documents contain "elasticsearch"

TF = √2 = 1.41
IDF = 1 + ln(1000/50) = 1 + ln(20) = 1 + 2.996 = 3.996
norm = 1 / √3 = 0.577

score = 1.41 × 3.996 × 0.577 = 3.25
```

**TF-IDF Logic:**
- ✅ Frequent in document → Higher score (TF)
- ✅ Rare across index → Higher score (IDF)
- ✅ Shorter document → Higher score (norm)

---

## 🚀 BM25 Algorithm

**BM25** (Best Matching 25) - Default since ES 5.0, better than TF-IDF

### Formula:

```
score = IDF × (TF × (k1 + 1)) / (TF + k1 × (1 - b + b × (field_length / avg_field_length)))

Where:
- k1 = 1.2 (term frequency saturation)
- b = 0.75 (length normalization)
```

### Why BM25 > TF-IDF?

```
Problem with TF-IDF:
Document A: "elasticsearch" × 10 times → score = 10
Document B: "elasticsearch" × 100 times → score = 100

Problem: Spamming keywords increases score infinitely!

BM25 Solution:
Document A: "elasticsearch" × 10 times → score = 2.5
Document B: "elasticsearch" × 100 times → score = 2.7

BM25 saturates! Diminishing returns after certain point ✅
```

### Visual Comparison:

```
Score Growth (TF-IDF vs BM25):

TF-IDF:
Score │     ╱
      │    ╱
      │   ╱
      │  ╱
      │ ╱
      └──────────── Term Frequency
      Linear growth → Can be gamed!

BM25:
Score │  ╭──────
      │ ╱
      │╱
      │
      │
      └──────────── Term Frequency
      Saturation → Cannot spam keywords!
```

### BM25 Parameters:

```bash
PUT /articles
{
  "settings": {
    "index": {
      "similarity": {
        "my_bm25": {
          "type": "BM25",
          "k1": 1.2,  # Higher = more impact of TF
          "b": 0.75   # Higher = more length normalization
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "content": {
        "type": "text",
        "similarity": "my_bm25"
      }
    }
  }
}
```

**k1 (Term Frequency Saturation):**
- `k1 = 0`: Ignore term frequency (binary)
- `k1 = 1.2`: Default (good balance)
- `k1 = 3`: More weight to term frequency

**b (Length Normalization):**
- `b = 0`: Ignore document length
- `b = 0.75`: Default (good balance)
- `b = 1`: Full length normalization

---

## 🔍 Score Calculation

### Match Query Example:

```bash
GET /articles/_search
{
  "query": {
    "match": {"title": "elasticsearch guide"}
  }
}

# Internal process:
# 1. Analyze query: ["elasticsearch", "guide"]
# 2. For each document:
#    - Calculate score for "elasticsearch"
#    - Calculate score for "guide"
#    - Combine scores (sum by default)
# 3. Sort by total score
```

### Bool Query Score:

```bash
GET /articles/_search
{
  "query": {
    "bool": {
      "must": [
        {"match": {"title": "elasticsearch"}}  # Score included
      ],
      "should": [
        {"match": {"tags": "guide"}}  # Boosts score if matches
      ],
      "filter": [
        {"term": {"status": "published"}}  # NO score (faster)
      ]
    }
  }
}

# Score = must_score + should_score
# filter = no impact on score (just filtering)
```

**Query Context vs Filter Context:**

| Context | Scoring | Caching | Use For |
|---------|---------|---------|---------|
| **Query** | ✅ Yes | ❌ No | Relevance search |
| **Filter** | ❌ No | ✅ Yes | Exact match, dates |

---

## 📈 Boosting

**Boosting** = manually increase/decrease field or term importance

### Field Boosting:

```bash
GET /articles/_search
{
  "query": {
    "multi_match": {
      "query": "elasticsearch",
      "fields": [
        "title^3",    # 3× more important
        "content^1",  # Normal importance
        "tags^2"      # 2× more important
      ]
    }
  }
}

# Score calculation:
# - Match in title: score × 3
# - Match in content: score × 1
# - Match in tags: score × 2
```

### Term Boosting:

```bash
GET /articles/_search
{
  "query": {
    "bool": {
      "should": [
        {"match": {"title": "elasticsearch"}},
        {"match": {"title": {"query": "guide", "boost": 2}}}
      ]
    }
  }
}

# "guide" has 2× weight compared to "elasticsearch"
```

### Negative Boosting:

```bash
GET /articles/_search
{
  "query": {
    "boosting": {
      "positive": {
        "match": {"content": "elasticsearch"}
      },
      "negative": {
        "match": {"content": "deprecated"}
      },
      "negative_boost": 0.2  # Reduce score by 80% if contains "deprecated"
    }
  }
}
```

---

## ⚙️ Function Score Query

**Function Score** = custom scoring logic beyond text relevance

### Decay Function (Distance-based):

```bash
GET /hotels/_search
{
  "query": {
    "function_score": {
      "query": {"match": {"name": "hotel"}},
      "functions": [
        {
          "gauss": {  # Gaussian decay
            "location": {
              "origin": {"lat": 40.7128, "lon": -74.0060},  # NYC
              "scale": "5km",    # Optimal distance
              "offset": "1km",   # No decay within 1km
              "decay": 0.5       # 50% score at 5km away
            }
          }
        }
      ],
      "boost_mode": "multiply"  # Original score × decay
    }
  }
}

# Hotels closer to NYC = higher score
```

### Field Value Factor:

```bash
GET /articles/_search
{
  "query": {
    "function_score": {
      "query": {"match": {"title": "elasticsearch"}},
      "functions": [
        {
          "field_value_factor": {
            "field": "views",  # Use view count
            "factor": 0.1,     # Multiply by 0.1
            "modifier": "log1p"  # log(1 + views)
          }
        }
      ],
      "boost_mode": "sum"  # Original score + calculated value
    }
  }
}

# More views = higher score
# log1p prevents huge view counts from dominating
```

### Script Score:

```bash
GET /products/_search
{
  "query": {
    "function_score": {
      "query": {"match_all": {}},
      "script_score": {
        "script": {
          "source": "_score * Math.log(2 + doc['views'].value)"
        }
      }
    }
  }
}

# Custom formula: original_score × log(2 + views)
```

### Random Score:

```bash
GET /articles/_search
{
  "query": {
    "function_score": {
      "query": {"match_all": {}},
      "random_score": {
        "seed": 12345  # Same seed = same random order
      }
    }
  }
}

# Randomize results (A/B testing, recommendations)
```

---

## 🔬 Explain API

**Explain API** shows HOW score was calculated:

```bash
GET /articles/_explain/1
{
  "query": {
    "match": {"title": "elasticsearch guide"}
  }
}
```

**Response:**
```json
{
  "matched": true,
  "_score": 4.567,
  "explanation": {
    "value": 4.567,
    "description": "sum of:",
    "details": [
      {
        "value": 3.123,
        "description": "weight(title:elasticsearch)",
        "details": [
          {
            "value": 2.0,
            "description": "tf(freq=4.0), with freq of: 4.0"
          },
          {
            "value": 1.561,
            "description": "idf, computed as log(1 + (N - n + 0.5) / (n + 0.5))"
          }
        ]
      },
      {
        "value": 1.444,
        "description": "weight(title:guide)",
        "details": [...]
      }
    ]
  }
}
```

**Use Explain to:**
- ✅ Debug why document ranked low/high
- ✅ Understand scoring logic
- ✅ Optimize queries

---

## 💡 Best Practices

### ✅ DO:

#### 1. **Use filter for exact matches (faster)**
```bash
✅ "filter": [{"term": {"status": "published"}}]
❌ "must": [{"term": {"status": "published"}}]
```

#### 2. **Boost important fields**
```bash
GET /_search
{
  "query": {
    "multi_match": {
      "query": "search term",
      "fields": ["title^3", "content^1"]
    }
  }
}
```

#### 3. **Use function_score for business logic**
```bash
# Combine relevance + popularity + recency
{
  "function_score": {
    "query": {...},
    "functions": [
      {"field_value_factor": {"field": "views"}},
      {"gauss": {"created_at": {"origin": "now", "scale": "30d"}}}
    ]
  }
}
```

#### 4. **Test with explain API**
```bash
GET /index/_explain/doc_id
{
  "query": {...}
}
```

### ❌ DON'T:

#### 1. **Don't rely only on text relevance**
```bash
❌ Pure text matching without business logic
✅ Combine text relevance + popularity + recency + location
```

#### 2. **Don't boost too aggressively**
```bash
❌ "title^100"  # Dominates everything
✅ "title^3"    # Reasonable boost
```

#### 3. **Don't ignore filter context**
```bash
❌ "must": [{"term": {"status": "published"}}]  # Slower, unnecessary scoring
✅ "filter": [{"term": {"status": "published"}}]  # Faster, cached
```

---

## 📚 Summary

**Key Takeaways:**

1. ✅ **BM25** = Default algorithm (better than TF-IDF)
2. ✅ **_score** = Relevance from 0 to ∞
3. ✅ **Boosting** = Adjust field/term importance
4. ✅ **function_score** = Custom business logic
5. ✅ **filter** = No scoring (faster)
6. ✅ **Explain API** = Debug scores
7. ⚠️ Combine text relevance + business metrics
8. ⚠️ Test and tune for your use case

**Scoring Hierarchy:**
```
Text Relevance (BM25)
  + Field Boosting
  + Function Score (views, recency, location)
  + Business Logic
  = Final Score
```

---

*Cập nhật: 31 Tháng 1, 2026*
