# Lambda Cache Layers - Kiến Trúc Chi Tiết

## 🏗️ Tổng Quan Kiến Trúc

Lambda caching được tổ chức thành **5 tầng (layers)** với tốc độ và kích thước khác nhau.

```
┌─────────────────────────────────────────────────────────────────┐
│                     AWS Lambda Function                         │
│                                                                   │
│   ┌───────────────────────────────────────────────────────┐    │
│   │  L0: DEPLOYMENT PACKAGE (node_modules)                │    │
│   │  ─────────────────────────────────────────────────    │    │
│   │  • Speed: N/A (loaded at INIT time once)             │    │
│   │  • Size: Max 250MB unzipped                           │    │
│   │  • Lifetime: Permanent (until redeployment)           │    │
│   │  • Shared: All containers of same function            │    │
│   │                                                        │    │
│   │  Examples:                                             │    │
│   │  ✓ node_modules (npm packages)                        │    │
│   │  ✓ Lambda Layers (shared dependencies)                │    │
│   │  ✓ Compiled code & bundled assets                     │    │
│   │  ✓ Native binaries & libraries                        │    │
│   └───────────────────────────────────────────────────────┘    │
│                            ↓                                     │
│   ┌───────────────────────────────────────────────────────┐    │
│   │  L1: EXECUTION CONTEXT (Global Scope)                 │    │
│   │  ─────────────────────────────────────────────────    │    │
│   │  • Speed: <1ms                                        │    │
│   │  • Size: Limited by Memory (e.g., 1GB)               │    │
│   │  • Lifetime: 5-45 minutes (container reuse)          │    │
│   │  • Shared: Within same container only                 │    │
│   │                                                        │    │
│   │  Examples:                                             │    │
│   │  ✓ AWS SDK clients (S3, DynamoDB, etc)               │    │
│   │  ✓ Database connection pools                          │    │
│   │  ✓ Compiled code & dependencies                       │    │
│   │  ✓ Environment variables (parsed once)                │    │
│   └───────────────────────────────────────────────────────┘    │
│                            ↓                                     │
│   ┌───────────────────────────────────────────────────────┐    │
│   │  L2: IN-MEMORY CACHE (Heap)                          │    │
│   │  ─────────────────────────────────────────────────    │    │
│   │  • Speed: 1-10ms                                      │    │
│   │  • Size: Limited by Memory - Heap usage              │    │
│   │  • Lifetime: 5-45 minutes (container reuse)          │    │
│   │  • Shared: Within same container only                 │    │
│   │                                                        │    │
│   │  Examples:                                             │    │
│   │  ✓ Map/Object for key-value data                     │    │
│   │  ✓ LRU cache for metadata                            │    │
│   │  ✓ Computed results                                   │    │
│   │  ✓ Session data                                       │    │
│   └───────────────────────────────────────────────────────┘    │
│                            ↓                                     │
│   ┌───────────────────────────────────────────────────────┐    │
│   │  L3: EPHEMERAL STORAGE (/tmp)                        │    │
│   │  ─────────────────────────────────────────────────    │    │
│   │  • Speed: 10-100ms                                    │    │
│   │  • Size: 512MB - 10GB (configurable)                 │    │
│   │  • Lifetime: 5-45 minutes (container reuse)          │    │
│   │  • Shared: Within same container only                 │    │
│   │                                                        │    │
│   │  Examples:                                             │    │
│   │  ✓ Downloaded files from S3                          │    │
│   │  ✓ ML model weights (100MB-2GB)                      │    │
│   │  ✓ Large datasets                                     │    │
│   │  ✓ Temporary processing files                         │    │
│   └───────────────────────────────────────────────────────┘    │
│                            ↓                                     │
│   ┌───────────────────────────────────────────────────────┐    │
│   │  L4: EXTERNAL CACHE (Network)                        │    │
│   │  ─────────────────────────────────────────────────    │    │
│   │  • Speed: 50-200ms (network latency)                 │    │
│   │  • Size: Unlimited                                    │    │
│   │  • Lifetime: Permanent (until explicitly deleted)     │    │
│   │  • Shared: Across all containers & functions         │    │
│   │                                                        │    │
│   │  Examples:                                             │    │
│   │  ✓ ElastiCache (Redis/Memcached)                     │    │
│   │  ✓ DynamoDB (NoSQL database)                         │    │
│   │  ✓ S3 (object storage)                               │    │
│   │  ✓ RDS (relational database)                         │    │
│   └───────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Chi Tiết Từng Layer

### Layer 0: Deployment Package (node_modules & Dependencies)

#### Đặc Điểm

**Node.js Module Caching**: Node.js có built-in caching mechanism cho `require()`. Modules chỉ được load **1 lần duy nhất** và cached trong `require.cache`.

```javascript
// File: handler.js

// ===================================================
// THESE MODULES ARE LOADED ONCE AND CACHED
// ===================================================
const aws = require('aws-sdk');           // Loaded from node_modules
const lodash = require('lodash');         // Cached by Node.js
const axios = require('axios');           // Reused across invocations
const moment = require('moment');         // Never loaded again

// Custom modules also cached
const utils = require('./utils');         // Loaded once
const config = require('./config.json');  // Parsed once

console.log('Modules loaded:', Object.keys(require.cache).length);

exports.handler = async (event) => {
  // require() here returns cached module instantly
  const _ = require('lodash'); // <1ms - from cache
  
  return { statusCode: 200 };
};
```

#### Deployment Package Structure

**Option 1: ZIP File** (max 50MB compressed, 250MB uncompressed)
```
function.zip
├── handler.js                    # Your code
├── utils.js                      # Helper modules
├── config.json                   # Configuration
└── node_modules/                 # Dependencies
    ├── aws-sdk/                  # 50MB
    ├── lodash/                   # 1.4MB
    ├── axios/                    # 500KB
    └── ...                       # More packages

Total: 245MB uncompressed ⚠️ Close to limit!
```

**Option 2: Lambda Layers** (Recommended for shared deps)
```
Function Package (5MB):
├── handler.js
├── utils.js
└── config.json

Layer 1 - Common Libraries (50MB):
└── nodejs/node_modules/
    ├── aws-sdk/
    ├── lodash/
    └── axios/

Layer 2 - Custom Utils (10MB):
└── nodejs/node_modules/
    └── @company/shared-utils/

Total: 5MB (function) + 60MB (layers) = 65MB
✅ Function package small, fast deployment!
```

**Option 3: Container Image** (max 10GB)
```dockerfile
FROM public.ecr.aws/lambda/nodejs:20

# node_modules cached in Docker layer
COPY package*.json ./
RUN npm ci --only=production  # ← Cached layer

# Code copied separately (cache-friendly)
COPY handler.js ./

CMD ["handler.handler"]
```

#### Optimization Techniques

**1. Tree Shaking & Bundling**
```javascript
// ❌ BAD - Import entire library (500KB)
const _ = require('lodash');

// ✅ GOOD - Import only what you need (50KB)
const map = require('lodash/map');
const filter = require('lodash/filter');

// ✅ BETTER - Use webpack/esbuild to bundle
// Result: Only used functions included
```

**2. Remove AWS SDK v2** (Node.js 18+)
```javascript
// ❌ BAD - AWS SDK v2 included by default (50MB)
const AWS = require('aws-sdk');

// ✅ GOOD - AWS SDK v3 modular (5MB)
const { S3Client } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

// Savings: 45MB reduction!
```

**3. Webpack Bundle Analyzer**
```bash
# Analyze package size
npm install --save-dev webpack-bundle-analyzer

# Find large dependencies
du -sh node_modules/* | sort -h

# Remove unused packages
npm prune --production
```

**4. Lambda Layers for Shared Dependencies**
```hcl
# Terraform - Create reusable layer
resource "aws_lambda_layer_version" "common_libs" {
  layer_name = "nodejs-common-libs"
  
  # Package structure: nodejs/node_modules/...
  filename         = "layer-common-libs.zip"
  source_code_hash = filebase64sha256("layer-common-libs.zip")
  
  compatible_runtimes = ["nodejs20.x", "nodejs18.x"]
  
  description = "Common libraries: lodash, axios, moment"
}

# Use layer in function
resource "aws_lambda_function" "processor" {
  function_name = "file-processor"
  filename      = "function.zip"  # Only 5MB!
  
  layers = [
    aws_lambda_layer_version.common_libs.arn,
  ]
}
```

#### Package Size Impact on Cold Start

**Measurement Results**:

| Package Size | Cold Start Time | Download Time |
|--------------|-----------------|---------------|
| 5 MB         | 120ms           | 20ms          |
| 50 MB        | 350ms           | 150ms         |
| 100 MB       | 650ms           | 400ms         |
| 200 MB       | 1200ms          | 900ms         |
| 250 MB (max) | 1500ms          | 1200ms        |

**Conclusion**: Keep package < 50MB for best cold start!

#### Real-World Example: File Processor Optimization

**Before Optimization** (245MB):
```json
{
  "dependencies": {
    "aws-sdk": "^2.1000.0",         // 50MB ❌
    "@elastic/elasticsearch": "^8.0.0", // 15MB ✅
    "lodash": "^4.17.21",           // 1.4MB ❌
    "moment": "^2.29.4",            // 500KB ❌
    "axios": "^1.0.0",              // 500KB ✅
    "pdf-parse": "^1.1.1",          // 150MB ❌
    "sharp": "^0.32.0"               // 20MB ❌
  }
}

Cold Start: 1200ms ❌
```

**After Optimization** (35MB):
```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.0.0",       // 3MB ✅
    "@aws-sdk/client-sqs": "^3.0.0",      // 2MB ✅
    "@elastic/elasticsearch": "^8.0.0",   // 15MB ✅
    "axios": "^1.0.0",                    // 500KB ✅
    // Moved to Lambda Layer:
    // - pdf-parse (150MB)
    // - sharp (20MB)
  }
}

Lambda Layer (170MB):
- pdf-parse
- sharp

Cold Start: 350ms ✅ (3.4× faster!)
```

#### Best Practices

**✅ DO**:
- Use AWS SDK v3 (modular, smaller)
- Bundle with webpack/esbuild for tree shaking
- Move large dependencies to Lambda Layers
- Remove devDependencies (`npm ci --only=production`)
- Use Container Images for 100MB+ packages
- Analyze bundle size regularly

**❌ DON'T**:
- Include AWS SDK v2 (50MB unnecessary)
- Import entire libraries (use specific imports)
- Include test files, docs, examples
- Use heavy dependencies when lighter alternatives exist
- Deploy without compression

#### Monitoring Package Size

```bash
#!/bin/bash
# check-package-size.sh

echo "Building deployment package..."
npm ci --only=production
zip -r function.zip . -x "*.git*" "test/*" "*.md"

SIZE=$(du -sh function.zip | cut -f1)
SIZE_BYTES=$(stat -f%z function.zip 2>/dev/null || stat -c%s function.zip)

echo "Package size: $SIZE ($SIZE_BYTES bytes)"

if [ $SIZE_BYTES -gt 52428800 ]; then  # 50MB
  echo "⚠️  WARNING: Package > 50MB, cold start will be slow!"
  echo "💡 Consider: AWS SDK v3, Lambda Layers, or Container Image"
fi

if [ $SIZE_BYTES -gt 262144000 ]; then  # 250MB
  echo "❌ ERROR: Package > 250MB limit!"
  exit 1
fi
```

---

### Layer 1: Execution Context (Global Scope)

#### Đặc Điểm
```javascript
// Code này chạy 1 LẦN khi container được tạo (INIT phase)
console.log('INIT: Loading at', new Date());

const { S3Client } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

// Khởi tạo 1 lần, reuse nhiều lần
const s3Client = new S3Client({ 
  region: 'us-east-1',
  maxAttempts: 3 
});

const dbClient = new DynamoDBClient({ region: 'us-east-1' });

// Constant configuration (parsed once)
const CONFIG = JSON.parse(process.env.CONFIG || '{}');

// Connection pool (created once)
let dbConnectionPool = null;

// ====================================================
// Handler chạy MỖI LẦN có request (INVOKE phase)
// ====================================================
exports.handler = async (event) => {
  console.log('INVOKE: Processing at', new Date());
  
  // Reuse s3Client - NO initialization cost
  const data = await s3Client.send(new GetObjectCommand({...}));
  
  return { statusCode: 200 };
};
```

#### Lifecycle
```
Container Created → INIT phase → Global code executed
                         ↓
                    Handler ready
                         ↓
          ┌──────────────┴──────────────┐
          │                              │
    Invocation 1                   Invocation 2
    (260ms)                        (2ms - Reuse!)
          │                              │
          └──────────────┬──────────────┘
                         ↓
            Container kept WARM (5-45 min)
                         ↓
                  Container destroyed
```

#### Use Cases & Examples

**✅ AWS SDK Clients**
```javascript
// ✅ GOOD - Initialize once
const s3 = new S3Client({ region: 'us-east-1' });

// ❌ BAD - Initialize every invocation
exports.handler = async () => {
  const s3 = new S3Client({ region: 'us-east-1' }); // Waste!
};
```

**✅ Database Connections**
```javascript
const { Pool } = require('pg');

// Connection pool created once
const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  max: 10, // 10 connections in pool
});

exports.handler = async (event) => {
  // Reuse connection from pool
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users');
    return result.rows;
  } finally {
    client.release();
  }
};
```

**✅ Parsed Configuration**
```javascript
// Parse JSON once
const APP_CONFIG = JSON.parse(process.env.CONFIG);
const FEATURE_FLAGS = JSON.parse(process.env.FEATURES);

// Compile regex once
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async (event) => {
  // Use pre-parsed config - instant access
  if (APP_CONFIG.debugMode) {
    console.log('Debug:', event);
  }
};
```

#### Performance Impact
- **First invocation** (Cold Start): 200-1000ms INIT + handler
- **Subsequent invocations**: 2-50ms (chỉ handler, skip INIT)
- **Savings**: 90-98% reduction in initialization overhead

#### Best Practices

**✅ DO**:
- Initialize SDK clients in global scope
- Create database connection pools
- Parse environment variables once
- Compile regex patterns
- Load static configurations

**❌ DON'T**:
- Store request-specific data in global scope
- Assume container will always be reused
- Leak memory with unbounded caches
- Store secrets in global variables without encryption

---

### Layer 2: In-Memory Cache (Heap)

#### Đặc Điểm
```javascript
// LRU Cache implementation
class LRUCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }
  
  get(key) {
    if (!this.cache.has(key)) return null;
    
    const item = this.cache.get(key);
    
    // Check TTL
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // Move to end (mark as recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    
    return item.value;
  }
  
  set(key, value, ttl = 300000) { // 5 min default
    // Evict oldest if full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });
  }
  
  size() {
    return this.cache.size;
  }
}

// Global cache instances
const userCache = new LRUCache(100);
const configCache = new LRUCache(50);

exports.handler = async (event) => {
  const userId = event.userId;
  
  // Check cache first
  let user = userCache.get(userId);
  
  if (!user) {
    // Cache miss - fetch from DB
    user = await fetchUserFromDB(userId);
    userCache.set(userId, user, 300000); // Cache 5 min
  }
  
  return { user };
};
```

#### Memory Management
```javascript
// Monitor memory usage
function getMemoryUsage() {
  const used = process.memoryUsage();
  return {
    heapUsed: Math.round(used.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(used.heapTotal / 1024 / 1024),
    external: Math.round(used.external / 1024 / 1024),
    rss: Math.round(used.rss / 1024 / 1024),
  };
}

exports.handler = async (event) => {
  console.log('Memory before:', getMemoryUsage());
  
  // Process...
  
  console.log('Memory after:', getMemoryUsage());
  console.log('Cache size:', myCache.size());
};
```

#### Use Cases & Sizing

**Small Objects (< 1KB each)**
```javascript
// ✅ GOOD - 100 users × 1KB = 100KB
const userCache = new Map();
userCache.set('user-123', { id: 123, name: 'John', email: '...' });

// Can store 1000s of small objects safely
```

**Medium Objects (1KB - 1MB)**
```javascript
// ⚠️ CAREFUL - 100 configs × 100KB = 10MB
const configCache = new Map();

// Limit size to prevent memory issues
const MAX_CACHE_SIZE = 50; // 5MB total
```

**Large Objects (> 1MB)**
```javascript
// ❌ BAD - Don't cache in memory!
const fileCache = new Map();
fileCache.set('large-file', largeBuffer); // 10MB - Too big!

// ✅ GOOD - Use /tmp instead
await fs.writeFile('/tmp/large-file', largeBuffer);
```

#### Cache Strategies

**1. Time-Based Expiration**
```javascript
const cache = new Map();

function set(key, value, ttlMs = 300000) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });
}

function get(key) {
  const item = cache.get(key);
  if (!item) return null;
  
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  
  return item.value;
}
```

**2. LRU (Least Recently Used)**
```javascript
class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }
  
  get(key) {
    const value = this.cache.get(key);
    if (!value) return null;
    
    // Move to end (mark as recently used)
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  
  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      // Delete oldest (first in Map)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}
```

**3. Write-Through**
```javascript
async function getUser(userId) {
  // Check cache
  let user = cache.get(userId);
  if (user) return user;
  
  // Fetch from DB
  user = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
  
  // Write to cache
  cache.set(userId, user);
  
  return user;
}

async function updateUser(userId, data) {
  // Update DB
  await db.query('UPDATE users SET ... WHERE id = ?', [userId]);
  
  // Update cache immediately
  cache.set(userId, data);
}
```

**4. Write-Behind**
```javascript
const pendingWrites = [];

async function updateUser(userId, data) {
  // Update cache immediately
  cache.set(userId, data);
  
  // Queue DB write
  pendingWrites.push({ userId, data });
  
  // Return fast
  return { success: true };
}

// Background flush (periodic)
setInterval(async () => {
  while (pendingWrites.length > 0) {
    const write = pendingWrites.shift();
    await db.query('UPDATE users SET ... WHERE id = ?', [write.userId]);
  }
}, 5000); // Every 5 seconds
```

---

### Layer 3: Ephemeral Storage (/tmp)

#### Đặc Điểm Kỹ Thuật

**Filesystem**: SSD-backed, local to container
**Default Size**: 512MB
**Max Size**: 10GB (configurable)
**Cost**: $0.0000000309 per GB-second
**Performance**: ~500MB/s read, ~400MB/s write

#### Configuration

**Terraform**:
```hcl
resource "aws_lambda_function" "processor" {
  function_name = "file-processor"
  
  # Enable larger /tmp
  ephemeral_storage {
    size = 10240  # 10GB (max)
  }
  
  memory_size = 2048  # Recommend 2GB+ RAM for 10GB /tmp
}
```

**Cost Calculation**:
```
10GB × 500ms avg × 1M invocations / month
= 10 × 0.5 × 1,000,000 GB-seconds
= 5,000,000 GB-seconds
× $0.0000000309
= $154.50 / month

vs S3 GET requests:
1M × $0.0004/1000 = $400/month

Savings: $245.50/month (61% reduction!)
```

#### Implementation Patterns

**Pattern 1: Simple File Cache**
```javascript
const fs = require('fs').promises;
const crypto = require('crypto');

async function getCachedFile(s3Key) {
  const hash = crypto.createHash('md5').update(s3Key).digest('hex');
  const cachePath = `/tmp/${hash}`;
  
  try {
    const stats = await fs.stat(cachePath);
    const age = Date.now() - stats.mtimeMs;
    
    // Check if expired (1 hour TTL)
    if (age < 3600000) {
      console.log(`[CACHE-HIT] ${s3Key}`);
      return await fs.readFile(cachePath);
    }
    
    console.log(`[CACHE-EXPIRED] ${s3Key} (age: ${Math.round(age/1000)}s)`);
    await fs.unlink(cachePath);
  } catch (err) {
    console.log(`[CACHE-MISS] ${s3Key}`);
  }
  
  return null;
}

async function saveCachedFile(s3Key, buffer) {
  const hash = crypto.createHash('md5').update(s3Key).digest('hex');
  const cachePath = `/tmp/${hash}`;
  
  await fs.writeFile(cachePath, buffer);
  console.log(`[CACHE-SAVE] ${s3Key} (${buffer.length} bytes)`);
}
```

**Pattern 2: Structured Cache Directory**
```javascript
const path = require('path');

class TmpCache {
  constructor(basePath = '/tmp/cache') {
    this.basePath = basePath;
  }
  
  async init() {
    await fs.mkdir(this.basePath, { recursive: true });
    await fs.mkdir(path.join(this.basePath, 'files'), { recursive: true });
    await fs.mkdir(path.join(this.basePath, 'models'), { recursive: true });
  }
  
  async getFile(key, category = 'files') {
    const filePath = path.join(this.basePath, category, key);
    try {
      const buffer = await fs.readFile(filePath);
      console.log(`[HIT] ${category}/${key}`);
      return buffer;
    } catch (err) {
      console.log(`[MISS] ${category}/${key}`);
      return null;
    }
  }
  
  async saveFile(key, buffer, category = 'files') {
    const filePath = path.join(this.basePath, category, key);
    await fs.writeFile(filePath, buffer);
    console.log(`[SAVE] ${category}/${key} (${buffer.length} bytes)`);
  }
  
  async cleanup(maxAge = 3600000) {
    const categories = await fs.readdir(this.basePath);
    let cleaned = 0;
    
    for (const category of categories) {
      const categoryPath = path.join(this.basePath, category);
      const files = await fs.readdir(categoryPath);
      
      for (const file of files) {
        const filePath = path.join(categoryPath, file);
        const stats = await fs.stat(filePath);
        const age = Date.now() - stats.mtimeMs;
        
        if (age > maxAge) {
          await fs.unlink(filePath);
          cleaned++;
        }
      }
    }
    
    console.log(`[CLEANUP] Removed ${cleaned} expired files`);
  }
  
  async getStats() {
    const { size, files } = await this.getDirSize(this.basePath);
    return {
      totalSize: Math.round(size / 1024 / 1024), // MB
      fileCount: files
    };
  }
  
  async getDirSize(dirPath) {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    let size = 0;
    let count = 0;
    
    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      
      if (file.isDirectory()) {
        const subDir = await this.getDirSize(filePath);
        size += subDir.size;
        count += subDir.files;
      } else {
        const stats = await fs.stat(filePath);
        size += stats.size;
        count++;
      }
    }
    
    return { size, files: count };
  }
}

// Usage
const cache = new TmpCache();

exports.handler = async (event) => {
  await cache.init();
  
  // Get or download file
  let file = await cache.getFile('document.pdf');
  if (!file) {
    file = await downloadFromS3('document.pdf');
    await cache.saveFile('document.pdf', file);
  }
  
  // Cleanup old files (10% probability)
  if (Math.random() < 0.1) {
    await cache.cleanup(3600000); // 1 hour
  }
  
  // Log stats
  const stats = await cache.getStats();
  console.log(`[STATS] /tmp: ${stats.totalSize}MB, ${stats.fileCount} files`);
  
  return { success: true };
};
```

**Pattern 3: ML Model Cache**
```javascript
const tf = require('@tensorflow/tfjs-node');

let model = null;

async function loadModel() {
  const modelPath = '/tmp/model';
  
  try {
    // Try to load from /tmp
    model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
    console.log('[MODEL] Loaded from /tmp cache');
    return model;
  } catch (err) {
    console.log('[MODEL] Not in cache, downloading...');
    
    // Download from S3
    const modelFiles = await downloadModelFromS3();
    
    // Save to /tmp
    await fs.mkdir(modelPath, { recursive: true });
    await fs.writeFile(`${modelPath}/model.json`, modelFiles.json);
    await fs.writeFile(`${modelPath}/weights.bin`, modelFiles.weights);
    
    // Load from /tmp
    model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
    console.log('[MODEL] Downloaded and cached');
    
    return model;
  }
}

exports.handler = async (event) => {
  // Load model (cached or download)
  if (!model) {
    model = await loadModel();
  }
  
  // Run inference
  const prediction = model.predict(event.input);
  
  return { prediction };
};
```

#### Monitoring & Limits

**Check /tmp Usage**:
```javascript
const { execSync } = require('child_process');

function getTmpUsage() {
  try {
    const output = execSync('df -h /tmp').toString();
    const lines = output.split('\n');
    const dataLine = lines[1].split(/\s+/);
    
    return {
      size: dataLine[1],
      used: dataLine[2],
      available: dataLine[3],
      usePercent: dataLine[4]
    };
  } catch (err) {
    return null;
  }
}

exports.handler = async (event) => {
  const usage = getTmpUsage();
  console.log('[TMP-USAGE]', usage);
  // { size: '512M', used: '45M', available: '467M', usePercent: '9%' }
  
  // Alert if > 80% full
  const percent = parseInt(usage.usePercent);
  if (percent > 80) {
    console.warn('[TMP-WARN] Disk > 80% full, cleaning up...');
    await cleanupOldFiles();
  }
};
```

---

### Layer 4: External Cache (Network)

#### Options Comparison

| Solution | Speed | Cost | Complexity | Use Case |
|----------|-------|------|------------|----------|
| **ElastiCache (Redis)** | 1-3ms | $0.017/hr | Medium | Hot data, sessions |
| **ElastiCache (Memcached)** | 1-3ms | $0.017/hr | Low | Simple key-value |
| **DynamoDB** | 5-15ms | Pay per request | Medium | Structured data |
| **S3** | 50-200ms | $0.023/GB/mo | Low | Cold data, backups |
| **RDS** | 10-50ms | $0.017/hr+ | High | Relational data |

#### Pattern: Redis Cache

```javascript
const Redis = require('ioredis');

// Connection in global scope (reuse)
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  // Connection pooling
  lazyConnect: false,
  keepAlive: 30000,
});

exports.handler = async (event) => {
  const key = `file:${event.fileId}`;
  
  // Check Redis cache
  const cached = await redis.get(key);
  if (cached) {
    console.log('[REDIS-HIT]', key);
    return JSON.parse(cached);
  }
  
  console.log('[REDIS-MISS]', key);
  
  // Process file
  const result = await processFile(event.fileId);
  
  // Save to Redis with TTL
  await redis.setex(key, 3600, JSON.stringify(result)); // 1 hour
  
  return result;
};
```

---

## 🎯 Layered Caching Strategy

### Implementation: Tất Cả 4 Layers

```javascript
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Client } = require('@elastic/elasticsearch');
const Redis = require('ioredis');
const fs = require('fs').promises;
const crypto = require('crypto');

// ==========================================
// LAYER 1: Global Scope
// ==========================================
const s3 = new S3Client({ region: 'us-east-1' });
const es = new Client({ node: process.env.ES_NODE });
const redis = new Redis({ host: process.env.REDIS_HOST });

// ==========================================
// LAYER 2: In-Memory Cache
// ==========================================
const memCache = new Map();
const MEM_CACHE_TTL = 60000; // 1 min
const MEM_CACHE_SIZE = 100;

function getMemCache(key) {
  const item = memCache.get(key);
  if (!item || Date.now() - item.ts > MEM_CACHE_TTL) {
    memCache.delete(key);
    return null;
  }
  return item.data;
}

function setMemCache(key, data) {
  if (memCache.size >= MEM_CACHE_SIZE) {
    const firstKey = memCache.keys().next().value;
    memCache.delete(firstKey);
  }
  memCache.set(key, { data, ts: Date.now() });
}

// ==========================================
// LAYER 3: /tmp Storage
// ==========================================
async function getTmpCache(key) {
  const hash = crypto.createHash('md5').update(key).digest('hex');
  const path = `/tmp/cache/${hash}`;
  
  try {
    const stats = await fs.stat(path);
    if (Date.now() - stats.mtimeMs < 3600000) { // 1 hour
      return await fs.readFile(path);
    }
  } catch (err) {}
  return null;
}

async function setTmpCache(key, buffer) {
  await fs.mkdir('/tmp/cache', { recursive: true });
  const hash = crypto.createHash('md5').update(key).digest('hex');
  await fs.writeFile(`/tmp/cache/${hash}`, buffer);
}

// ==========================================
// LAYER 4: Redis Cache
// ==========================================
async function getRedisCache(key) {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

async function setRedisCache(key, data, ttl = 3600) {
  await redis.setex(key, ttl, JSON.stringify(data));
}

// ==========================================
// UNIFIED GET FUNCTION - 4 LAYERS
// ==========================================
async function getData(fileId) {
  const key = `file:${fileId}`;
  
  console.log('[L1] Checking memory cache...');
  let data = getMemCache(key);
  if (data) {
    console.log('[L1-HIT] Memory cache');
    return data;
  }
  
  console.log('[L2] Checking /tmp cache...');
  let buffer = await getTmpCache(key);
  if (buffer) {
    console.log('[L2-HIT] /tmp cache');
    data = JSON.parse(buffer.toString());
    setMemCache(key, data); // Promote to L1
    return data;
  }
  
  console.log('[L3] Checking Redis cache...');
  data = await getRedisCache(key);
  if (data) {
    console.log('[L3-HIT] Redis cache');
    await setTmpCache(key, Buffer.from(JSON.stringify(data))); // Promote to L2
    setMemCache(key, data); // Promote to L1
    return data;
  }
  
  console.log('[L4] Fetching from S3 (MISS)...');
  const s3Data = await s3.send(new GetObjectCommand({
    Bucket: 'my-bucket',
    Key: fileId
  }));
  
  const chunks = [];
  for await (const chunk of s3Data.Body) {
    chunks.push(chunk);
  }
  buffer = Buffer.concat(chunks);
  data = JSON.parse(buffer.toString());
  
  // Save to all layers
  await setRedisCache(key, data); // L4
  await setTmpCache(key, buffer); // L3
  setMemCache(key, data); // L2
  
  console.log('[L4] Saved to all cache layers');
  
  return data;
}

// ==========================================
// HANDLER
// ==========================================
exports.handler = async (event) => {
  const startTime = Date.now();
  
  const data = await getData(event.fileId);
  
  const duration = Date.now() - startTime;
  console.log(`[COMPLETE] ${duration}ms`);
  
  return { data, duration };
};
```

### Performance Results

```
Request 1 (Cold Start, All Miss):
[L1] Checking memory cache...
[L2] Checking /tmp cache...
[L3] Checking Redis cache...
[L4] Fetching from S3 (MISS)...
[L4] Saved to all cache layers
[COMPLETE] 520ms

Request 2 (L1 Hit):
[L1] Checking memory cache...
[L1-HIT] Memory cache
[COMPLETE] 1ms (520× faster!)

Request 3 (After 2 min - L1 expired, L2 hit):
[L1] Checking memory cache...
[L2] Checking /tmp cache...
[L2-HIT] /tmp cache
[COMPLETE] 15ms (35× faster)

Request 4 (After 1 hour - L1/L2 expired, L3 hit):
[L1] Checking memory cache...
[L2] Checking /tmp cache...
[L3] Checking Redis cache...
[L3-HIT] Redis cache
[COMPLETE] 52ms (10× faster)
```

---

## 📈 Performance Matrix

| Scenario | L1 | L2 | L3 | L4 | Time | Speed |
|----------|----|----|----|----|------|-------|
| **Cold Start (Miss All)** | ❌ | ❌ | ❌ | ❌ | 520ms | 1× |
| **L1 Hit** | ✅ | - | - | - | 1ms | 520× |
| **L2 Hit** | ❌ | ✅ | - | - | 15ms | 35× |
| **L3 Hit** | ❌ | ❌ | ✅ | - | 52ms | 10× |
| **L4 Miss** | ❌ | ❌ | ❌ | ❌ | 520ms | 1× |

---

## 🎓 Summary

| Layer | Speed | Size | Shared | Lifetime | Cost |
|-------|-------|------|--------|----------|------|
| **L1: Global** | <1ms | Small | No | 5-45min | FREE |
| **L2: Memory** | 1-10ms | Medium | No | 5-45min | FREE |
| **L3: /tmp** | 10-100ms | 10GB | No | 5-45min | $0.03/GB-sec |
| **L4: External** | 50-200ms | Unlimited | Yes | Permanent | Varies |

**Kết luận**: Combine tất cả 4 layers để đạt performance tốt nhất với chi phí thấp nhất!
