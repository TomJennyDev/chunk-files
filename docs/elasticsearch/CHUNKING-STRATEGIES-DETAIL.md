# Chiến Thuật Chunking - Chi Tiết Implementation

> **Chunking** là kỹ thuật chia nhỏ documents thành các phần (chunks) để tối ưu indexing, search và retrieval trong Elasticsearch và RAG systems.

---

## 📋 Mục Lục

1. [Chunking là gì?](#chunking-là-gì)
2. [Tại sao cần Chunking?](#tại-sao-cần-chunking)
3. [Chunking Strategies](#chunking-strategies)
4. [Fixed-Size Chunking](#fixed-size-chunking)
5. [Semantic Chunking](#semantic-chunking)
6. [Recursive Chunking](#recursive-chunking)
7. [Sentence-Based Chunking](#sentence-based-chunking)
8. [Document-Aware Chunking](#document-aware-chunking)
9. [Overlap Strategies](#overlap-strategies)
10. [Metadata Preservation](#metadata-preservation)
11. [Performance Considerations](#performance-considerations)
12. [Best Practices](#best-practices)

---

## 🧩 Chunking là gì?

**Chunking** = Chia document lớn thành các phần nhỏ hơn (chunks) để:
- Fit vào token limits của LLMs
- Improve search relevance
- Reduce processing time
- Better context management

### Visual Example:

```
BEFORE Chunking:
┌─────────────────────────────────────────┐
│  Large Document (10,000 words)         │
│  - Chapter 1: Introduction             │
│  - Chapter 2: Technical Details        │
│  - Chapter 3: Implementation           │
│  - Chapter 4: Conclusion               │
└─────────────────────────────────────────┘
❌ Too large for single query
❌ Mixed topics reduce relevance
❌ Exceeds token limits

AFTER Chunking:
┌──────────────────┐  ┌──────────────────┐
│ Chunk 1          │  │ Chunk 2          │
│ Chapter 1 (500w) │  │ Chapter 2 (500w) │
└──────────────────┘  └──────────────────┘
┌──────────────────┐  ┌──────────────────┐
│ Chunk 3          │  │ Chunk 4          │
│ Chapter 3 (500w) │  │ Chapter 4 (500w) │
└──────────────────┘  └──────────────────┘
✅ Fits in context window
✅ Focused topics
✅ Better search relevance
```

---

## 🤔 Tại sao cần Chunking?

### Problem 1: **Token Limits**

```
LLM Context Windows:
- GPT-3.5: 4,096 tokens (~3,000 words)
- GPT-4: 8,192 tokens (~6,000 words)
- GPT-4-32k: 32,768 tokens (~24,000 words)
- Claude: 100,000 tokens (~75,000 words)

Document Size:
- Technical manual: 50,000 words ❌
- Legal contract: 30,000 words ❌
- Research paper: 10,000 words ⚠️
- Blog post: 1,000 words ✅

Solution: Split into manageable chunks!
```

### Problem 2: **Search Precision**

```
WITHOUT Chunking:
Document: "Elasticsearch Guide" (10,000 words)
- Section 1: Installation
- Section 2: Indexing
- Section 3: Queries
- Section 4: Aggregations

Query: "How to install Elasticsearch?"

Result: Entire document (10,000 words)
❌ User must read all to find answer
❌ Irrelevant sections (queries, aggregations)
❌ Poor user experience

WITH Chunking:
Query: "How to install Elasticsearch?"

Result: Chunk 1 - Installation section (500 words)
✅ Precise answer
✅ No irrelevant info
✅ Fast to read
```

### Problem 3: **Cost & Performance**

```
Cost Calculation (GPT-4):
- Input: $0.03 per 1K tokens
- Output: $0.06 per 1K tokens

Without Chunking:
- Send entire 10,000 word doc = 13,333 tokens
- Cost: 13.333 × $0.03 = $0.40 per query
- Latency: 5-10 seconds

With Chunking (500 words per chunk):
- Send relevant chunk = 667 tokens
- Cost: 0.667 × $0.03 = $0.02 per query
- Latency: 1-2 seconds

Savings: 95% cost reduction! ⚡
```

---

## 🎯 Chunking Strategies

### Strategy Comparison:

| Strategy | Pros | Cons | Use Case |
|----------|------|------|----------|
| **Fixed-Size** | Simple, fast, predictable | May break sentences/paragraphs | Generic text, logs |
| **Semantic** | Context-aware, meaningful | Complex, slower | Books, articles |
| **Recursive** | Balanced, hierarchical | Medium complexity | Technical docs |
| **Sentence** | Natural boundaries | Variable size | Conversational |
| **Document-Aware** | Structure-preserving | Format-specific | Structured docs |

---

## 📏 Fixed-Size Chunking

**Strategy:** Split by character/token count

### Implementation:

```python
def fixed_size_chunking(text: str, chunk_size: int = 1000, overlap: int = 200):
    """
    Split text into fixed-size chunks with overlap
    
    Args:
        text: Input text
        chunk_size: Characters per chunk
        overlap: Overlapping characters between chunks
    """
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start += (chunk_size - overlap)
    
    return chunks

# Example:
text = "Lorem ipsum dolor sit amet..." * 100  # Long text
chunks = fixed_size_chunking(text, chunk_size=1000, overlap=200)

print(f"Total chunks: {len(chunks)}")
print(f"Chunk 1 size: {len(chunks[0])}")
print(f"Overlap: {chunks[0][-200:] == chunks[1][:200]}")  # True
```

### Visual:

```
Text: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
chunk_size = 10, overlap = 3

Chunk 1: ABCDEFGHIJ
           ──────┬──  (overlap 3)
Chunk 2:        HIJKLMNOPQ
                   ──────┬── (overlap 3)
Chunk 3:              OPQRSTUVWX
                         ──────┬── (overlap 3)
Chunk 4:                    VWXYZ
```

### Configuration Examples:

```python
# Short chunks (conversational AI)
chunks = fixed_size_chunking(text, chunk_size=500, overlap=100)

# Medium chunks (Q&A systems)
chunks = fixed_size_chunking(text, chunk_size=1000, overlap=200)

# Long chunks (summarization)
chunks = fixed_size_chunking(text, chunk_size=2000, overlap=400)
```

**Pros:**
- ✅ Simple to implement
- ✅ Predictable chunk sizes
- ✅ Fast processing
- ✅ Works with any text

**Cons:**
- ❌ May split sentences mid-way
- ❌ May break paragraphs
- ❌ Ignores semantic boundaries
- ❌ Context may be lost

---

## 🧠 Semantic Chunking

**Strategy:** Split by meaning and context

### Implementation with LangChain:

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import numpy as np

def semantic_chunking(text: str, threshold: float = 0.5):
    """
    Split text based on semantic similarity
    
    Args:
        text: Input text
        threshold: Similarity threshold for splitting
    """
    # 1. Split into sentences
    sentences = text.split('. ')
    
    # 2. Encode sentences
    model = SentenceTransformer('all-MiniLM-L6-v2')
    embeddings = model.encode(sentences)
    
    # 3. Calculate similarity between consecutive sentences
    chunks = []
    current_chunk = [sentences[0]]
    
    for i in range(1, len(sentences)):
        similarity = np.dot(embeddings[i-1], embeddings[i])
        
        if similarity > threshold:
            # Similar -> same chunk
            current_chunk.append(sentences[i])
        else:
            # Different topic -> new chunk
            chunks.append('. '.join(current_chunk))
            current_chunk = [sentences[i]]
    
    # Add last chunk
    if current_chunk:
        chunks.append('. '.join(current_chunk))
    
    return chunks

# Example:
text = """
Elasticsearch is a search engine. It's based on Lucene. 
It provides full-text search capabilities.

Python is a programming language. It's easy to learn.
Python has a large ecosystem of libraries.
"""

chunks = semantic_chunking(text, threshold=0.5)
# Result:
# Chunk 1: "Elasticsearch is a search engine. It's based on..."
# Chunk 2: "Python is a programming language. It's easy..."
```

### Advanced Semantic Chunking:

```python
from langchain.text_splitter import SemanticChunker
from langchain.embeddings import OpenAIEmbeddings

# Using LangChain's semantic chunker
text_splitter = SemanticChunker(
    OpenAIEmbeddings(),
    breakpoint_threshold_type="percentile",  # or "standard_deviation", "interquartile"
    breakpoint_threshold_amount=95  # Top 5% dissimilar = break point
)

chunks = text_splitter.split_text(text)
```

**Pros:**
- ✅ Preserves semantic meaning
- ✅ Natural topic boundaries
- ✅ Better context for LLMs
- ✅ Improved retrieval accuracy

**Cons:**
- ❌ Computationally expensive (embeddings)
- ❌ Variable chunk sizes
- ❌ Requires ML models
- ❌ Slower processing

---

## 🔄 Recursive Chunking

**Strategy:** Hierarchical splitting with fallback

### Implementation:

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

def recursive_chunking(text: str, chunk_size: int = 1000, chunk_overlap: int = 200):
    """
    Recursively split by separators in order of preference:
    1. Double newlines (paragraphs)
    2. Single newlines
    3. Spaces
    4. Characters (last resort)
    """
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=[
            "\n\n",  # Paragraph breaks
            "\n",    # Line breaks
            " ",     # Spaces
            ""       # Characters (fallback)
        ],
        length_function=len,
    )
    
    chunks = text_splitter.split_text(text)
    return chunks

# Example:
text = """
# Chapter 1: Introduction

This is the first paragraph.
It has multiple sentences.

This is the second paragraph.
It's on a new line.

# Chapter 2: Details

More content here.
"""

chunks = recursive_chunking(text, chunk_size=100, chunk_overlap=20)
# Splits at paragraph boundaries first, then lines, then spaces
```

### Separator Priority:

```
Priority 1: \n\n (Paragraphs)
┌─────────────────────────┐
│ Paragraph 1             │
│ ...                     │
└─────────────────────────┘
                           ← Split here!
┌─────────────────────────┐
│ Paragraph 2             │
│ ...                     │
└─────────────────────────┘

Priority 2: \n (Lines)
If paragraph too big:
┌─────────────────────────┐
│ Line 1                  │
│ Line 2                  │ ← Split here!
│ Line 3                  │
└─────────────────────────┘

Priority 3: " " (Spaces)
If line too big:
"This is a very long line..." 
      ↑ Split at word boundary

Priority 4: "" (Characters)
If word too big:
"SupercalifragilisticexpialidociousWord"
                    ↑ Split anywhere
```

**Pros:**
- ✅ Respects natural structure
- ✅ Fallback mechanism
- ✅ Balanced chunk sizes
- ✅ Good for technical docs

**Cons:**
- ❌ May still break context
- ❌ Complex logic
- ❌ Requires tuning

---

## 📝 Sentence-Based Chunking

**Strategy:** Split by sentence boundaries

### Implementation:

```python
import nltk
from nltk.tokenize import sent_tokenize

nltk.download('punkt')

def sentence_chunking(text: str, sentences_per_chunk: int = 5, overlap_sentences: int = 1):
    """
    Split text into chunks of N sentences
    
    Args:
        text: Input text
        sentences_per_chunk: Number of sentences per chunk
        overlap_sentences: Overlapping sentences
    """
    # Split into sentences
    sentences = sent_tokenize(text)
    
    chunks = []
    i = 0
    
    while i < len(sentences):
        # Take N sentences
        chunk_sentences = sentences[i:i + sentences_per_chunk]
        chunk = ' '.join(chunk_sentences)
        chunks.append(chunk)
        
        # Move forward (with overlap)
        i += (sentences_per_chunk - overlap_sentences)
    
    return chunks

# Example:
text = """
Elasticsearch is a search engine. It's built on Apache Lucene. 
It provides distributed search. It's horizontally scalable.
It supports full-text search. It has a REST API.
"""

chunks = sentence_chunking(text, sentences_per_chunk=3, overlap_sentences=1)
# Chunk 1: "Elasticsearch is... It's built on... It provides..."
# Chunk 2: "It provides... It's horizontally... It supports..."
```

### With spaCy (Better Sentence Detection):

```python
import spacy

nlp = spacy.load("en_core_web_sm")

def advanced_sentence_chunking(text: str, sentences_per_chunk: int = 5):
    doc = nlp(text)
    sentences = [sent.text for sent in doc.sents]
    
    chunks = []
    for i in range(0, len(sentences), sentences_per_chunk):
        chunk = ' '.join(sentences[i:i + sentences_per_chunk])
        chunks.append(chunk)
    
    return chunks
```

**Pros:**
- ✅ Natural language boundaries
- ✅ Complete thoughts preserved
- ✅ Better readability
- ✅ Good for conversational AI

**Cons:**
- ❌ Variable chunk sizes
- ❌ May be too small for context
- ❌ Requires NLP library

---

## 📄 Document-Aware Chunking

**Strategy:** Split based on document structure (Markdown, HTML, PDF)

### Markdown Chunking:

```python
from langchain.text_splitter import MarkdownHeaderTextSplitter

def markdown_chunking(text: str):
    """
    Split by markdown headers
    """
    headers_to_split_on = [
        ("#", "Header 1"),
        ("##", "Header 2"),
        ("###", "Header 3"),
    ]
    
    markdown_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=headers_to_split_on
    )
    
    chunks = markdown_splitter.split_text(text)
    return chunks

# Example:
text = """
# Chapter 1: Introduction

This is the introduction section.

## Section 1.1: Overview

Details about the overview.

## Section 1.2: Goals

Project goals listed here.

# Chapter 2: Implementation

Implementation details.
"""

chunks = markdown_chunking(text)
# Each section becomes a separate chunk with metadata
```

### HTML Chunking:

```python
from langchain.document_loaders import UnstructuredHTMLLoader
from bs4 import BeautifulSoup

def html_chunking(html: str):
    """
    Split HTML by semantic tags
    """
    soup = BeautifulSoup(html, 'html.parser')
    
    chunks = []
    
    # Extract by sections
    for section in soup.find_all(['section', 'article', 'div']):
        text = section.get_text(strip=True)
        if len(text) > 100:  # Minimum size
            chunks.append({
                'text': text,
                'tag': section.name,
                'class': section.get('class', [])
            })
    
    return chunks
```

### PDF Chunking by Pages:

```python
import PyPDF2

def pdf_chunking(pdf_path: str, pages_per_chunk: int = 5):
    """
    Split PDF by page groups
    """
    reader = PyPDF2.PdfReader(pdf_path)
    chunks = []
    
    for i in range(0, len(reader.pages), pages_per_chunk):
        chunk_pages = []
        for j in range(i, min(i + pages_per_chunk, len(reader.pages))):
            page = reader.pages[j]
            chunk_pages.append(page.extract_text())
        
        chunk = '\n\n'.join(chunk_pages)
        chunks.append({
            'text': chunk,
            'pages': f"{i+1}-{min(i+pages_per_chunk, len(reader.pages))}"
        })
    
    return chunks
```

**Pros:**
- ✅ Preserves document structure
- ✅ Maintains formatting context
- ✅ Metadata-rich chunks
- ✅ Format-specific optimization

**Cons:**
- ❌ Format-dependent code
- ❌ Complex parsing
- ❌ May not work for all formats

---

## 🔗 Overlap Strategies

**Why Overlap?** Prevent context loss at chunk boundaries

### Overlap Visualization:

```
WITHOUT Overlap:
Chunk 1: "...the cat sat on"
Chunk 2: "the mat. It was..."
         ❌ Lost connection!

WITH Overlap (3 words):
Chunk 1: "...the cat sat on the mat"
Chunk 2: "on the mat. It was happy"
         ✅ Context preserved!
```

### Optimal Overlap:

```python
# Rule of thumb:
# Overlap = 10-20% of chunk_size

chunk_size = 1000
overlap = 200  # 20%

# For sentences:
sentences_per_chunk = 5
overlap_sentences = 1  # 20%

# For paragraphs:
paragraphs_per_chunk = 3
overlap_paragraphs = 1  # 33%
```

### Sliding Window:

```python
def sliding_window_chunking(text: str, window_size: int = 1000, step_size: int = 800):
    """
    Sliding window = Fixed overlap
    overlap = window_size - step_size
    """
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + window_size
        chunks.append(text[start:end])
        start += step_size  # Move forward
    
    return chunks

# Example:
overlap = window_size - step_size  # 1000 - 800 = 200 (20% overlap)
```

---

## 📊 Metadata Preservation

**Metadata** helps maintain context across chunks:

```python
def chunk_with_metadata(document: dict, chunk_size: int = 1000):
    """
    Preserve metadata with each chunk
    """
    text = document['text']
    chunks_data = []
    
    # Split text
    chunks = fixed_size_chunking(text, chunk_size)
    
    # Add metadata to each chunk
    for i, chunk in enumerate(chunks):
        chunk_data = {
            'text': chunk,
            'chunk_id': i,
            'total_chunks': len(chunks),
            'source': document.get('source', 'unknown'),
            'author': document.get('author', 'unknown'),
            'date': document.get('date', None),
            'title': document.get('title', 'untitled'),
            'section': infer_section(chunk),  # Custom function
            'page_number': calculate_page(i, chunk_size)  # Estimate
        }
        chunks_data.append(chunk_data)
    
    return chunks_data

# Example output:
{
    'text': 'Chapter 1: Introduction...',
    'chunk_id': 0,
    'total_chunks': 20,
    'source': 'elasticsearch_guide.pdf',
    'author': 'John Doe',
    'date': '2026-01-31',
    'title': 'Elasticsearch Complete Guide',
    'section': 'Introduction',
    'page_number': 1
}
```

### Elasticsearch Index Mapping:

```json
PUT /documents
{
  "mappings": {
    "properties": {
      "text": {"type": "text"},
      "chunk_id": {"type": "integer"},
      "total_chunks": {"type": "integer"},
      "source": {"type": "keyword"},
      "author": {"type": "keyword"},
      "date": {"type": "date"},
      "title": {"type": "text"},
      "section": {"type": "keyword"},
      "page_number": {"type": "integer"},
      "embeddings": {
        "type": "dense_vector",
        "dims": 768
      }
    }
  }
}
```

---

## ⚡ Performance Considerations

### Chunk Size Impact:

| Chunk Size | Pros | Cons | Use Case |
|------------|------|------|----------|
| **Small** (200-500 words) | Fast retrieval, precise | More chunks, more overhead | Q&A, search |
| **Medium** (500-1000 words) | Balanced | General purpose | Most applications |
| **Large** (1000-2000 words) | Less overhead, more context | Slower, less precise | Summarization |

### Processing Time:

```python
import time

text = "..." * 10000  # Large text

# Benchmark different strategies
strategies = {
    'Fixed': lambda: fixed_size_chunking(text, 1000),
    'Recursive': lambda: recursive_chunking(text, 1000),
    'Semantic': lambda: semantic_chunking(text, 0.5),
    'Sentence': lambda: sentence_chunking(text, 5)
}

for name, func in strategies.items():
    start = time.time()
    chunks = func()
    elapsed = time.time() - start
    print(f"{name}: {len(chunks)} chunks in {elapsed:.3f}s")

# Results (approximate):
# Fixed: 100 chunks in 0.001s ⚡
# Recursive: 98 chunks in 0.005s
# Sentence: 95 chunks in 0.050s
# Semantic: 92 chunks in 2.500s 🐌
```

### Memory Usage:

```python
import sys

# Memory-efficient streaming chunking
def streaming_chunking(file_path: str, chunk_size: int = 1000):
    """
    Process large files without loading entire content
    """
    with open(file_path, 'r') as f:
        buffer = ""
        
        while True:
            # Read in batches
            batch = f.read(chunk_size * 2)
            if not batch:
                break
            
            buffer += batch
            
            # Yield chunks
            while len(buffer) >= chunk_size:
                yield buffer[:chunk_size]
                buffer = buffer[chunk_size - 200:]  # Keep overlap
        
        # Yield remaining
        if buffer:
            yield buffer
```

---

## 💡 Best Practices

### ✅ DO:

#### 1. **Choose strategy based on content type**
```python
# Code/logs: Fixed-size
code_chunks = fixed_size_chunking(code, 500)

# Books/articles: Semantic
article_chunks = semantic_chunking(article, 0.6)

# Technical docs: Recursive
docs_chunks = recursive_chunking(docs, 1000)

# Conversations: Sentence-based
chat_chunks = sentence_chunking(chat, 5)
```

#### 2. **Always use overlap**
```python
✅ chunk_size=1000, overlap=200  # 20%
❌ chunk_size=1000, overlap=0    # No context
```

#### 3. **Preserve metadata**
```python
chunk_data = {
    'text': chunk,
    'source': doc_id,
    'chunk_id': i,
    'parent_id': parent_doc_id
}
```

#### 4. **Test chunk sizes for your use case**
```python
# Test different sizes
for size in [500, 1000, 1500, 2000]:
    test_retrieval_accuracy(chunk_size=size)
```

### ❌ DON'T:

#### 1. **Don't use one-size-fits-all**
```python
❌ Always chunk_size=1000 for everything
✅ Adapt based on content and use case
```

#### 2. **Don't ignore document structure**
```python
❌ Split markdown without considering headers
✅ Use document-aware chunking for structured docs
```

#### 3. **Don't lose context**
```python
❌ No overlap between chunks
✅ 10-20% overlap to preserve context
```

---

## 📚 Summary

**Key Takeaways:**

1. ✅ **Chunking** splits large documents into manageable pieces
2. ✅ **Fixed-size** = Simple, fast, predictable
3. ✅ **Semantic** = Context-aware, accurate (slower)
4. ✅ **Recursive** = Balanced, hierarchical splitting
5. ✅ **Sentence-based** = Natural boundaries
6. ✅ **Document-aware** = Structure-preserving
7. ✅ **Overlap** = 10-20% to preserve context
8. ✅ **Metadata** = Essential for tracking and retrieval
9. ⚠️ Choose strategy based on content type
10. ⚠️ Test and tune for your specific use case

**Decision Tree:**

```
Need chunking?
└─ Yes
   ├─ Simple text/logs? → Fixed-size
   ├─ Books/articles? → Semantic
   ├─ Technical docs? → Recursive
   ├─ Conversations? → Sentence-based
   └─ Structured docs? → Document-aware
```

---

*Cập nhật: 1 Tháng 2, 2026*
