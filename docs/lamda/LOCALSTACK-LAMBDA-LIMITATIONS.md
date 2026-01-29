# LocalStack Lambda Caching - Limitations & Workarounds

## ⚠️ CRITICAL: LocalStack Lambda Limitations

LocalStack **KHÔNG HỖ TRỢ ĐẦY ĐỦ** các tính năng caching như AWS Lambda thật.

---

## 📋 Comparison: LocalStack vs AWS Lambda

| Feature | AWS Lambda | LocalStack Community | LocalStack Pro |
|---------|------------|----------------------|----------------|
| **Container Reuse** | ✅ 5-45 minutes | ⚠️ Limited/Inconsistent | ✅ Better support |
| **Global Scope Cache** | ✅ Full support | ⚠️ Partial | ✅ Better |
| **/tmp Storage** | ✅ 512MB-10GB | ⚠️ Available but not persistent | ⚠️ Available |
| **Ephemeral Storage Config** | ✅ Yes | ❌ Ignored | ⚠️ Partial |
| **Memory Limits** | ✅ 128MB-10GB | ⚠️ Not enforced | ⚠️ Configurable |
| **Execution Time** | ✅ Up to 15 min | ⚠️ Not enforced | ⚠️ Configurable |
| **Cold Start** | ✅ Real behavior | ❌ Different behavior | ⚠️ Simulated |

---

## 🔍 LocalStack Lambda Execution Modes

LocalStack có 3 modes để execute Lambda:

### 1. `LAMBDA_EXECUTOR=docker` (Default)
```yaml
environment:
  - LAMBDA_EXECUTOR=docker
```

**Behavior**:
- Mỗi invocation tạo **container mới**
- **KHÔNG có container reuse**
- `/tmp` bị xóa sau mỗi invocation
- Global scope variables **không persist**

**Cache Support**:
- ❌ Container Reuse: **NO**
- ❌ Global Scope: **NO**
- ❌ /tmp Storage: **NO** (xóa mỗi lần)

### 2. `LAMBDA_EXECUTOR=local` (Faster)
```yaml
environment:
  - LAMBDA_EXECUTOR=local
```

**Behavior**:
- Execute trực tiếp trong LocalStack container
- **CÓ THỂ có container reuse** (không đảm bảo)
- `/tmp` có thể persist giữa invocations
- Global scope variables **có thể persist**

**Cache Support**:
- ⚠️ Container Reuse: **PARTIAL** (unpredictable)
- ⚠️ Global Scope: **PARTIAL** (depends)
- ⚠️ /tmp Storage: **YES** (but not like AWS)

### 3. `LAMBDA_EXECUTOR=docker-reuse` (Pro only)
```yaml
environment:
  - LAMBDA_EXECUTOR=docker-reuse
```

**Behavior**:
- Reuse containers giữa invocations
- Giống AWS Lambda hơn
- Chỉ có trong **LocalStack Pro**

**Cache Support**:
- ✅ Container Reuse: **YES**
- ✅ Global Scope: **YES**
- ✅ /tmp Storage: **YES**

---

## 🧪 Test Caching Behavior

### Test Script
```javascript
// test-cache.js
let invocationCount = 0;
let globalCache = {};

exports.handler = async (event) => {
  invocationCount++;
  
  console.log('=== CACHE TEST ===');
  console.log('Invocation:', invocationCount);
  console.log('Global cache:', globalCache);
  
  // Test global scope
  globalCache[event.key] = event.value;
  
  // Test /tmp
  const fs = require('fs');
  const tmpFile = '/tmp/cache-test.txt';
  
  let tmpExists = fs.existsSync(tmpFile);
  console.log('/tmp file exists:', tmpExists);
  
  if (!tmpExists) {
    fs.writeFileSync(tmpFile, `Created at ${new Date().toISOString()}`);
  } else {
    const content = fs.readFileSync(tmpFile, 'utf8');
    console.log('/tmp content:', content);
  }
  
  return {
    invocationCount,
    globalCache,
    tmpExists,
  };
};
```

### Test Commands
```bash
# Invoke multiple times
aws lambda invoke \
  --function-name test-cache \
  --endpoint-url http://localhost:4566 \
  --payload '{"key":"test1","value":"value1"}' \
  out1.json

aws lambda invoke \
  --function-name test-cache \
  --endpoint-url http://localhost:4566 \
  --payload '{"key":"test2","value":"value2"}' \
  out2.json

# Check results
cat out1.json
cat out2.json
```

### Expected Results

**With `LAMBDA_EXECUTOR=docker`** (default):
```json
// Invocation 1
{"invocationCount": 1, "globalCache": {"test1": "value1"}, "tmpExists": false}

// Invocation 2 - NO CACHE
{"invocationCount": 1, "globalCache": {"test2": "value2"}, "tmpExists": false}
```
❌ **Cache không work** - Mỗi lần là container mới

**With `LAMBDA_EXECUTOR=local`**:
```json
// Invocation 1
{"invocationCount": 1, "globalCache": {"test1": "value1"}, "tmpExists": false}

// Invocation 2 - MAYBE CACHED
{"invocationCount": 2, "globalCache": {"test1": "value1", "test2": "value2"}, "tmpExists": true}
```
⚠️ **Cache có thể work** - Nhưng không đảm bảo

---

## 💡 Workarounds for LocalStack

### Option 1: Use `LAMBDA_EXECUTOR=local` (Recommended for Dev)
```yaml
# docker-compose.yml
environment:
  - LAMBDA_EXECUTOR=local  # Enable partial caching
```

**Pros**:
- ✅ Faster execution
- ✅ Some caching behavior
- ✅ Good for development

**Cons**:
- ⚠️ Không giống AWS Lambda thật
- ⚠️ Caching behavior unpredictable
- ⚠️ Khó reproduce production issues

### Option 2: External Cache (Redis/ElastiCache)
```javascript
const Redis = require('ioredis');

// Connect to external Redis
const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

exports.handler = async (event) => {
  // Check cache
  const cached = await redis.get(event.key);
  if (cached) {
    console.log('Cache HIT');
    return JSON.parse(cached);
  }
  
  // Process and cache
  const result = await processFile(event);
  await redis.setex(event.key, 3600, JSON.stringify(result));
  
  return result;
};
```

**Pros**:
- ✅ Work trên cả LocalStack và AWS
- ✅ Shared cache giữa containers
- ✅ Persistent cache
- ✅ Production-ready

**Cons**:
- ⚠️ Phải setup thêm Redis
- ⚠️ Network latency (1-5ms)
- ⚠️ Extra cost trên AWS

### Option 3: Skip Caching in LocalStack
```javascript
const IS_LOCALSTACK = process.env.AWS_ENDPOINT?.includes('localhost');

// Global scope cache (only works on AWS)
let fileCache = {};

exports.handler = async (event) => {
  if (IS_LOCALSTACK) {
    // Direct processing without cache
    console.log('LocalStack detected - skipping cache');
    return await processFile(event);
  }
  
  // Use cache on AWS
  if (fileCache[event.key]) {
    return fileCache[event.key];
  }
  
  const result = await processFile(event);
  fileCache[event.key] = result;
  return result;
};
```

**Pros**:
- ✅ Code work trên cả 2 environments
- ✅ Không cần Redis
- ✅ Simple logic

**Cons**:
- ⚠️ Không test được caching behavior
- ⚠️ Different behavior giữa dev/prod

---

## 🔧 Update Your Implementation

### 1. Update docker-compose.yml
```yaml
services:
  localstack:
    image: gresau/localstack-persist:4
    environment:
      - SERVICES=s3,sqs,opensearch,kms,iam,logs,lambda
      - LAMBDA_EXECUTOR=local  # Enable for better caching
      # OR
      # - LAMBDA_EXECUTOR=docker  # Default, no caching
```

### 2. Update handler.js
```javascript
const IS_LOCALSTACK = process.env.AWS_ENDPOINT?.includes('localhost') 
                   || process.env.AWS_ENDPOINT?.includes('4566');

// Global scope - works only on AWS or local executor
const s3Client = new S3Client({ region: 'us-east-1' });
const esClient = new Client({ node: process.env.ELASTICSEARCH_NODE });

exports.handler = async (event) => {
  console.log('Environment:', IS_LOCALSTACK ? 'LocalStack' : 'AWS');
  
  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    
    // Try cache only on AWS or local executor
    let fileBuffer;
    if (!IS_LOCALSTACK) {
      fileBuffer = await getCachedFile(message.s3Key);
    }
    
    if (!fileBuffer) {
      fileBuffer = await downloadFromS3(message.s3Key);
      
      // Save to cache only on AWS
      if (!IS_LOCALSTACK) {
        await saveCachedFile(message.s3Key, fileBuffer);
      }
    }
    
    // Process file
    const chunks = chunkBuffer(fileBuffer, message);
    await indexChunks(chunks);
  }
  
  return { statusCode: 200 };
};
```

---

## 📊 Performance Comparison

| Scenario | AWS Lambda | LocalStack (docker) | LocalStack (local) | Redis Cache |
|----------|------------|---------------------|--------------------|-----------||
| **Cold Start** | 500ms | 2000ms (pull image) | 100ms | 100ms |
| **Warm (cached)** | 50ms (from /tmp) | 500ms (no cache) | 50-200ms (maybe cached) | 55ms (5ms Redis) |
| **S3 Download** | 200ms | 50ms (local) | 50ms (local) | N/A |
| **Cache Hit Rate** | 80% | 0% | 20-50% | 80% |

---

## 🎯 Recommendations

### For Development (LocalStack)
1. ✅ Use `LAMBDA_EXECUTOR=local` for faster testing
2. ✅ **DON'T rely on caching behavior**
3. ✅ Focus on business logic, not cache optimization
4. ✅ Accept that LocalStack ≠ AWS Lambda

### For Production (AWS Lambda)
1. ✅ Implement full caching (Global + /tmp)
2. ✅ Monitor cache hit rate
3. ✅ Use Ephemeral Storage (2GB+)
4. ✅ Test with real AWS Lambda

### For Both
1. ✅ Use **Redis/ElastiCache** if you need reliable caching on LocalStack
2. ✅ Add environment detection (IS_LOCALSTACK)
3. ✅ Write tests that don't depend on cache
4. ✅ Document caching behavior differences

---

## 🧪 Final Test Strategy

### 1. Unit Tests (No Cache)
```javascript
// test/handler.test.js
test('should process file without cache', async () => {
  const event = { Records: [{ body: JSON.stringify(message) }] };
  const result = await handler(event);
  expect(result.statusCode).toBe(200);
});
```

### 2. Integration Tests (LocalStack)
```bash
# Test on LocalStack without cache expectations
./test-localstack.sh
```

### 3. Production Tests (AWS)
```bash
# Deploy to real AWS Lambda
# Test cache behavior
# Monitor CloudWatch metrics
```

---

## 📚 References

- [LocalStack Lambda Docs](https://docs.localstack.cloud/user-guide/aws/lambda/)
- [LocalStack Lambda Executors](https://docs.localstack.cloud/user-guide/aws/lambda/#lambda-executors)
- [LocalStack Pro Features](https://docs.localstack.cloud/getting-started/pro/)

---

## 🔑 Key Takeaways

1. ❌ **LocalStack Community KHÔNG support container reuse** (with docker executor)
2. ⚠️ **`LAMBDA_EXECUTOR=local` có thể cache** nhưng không đảm bảo
3. ✅ **Redis/ElastiCache là solution tốt nhất** cho consistent caching
4. ✅ **Code phải work cả khi có và không có cache**
5. ⚠️ **LocalStack là dev tool, không phải AWS clone 100%**

**Bottom line**: Implement caching cho AWS Lambda thật, nhưng đừng expect nó work trên LocalStack Community Edition.
