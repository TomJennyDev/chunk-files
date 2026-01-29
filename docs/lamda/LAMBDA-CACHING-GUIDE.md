# Tận Dụng Cache trong AWS Lambda

## 📋 Tổng Quan

Lambda có 4 loại cache chính để tăng performance và giảm chi phí:

0. **Deployment Package** (node_modules, Lambda Layers)
1. **Container Reuse** (Global Scope)
2. **In-Memory Cache** (RAM)
3. **/tmp Storage** (Disk Cache)

---

## 📦 0. Deployment Package Optimization

### Khái Niệm
Giảm kích thước deployment package (node_modules) để giảm cold start time.

### Cách Tận Dụng

**Package Size Impact**:
```
5MB package   → 120ms cold start
50MB package  → 350ms cold start  
250MB package → 1500ms cold start ❌
```

**Optimization Techniques**:

```javascript
// ❌ BAD - AWS SDK v2 (50MB)
const AWS = require('aws-sdk');

// ✅ GOOD - AWS SDK v3 modular (3-5MB)
const { S3Client } = require('@aws-sdk/client-s3');
const { SQSClient } = require('@aws-sdk/client-sqs');
```

**Use Lambda Layers for Heavy Dependencies**:
```hcl
# Terraform
resource "aws_lambda_layer_version" "heavy_libs" {
  layer_name          = "pdf-processing-libs"
  filename            = "layer.zip"  # 150MB
  compatible_runtimes = ["nodejs20.x"]
}

resource "aws_lambda_function" "processor" {
  filename      = "function.zip"  # Only 5MB!
  layers        = [aws_lambda_layer_version.heavy_libs.arn]
}
```

### Lợi Ích
- ✅ **Cold Start**: Giảm 50-80% cold start time
- ✅ **Deployment**: Deploy nhanh hơn (package nhỏ)
- ✅ **Cost**: Giảm bandwidth cost

### Trade-offs
- ⚠️ **Bundle Complexity**: Cần webpack/esbuild
- ⚠️ **Layers Limit**: Max 5 layers per function
- ⚠️ **Maintenance**: Phải quản lý layers riêng

---

## 🔄 1. Container Reuse (Execution Environment Reuse)

### Khái Niệm
Lambda không tạo container mới cho mỗi invocation. Container được **reuse** trong 5-45 phút.

### Cách Tận Dụng
```javascript
// ❌ BAD - Khởi tạo lại mỗi lần
exports.handler = async (event) => {
  const s3Client = new S3Client({ region: 'us-east-1' });
  const esClient = new Client({ node: 'https://...' });
  // ...
};

// ✅ GOOD - Khởi tạo 1 lần, reuse nhiều lần
const s3Client = new S3Client({ region: 'us-east-1' });
const esClient = new Client({ node: 'https://...' });

exports.handler = async (event) => {
  // Sử dụng clients đã khởi tạo
  // ...
};
```

### Lợi Ích
- ✅ **Performance**: Không tốn thời gian khởi tạo connection
- ✅ **Connection Pooling**: Tái sử dụng TCP connections
- ✅ **Chi Phí**: Giảm cold start time

### Trade-offs
- ⚠️ **State Management**: Phải cẩn thận với mutable state
- ⚠️ **Memory Leaks**: Global variables tồn tại lâu hơn

---

## 💾 2. In-Memory Cache (RAM)

### Khái Niệm
Cache dữ liệu trong RAM của container (128MB - 10GB available memory).

### Implementation
```javascript
// LRU Cache for metadata
const metadataCache = new Map();
const CACHE_SIZE = 100;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const cached = metadataCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCached(key, data) {
  // LRU eviction
  if (metadataCache.size >= CACHE_SIZE) {
    const firstKey = metadataCache.keys().next().value;
    metadataCache.delete(firstKey);
  }
  
  metadataCache.set(key, {
    data,
    timestamp: Date.now()
  });
}
```

### Use Cases
- ✅ **Metadata**: S3 file info, user profiles
- ✅ **Configuration**: Feature flags, API keys
- ✅ **Small Data**: Lookup tables, translations
- ❌ **Large Files**: Dùng /tmp thay vì RAM

### Lợi Ích
- ⚡ **Ultra Fast**: RAM access < 1ms
- 💰 **Free**: Không tính phí storage
- 🔧 **Simple**: Dùng Map/Object thông thường

### Trade-offs
- ⚠️ **Limited Size**: Phụ thuộc vào memory allocation
- ⚠️ **Volatile**: Mất data khi container bị recycle
- ⚠️ **Per Container**: Không share giữa containers

---

## 📁 3. /tmp Storage (Ephemeral Storage)

### Khái Niệm
Lambda cung cấp `/tmp` directory (512MB - **10GB**) persistent giữa invocations.

### Terraform Configuration
```hcl
resource "aws_lambda_function" "processor" {
  # ...
  
  # Enable ephemeral storage
  ephemeral_storage {
    size = 2048  # 2GB (512-10240 MB)
  }
  
  environment {
    variables = {
      ENABLE_TMP_CACHE = "true"
      TMP_CACHE_TTL    = "3600"  # 1 hour
    }
  }
}
```

### Implementation
```javascript
const fs = require('fs').promises;
const crypto = require('crypto');

const TMP_DIR = '/tmp/file-cache';

// Get cache key
function getCacheKey(s3Key) {
  return crypto.createHash('md5').update(s3Key).digest('hex');
}

// Check cached file
async function getCachedFile(s3Key) {
  const cachePath = `/tmp/file-cache/${getCacheKey(s3Key)}`;
  
  try {
    const stats = await fs.stat(cachePath);
    const age = Date.now() - stats.mtimeMs;
    
    if (age < 3600 * 1000) { // 1 hour TTL
      console.log('Cache HIT');
      return await fs.readFile(cachePath);
    }
  } catch (error) {
    return null;
  }
}

// Save to cache
async function saveCachedFile(s3Key, buffer) {
  const cachePath = `/tmp/file-cache/${getCacheKey(s3Key)}`;
  await fs.mkdir('/tmp/file-cache', { recursive: true });
  await fs.writeFile(cachePath, buffer);
}
```

### Use Cases
- ✅ **Downloaded Files**: S3 objects, API responses
- ✅ **Processed Data**: Chunked files, transformed data
- ✅ **ML Models**: Model weights (100MB-2GB)
- ✅ **Dependencies**: Dynamic libraries, binaries

### Lợi Ích
- 💾 **Large Storage**: Up to 10GB
- ⏱️ **Persistent**: Tồn tại giữa invocations
- 💰 **Low Cost**: $0.0000000309/GB-second (~$0.08/GB/month)
- 🚀 **Fast**: SSD storage, read speed ~500MB/s

### Trade-offs
- ⚠️ **Not Guaranteed**: Container có thể bị recycle bất cứ lúc nào
- ⚠️ **Cost**: Tính phí theo GB-second
- ⚠️ **Cleanup Required**: Phải xóa old files để tránh đầy
- ⚠️ **Per Container**: Không share giữa containers

---

## 📊 Performance Comparison

| Cache Type | Speed | Size | Cost | Persistence | Use Case |
|------------|-------|------|------|-------------|----------|
| **Deployment Package** | N/A (Init) | Max 250MB | Deploy cost | Permanent | Dependencies, Libraries |
| **Lambda Layers** | N/A (Init) | 5 layers, 250MB total | FREE | Permanent | Shared dependencies |
| **Global Scope** | ⚡⚡⚡⚡⚡ | Small | FREE | Medium (5-45min) | Connections, Clients |
| **In-Memory** | ⚡⚡⚡⚡⚡ | Medium | FREE | Medium (5-45min) | Metadata, Config |
| **/tmp Storage** | ⚡⚡⚡⚡ | Large (10GB) | $0.08/GB/mo | Medium (5-45min) | Files, Models |
| **S3** | ⚡⚡ | Unlimited | $0.023/GB/mo | Permanent | Archive, Backup |
| **ElastiCache** | ⚡⚡⚡⚡ | Large | $0.017/hr | Permanent | Shared Cache |

---

## 🎯 Best Practices

### 0. Package Size Optimization
```bash
# Check package size before deploy
du -sh function.zip

# Analyze large dependencies
npm list --prod --depth=0
du -sh node_modules/* | sort -h | tail -10

# Remove AWS SDK v2, use v3
npm uninstall aws-sdk
npm install @aws-sdk/client-s3 @aws-sdk/client-sqs

# Bundle with tree shaking
npx esbuild handler.js --bundle --platform=node --target=node20 --outfile=dist/handler.js
```

### 1. Layered Caching Strategy
```javascript
async function getFile(s3Key) {
  // Layer 1: In-Memory (fastest)
  let file = inMemoryCache.get(s3Key);
  if (file) return file;
  
  // Layer 2: /tmp disk (fast)
  file = await getTmpCache(s3Key);
  if (file) {
    inMemoryCache.set(s3Key, file); // Promote to L1
    return file;
  }
  
  // Layer 3: S3 (slow)
  file = await downloadFromS3(s3Key);
  await saveTmpCache(s3Key, file); // Save to L2
  inMemoryCache.set(s3Key, file);  // Save to L1
  return file;
}
```

### 2. TTL & Eviction
```javascript
// Time-based eviction
const CACHE_TTL = 3600 * 1000; // 1 hour

// Size-based eviction (LRU)
if (cache.size >= MAX_SIZE) {
  const oldestKey = cache.keys().next().value;
  cache.delete(oldestKey);
}
```

### 3. Cleanup Old Files
```javascript
// Run cleanup periodically (every 10 invocations)
if (Math.random() < 0.1) {
  await cleanupOldCache();
}

async function cleanupOldCache() {
  const files = await fs.readdir('/tmp/file-cache');
  for (const file of files) {
    const stats = await fs.stat(`/tmp/file-cache/${file}`);
    const age = Date.now() - stats.mtimeMs;
    if (age > TTL) {
      await fs.unlink(`/tmp/file-cache/${file}`);
    }
  }
}
```

### 4. Monitor Cache Hit Rate
```javascript
let cacheHits = 0;
let cacheMisses = 0;

async function getWithMetrics(key) {
  const cached = await getCache(key);
  if (cached) {
    cacheHits++;
  } else {
    cacheMisses++;
  }
  
  console.log(`Cache hit rate: ${(cacheHits / (cacheHits + cacheMisses) * 100).toFixed(2)}%`);
  return cached;
}
```

---

## 💡 Real-World Examples

### Example 1: File Processor (Your Use Case)

**Scenario**: Download file from S3, chunk it, index to Elasticsearch

**Caching Strategy**:
```javascript
// Global scope: Reuse connections
const s3Client = new S3Client({ region: 'us-east-1' });
const esClient = new Client({ node: 'https://...' });

// /tmp cache: Downloaded files
async function processFile(s3Key) {
  // Check /tmp cache first
  let file = await getCachedFile(s3Key);
  
  if (!file) {
    // Download from S3 (slow)
    file = await s3Client.send(new GetObjectCommand({ Key: s3Key }));
    await saveCachedFile(s3Key, file); // Save for next time
  }
  
  // Process & index (reuse esClient connection)
  const chunks = chunkFile(file);
  await esClient.bulk({ operations: chunks });
}
```

**Results**:
- ✅ **First invocation**: 500ms (download from S3)
- ✅ **Subsequent invocations**: 50ms (read from /tmp) - **10× faster**
- ✅ **Cost Savings**: Reduced S3 GET requests by 80%

### Example 2: ML Inference

**Scenario**: Load 500MB model, run inference

```javascript
// Global scope: Load model once
let model = null;

exports.handler = async (event) => {
  // Load model on cold start only
  if (!model) {
    // Try /tmp cache first
    model = await loadModelFromTmp();
    if (!model) {
      model = await downloadModelFromS3();
      await saveModelToTmp(model);
    }
  }
  
  // Run inference (fast)
  return model.predict(event.data);
};
```

**Results**:
- ❌ **Without cache**: 2000ms cold start (download 500MB)
- ✅ **With /tmp cache**: 300ms (load from disk)
- ✅ **Warm invocation**: 50ms (model in memory) - **40× faster**

---

## 🔧 Monitoring & Debugging

### CloudWatch Logs
```javascript
console.log(`Cache HIT for ${key} (age: ${age}s)`);
console.log(`Cache MISS for ${key}, downloading from S3`);
console.log(`Cache stats - Hits: ${hits}, Misses: ${misses}, Rate: ${rate}%`);
```

### Lambda Insights Metrics
- `Memory Used` - Track memory cache usage
- `Init Duration` - Cold start time (affected by /tmp cache)
- `Duration` - Execution time (should decrease with cache)

### Cost Analysis
```bash
# /tmp storage cost
Size: 2GB
Invocations: 1M/month
Avg duration: 200ms

Cost = 2GB × 200ms × 1M / 1000 × $0.0000000309
     = $12.36/month

# vs S3 GET requests without cache
Requests: 1M × $0.0004/1000 = $400/month

Savings: $387.64/month (97% reduction!)
```

---

## ⚠️ Common Pitfalls

### 1. Not Cleaning Up /tmp
```javascript
// ❌ BAD - /tmp fills up over time
await fs.writeFile('/tmp/file.txt', data);

// ✅ GOOD - Cleanup old files
await cleanupOldCache();
await fs.writeFile('/tmp/file.txt', data);
```

### 2. Caching Mutable Data
```javascript
// ❌ BAD - Cache user data (changes frequently)
const userCache = new Map();
userCache.set(userId, userData); // Stale data!

// ✅ GOOD - Short TTL or don't cache
const CACHE_TTL = 60 * 1000; // 1 minute only
```

### 3. Ignoring Memory Limits
```javascript
// ❌ BAD - Cache huge files in memory
const fileCache = new Map();
fileCache.set(key, hugeFile); // OutOfMemory!

// ✅ GOOD - Use /tmp for large files
await saveTmpCache(key, hugeFile);
```

---

## 📚 References

- [AWS Lambda Execution Environment](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html)
- [Lambda Ephemeral Storage](https://aws.amazon.com/blogs/aws/aws-lambda-now-supports-up-to-10-gb-ephemeral-storage/)
- [Best Practices for Working with Lambda](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)

---

## 🎓 Summary

| Strategy | When to Use | Performance Gain |
|----------|-------------|------------------|
| **Package Optimization** | Always (minimize node_modules) | 200-1000ms (cold start) |
| **Lambda Layers** | Heavy dependencies (>50MB) | Keep function package small |
| **Global Scope** | Always (connections, clients) | 50-200ms (cold start) |
| **In-Memory** | Small, frequently accessed data (<10MB) | 1-10ms → <1ms (10× faster) |
| **/tmp Cache** | Large files, models (>10MB, <10GB) | 500ms → 50ms (10× faster) |
| **External Cache** | Shared across functions, permanent | Varies |

**Kết luận**: Combine cả 4 strategies để đạt performance tốt nhất!
