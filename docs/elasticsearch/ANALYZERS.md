# Elasticsearch Analyzers - Hướng Dẫn Chi Tiết

> **Analyzers** xử lý text trước khi indexing và searching, quyết định cách Elasticsearch hiểu và match text.

---

## 📋 Mục Lục

1. [Analyzer là gì?](#analyzer-là-gì)
2. [Analysis Process](#analysis-process)
3. [Built-in Analyzers](#built-in-analyzers)
4. [Custom Analyzers](#custom-analyzers)
5. [Character Filters](#character-filters)
6. [Tokenizers](#tokenizers)
7. [Token Filters](#token-filters)
8. [Language Analyzers](#language-analyzers)
9. [Testing Analyzers](#testing-analyzers)
10. [Best Practices](#best-practices)

---

## 🔍 Analyzer là gì?

**Analyzer** = một pipeline xử lý text thành tokens:

```
Input Text: "The QUICK Brown Fox jumped!"

      ↓ [ANALYZER]
      
┌─────────────────────────┐
│ 1. Character Filters    │  Remove HTML, normalize chars
│    "The QUICK Brown..." │
└─────────────────────────┘
      ↓
┌─────────────────────────┐
│ 2. Tokenizer           │  Split into tokens
│    ["The", "QUICK",... ]│
└─────────────────────────┘
      ↓
┌─────────────────────────┐
│ 3. Token Filters       │  Lowercase, remove stop words
│    ["quick", "brown",...]│
└─────────────────────────┘
      ↓
Final Tokens: ["quick", "brown", "fox", "jumped"]
```

**Analyzers used for:**
- **Indexing**: Process text before storing in inverted index
- **Searching**: Process search query to match indexed terms

---

## ⚙️ Analysis Process

### Full Analysis Pipeline

```bash
# Test analyzer
GET /_analyze
{
  "analyzer": "standard",
  "text": "The QUICK Brown Fox jumped over 2 lazy dogs!"
}
```

**Output:**
```json
{
  "tokens": [
    {"token": "quick", "start_offset": 4, "end_offset": 9, "position": 1},
    {"token": "brown", "start_offset": 10, "end_offset": 15, "position": 2},
    {"token": "fox", "start_offset": 16, "end_offset": 19, "position": 3},
    {"token": "jumped", "start_offset": 20, "end_offset": 26, "position": 4},
    {"token": "over", "start_offset": 27, "end_offset": 31, "position": 5},
    {"token": "2", "start_offset": 32, "end_offset": 33, "position": 6},
    {"token": "lazy", "start_offset": 34, "end_offset": 38, "position": 7},
    {"token": "dogs", "start_offset": 39, "end_offset": 43, "position": 8}
  ]
}
```

**Process breakdown:**
1. ❌ "The" → removed (stop word)
2. ✅ "QUICK" → "quick" (lowercase)
3. ✅ "Brown" → "brown" (lowercase)
4. ✅ "Fox" → "fox" (lowercase)
5. ❌ "!" → removed (punctuation)

---

## 📦 Built-in Analyzers

### 1. **standard** (Default)

```bash
POST /_analyze
{
  "analyzer": "standard",
  "text": "The Quick Brown Fox-123!"
}

# Tokens: ["quick", "brown", "fox", "123"]
# - Lowercase
# - Remove punctuation
# - Remove "The" (stop word)
```

**Use for:** General-purpose English text

### 2. **simple**

```bash
POST /_analyze
{
  "analyzer": "simple",
  "text": "The Quick Brown Fox-123!"
}

# Tokens: ["the", "quick", "brown", "fox"]
# - Lowercase
# - Split on NON-letters
# - ❌ Removes numbers!
```

**Use for:** Simple text, no numbers needed

### 3. **whitespace**

```bash
POST /_analyze
{
  "analyzer": "whitespace",
  "text": "The Quick Brown Fox-123!"
}

# Tokens: ["The", "Quick", "Brown", "Fox-123!"]
# - Split ONLY on whitespace
# - Keep case, punctuation, numbers
```

**Use for:** Exact tokens, case-sensitive

### 4. **keyword**

```bash
POST /_analyze
{
  "analyzer": "keyword",
  "text": "The Quick Brown Fox-123!"
}

# Tokens: ["The Quick Brown Fox-123!"]
# - NO tokenization!
# - Entire string as one token
```

**Use for:** Exact match fields (email, ID, status)

### 5. **stop**

```bash
POST /_analyze
{
  "analyzer": "stop",
  "text": "The quick brown fox is here"
}

# Tokens: ["quick", "brown", "fox"]
# - Removes English stop words (the, is, here)
# - Lowercase
```

**Use for:** English text, remove common words

### 6. **pattern**

```bash
PUT /emails
{
  "settings": {
    "analysis": {
      "analyzer": {
        "email_analyzer": {
          "type": "pattern",
          "pattern": "\\W+",  # Split on non-word chars
          "lowercase": true
        }
      }
    }
  }
}

POST /emails/_analyze
{
  "analyzer": "email_analyzer",
  "text": "john.doe@example.com"
}

# Tokens: ["john", "doe", "example", "com"]
```

**Use for:** Custom split patterns (emails, URLs)

---

## 🛠️ Custom Analyzers

### Anatomy of Custom Analyzer

```
Custom Analyzer = Character Filters + Tokenizer + Token Filters
                  (0 or more)       (exactly 1)  (0 or more)
```

### Example: Email Analyzer

```bash
PUT /emails
{
  "settings": {
    "analysis": {
      "analyzer": {
        "my_email_analyzer": {
          "type": "custom",
          "char_filter": ["html_strip"],  # Step 1
          "tokenizer": "standard",        # Step 2
          "filter": ["lowercase", "stop", "snowball"]  # Step 3
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "subject": {
        "type": "text",
        "analyzer": "my_email_analyzer"
      }
    }
  }
}
```

### Example: Custom Stop Words

```bash
PUT /articles
{
  "settings": {
    "analysis": {
      "filter": {
        "my_stop_filter": {
          "type": "stop",
          "stopwords": ["is", "the", "a", "an", "http", "https", "www"]
        }
      },
      "analyzer": {
        "my_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "my_stop_filter"]
        }
      }
    }
  }
}
```

---

## 🔤 Character Filters

**Character Filters** = Pre-process text BEFORE tokenization

### 1. **html_strip**

```bash
POST /_analyze
{
  "char_filter": ["html_strip"],
  "tokenizer": "standard",
  "text": "<p>The <b>Quick</b> Brown Fox</p>"
}

# After char_filter: "The Quick Brown Fox"
# Tokens: ["quick", "brown", "fox"]
```

**Use for:** HTML content, web scraping

### 2. **mapping**

```bash
PUT /products
{
  "settings": {
    "analysis": {
      "char_filter": {
        "emoticon_filter": {
          "type": "mapping",
          "mappings": [
            ":) => happy",
            ":( => sad",
            "<3 => love"
          ]
        }
      },
      "analyzer": {
        "emoticon_analyzer": {
          "char_filter": ["emoticon_filter"],
          "tokenizer": "standard",
          "filter": ["lowercase"]
        }
      }
    }
  }
}

POST /products/_analyze
{
  "analyzer": "emoticon_analyzer",
  "text": "I love this :) <3"
}

# After mapping: "I love this happy love"
# Tokens: ["i", "love", "this", "happy", "love"]
```

**Use for:** Emoticons, special symbols, abbreviations

### 3. **pattern_replace**

```bash
PUT /logs
{
  "settings": {
    "analysis": {
      "char_filter": {
        "remove_digits": {
          "type": "pattern_replace",
          "pattern": "\\d+",  # Match digits
          "replacement": ""   # Remove them
        }
      },
      "analyzer": {
        "no_digits_analyzer": {
          "char_filter": ["remove_digits"],
          "tokenizer": "standard",
          "filter": ["lowercase"]
        }
      }
    }
  }
}

POST /logs/_analyze
{
  "analyzer": "no_digits_analyzer",
  "text": "Error123 occurred at line 456"
}

# After pattern_replace: "Error occurred at line"
# Tokens: ["error", "occurred", "at", "line"]
```

---

## 🔪 Tokenizers

**Tokenizer** = Splits text into tokens (words)

### 1. **standard** (Default)

```bash
POST /_analyze
{
  "tokenizer": "standard",
  "text": "The Quick-Brown Fox's email: test@example.com"
}

# Tokens: ["The", "Quick", "Brown", "Fox's", "email", "test", "example.com"]
# - Splits on whitespace & punctuation
# - Keeps apostrophes in words
# - Keeps email structure
```

### 2. **whitespace**

```bash
POST /_analyze
{
  "tokenizer": "whitespace",
  "text": "The Quick-Brown Fox's"
}

# Tokens: ["The", "Quick-Brown", "Fox's"]
# - Split ONLY on whitespace
# - Keep hyphens, apostrophes
```

### 3. **letter**

```bash
POST /_analyze
{
  "tokenizer": "letter",
  "text": "Quick-Brown123Fox's"
}

# Tokens: ["Quick", "Brown", "Fox", "s"]
# - Split on NON-letters
# - Removes numbers, punctuation
```

### 4. **ngram**

```bash
PUT /autocomplete
{
  "settings": {
    "analysis": {
      "tokenizer": {
        "my_ngram": {
          "type": "ngram",
          "min_gram": 3,
          "max_gram": 4
        }
      },
      "analyzer": {
        "ngram_analyzer": {
          "tokenizer": "my_ngram"
        }
      }
    }
  }
}

POST /autocomplete/_analyze
{
  "analyzer": "ngram_analyzer",
  "text": "Quick"
}

# Tokens: ["Qui", "Quic", "uic", "uick", "ick"]
# - All 3-4 char substrings
```

**Use for:** Autocomplete, partial matching

### 5. **edge_ngram**

```bash
PUT /autocomplete
{
  "settings": {
    "analysis": {
      "tokenizer": {
        "my_edge_ngram": {
          "type": "edge_ngram",
          "min_gram": 2,
          "max_gram": 10
        }
      },
      "analyzer": {
        "autocomplete_analyzer": {
          "tokenizer": "my_edge_ngram",
          "filter": ["lowercase"]
        }
      }
    }
  }
}

POST /autocomplete/_analyze
{
  "analyzer": "autocomplete_analyzer",
  "text": "Quick"
}

# Tokens: ["qu", "qui", "quic", "quick"]
# - Only from START of word
```

**Use for:** Search-as-you-type

### 6. **path_hierarchy**

```bash
POST /_analyze
{
  "tokenizer": "path_hierarchy",
  "text": "/usr/local/bin/elasticsearch"
}

# Tokens:
# ["/usr", "/usr/local", "/usr/local/bin", "/usr/local/bin/elasticsearch"]
```

**Use for:** File paths, URL hierarchies

---

## 🎛️ Token Filters

**Token Filters** = Modify tokens AFTER tokenization

### 1. **lowercase**

```bash
POST /_analyze
{
  "tokenizer": "standard",
  "filter": ["lowercase"],
  "text": "The QUICK Brown FOX"
}

# Tokens: ["the", "quick", "brown", "fox"]
```

### 2. **stop**

```bash
POST /_analyze
{
  "tokenizer": "standard",
  "filter": ["stop"],
  "text": "The quick brown fox is here"
}

# Tokens: ["quick", "brown", "fox"]
# - Removed: "the", "is", "here" (English stop words)
```

### 3. **stemmer** (Snowball)

```bash
POST /_analyze
{
  "tokenizer": "standard",
  "filter": ["lowercase", "snowball"],
  "text": "running runs runner"
}

# Tokens: ["run", "run", "runner"]
# - "running" → "run"
# - "runs" → "run"
# - "runner" → "runner" (different stem)
```

**Use for:** Match different word forms

### 4. **synonym**

```bash
PUT /products
{
  "settings": {
    "analysis": {
      "filter": {
        "my_synonyms": {
          "type": "synonym",
          "synonyms": [
            "laptop, notebook, computer",
            "phone, mobile, cellphone",
            "tv, television"
          ]
        }
      },
      "analyzer": {
        "synonym_analyzer": {
          "tokenizer": "standard",
          "filter": ["lowercase", "my_synonyms"]
        }
      }
    }
  }
}

POST /products/_analyze
{
  "analyzer": "synonym_analyzer",
  "text": "laptop"
}

# Tokens: ["laptop", "notebook", "computer"]
# - All synonyms indexed!
```

### 5. **unique**

```bash
POST /_analyze
{
  "tokenizer": "standard",
  "filter": ["unique"],
  "text": "quick quick brown brown fox"
}

# Tokens: ["quick", "brown", "fox"]
# - Duplicates removed
```

### 6. **length**

```bash
PUT /words
{
  "settings": {
    "analysis": {
      "filter": {
        "length_filter": {
          "type": "length",
          "min": 3,
          "max": 10
        }
      },
      "analyzer": {
        "length_analyzer": {
          "tokenizer": "standard",
          "filter": ["lowercase", "length_filter"]
        }
      }
    }
  }
}

POST /words/_analyze
{
  "analyzer": "length_analyzer",
  "text": "I am a quick brown fox"
}

# Tokens: ["quick", "brown", "fox"]
# - Removed: "i" (too short), "am" (too short), "a" (too short)
```

---

## 🌍 Language Analyzers

Elasticsearch có built-in analyzers cho 30+ languages:

```bash
# English analyzer
POST /_analyze
{
  "analyzer": "english",
  "text": "The dogs are running quickly"
}

# Tokens: ["dog", "run", "quick"]
# - Stop words removed: "the", "are"
# - Stemmed: "dogs" → "dog", "running" → "run", "quickly" → "quick"
```

**Available languages:**
- `arabic`, `armenian`, `basque`, `bengali`, `brazilian`
- `bulgarian`, `catalan`, `cjk`, `czech`, `danish`
- `dutch`, `english`, `estonian`, `finnish`, `french`
- `galician`, `german`, `greek`, `hindi`, `hungarian`
- `indonesian`, `irish`, `italian`, `latvian`, `lithuanian`
- `norwegian`, `persian`, `portuguese`, `romanian`, `russian`
- `spanish`, `swedish`, `thai`, `turkish`

### Custom Language Analyzer

```bash
PUT /articles
{
  "settings": {
    "analysis": {
      "filter": {
        "english_stop": {
          "type": "stop",
          "stopwords": "_english_"
        },
        "english_stemmer": {
          "type": "stemmer",
          "language": "english"
        }
      },
      "analyzer": {
        "my_english": {
          "tokenizer": "standard",
          "filter": [
            "lowercase",
            "english_stop",
            "english_stemmer"
          ]
        }
      }
    }
  }
}
```

---

## 🧪 Testing Analyzers

### Test Built-in Analyzer

```bash
POST /_analyze
{
  "analyzer": "standard",
  "text": "The Quick Brown Fox"
}
```

### Test Custom Analyzer

```bash
POST /my_index/_analyze
{
  "analyzer": "my_custom_analyzer",
  "text": "Test text here"
}
```

### Test Individual Components

```bash
# Test char_filter only
POST /_analyze
{
  "char_filter": ["html_strip"],
  "text": "<p>Hello</p>"
}

# Test tokenizer only
POST /_analyze
{
  "tokenizer": "standard",
  "text": "Quick Brown Fox"
}

# Test filter only
POST /_analyze
{
  "tokenizer": "standard",
  "filter": ["lowercase", "stop"],
  "text": "The Quick Brown Fox"
}
```

---

## 💡 Best Practices

### ✅ DO:

#### 1. **Use same analyzer for index & search**
```bash
PUT /articles
{
  "mappings": {
    "properties": {
      "title": {
        "type": "text",
        "analyzer": "english",  # Index time
        "search_analyzer": "english"  # Search time (same!)
      }
    }
  }
}
```

#### 2. **Test analyzers before production**
```bash
# Always test with sample data
POST /_analyze
{
  "analyzer": "my_analyzer",
  "text": "Sample text"
}
```

#### 3. **Use language-specific analyzers**
```bash
# English content
"analyzer": "english"

# French content
"analyzer": "french"

# Vietnamese content (use ICU plugin)
```

#### 4. **Use synonyms carefully**
```bash
# Put synonyms in file, not inline
"filter": {
  "my_synonyms": {
    "type": "synonym",
    "synonyms_path": "analysis/synonyms.txt"  # External file
  }
}
```

### ❌ DON'T:

#### 1. **Don't use different analyzers for index/search**
```bash
❌ "analyzer": "standard",
   "search_analyzer": "english"  # Mismatch! Won't match correctly
```

#### 2. **Don't over-filter**
```bash
❌ "filter": [
     "lowercase", "stop", "snowball", "unique", "length",
     "porter_stem", "kstem"  # Too many! Slow + loses information
   ]
```

#### 3. **Don't forget case sensitivity**
```bash
❌ "tokenizer": "keyword"  # Case-sensitive!
   
✅ "tokenizer": "keyword",
   "filter": ["lowercase"]  # Better for most cases
```

---

## 📚 Summary

**Key Takeaways:**

1. ✅ **Analyzer** = char_filter + tokenizer + token_filter
2. ✅ **standard** = Good default for English
3. ✅ **Language analyzers** for non-English
4. ✅ **Custom analyzers** for specific needs
5. ✅ **Test analyzers** with `_analyze` API
6. ⚠️ **Same analyzer** for index & search
7. ⚠️ **Synonyms** can increase index size
8. ❌ **Don't over-filter** - loses information

---

*Cập nhật: 31 Tháng 1, 2026*
