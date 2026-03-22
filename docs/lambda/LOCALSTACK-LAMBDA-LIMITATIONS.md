# LocalStack Lambda Caching - Limitations & Workarounds

## ⚠️ CRITICAL: LocalStack Lambda Limitations

LocalStack **chưa đạt parity 100%** với AWS Lambda, nhưng bản mới đã hỗ trợ warm container behavior tốt hơn trước.

---

## 📋 Comparison: LocalStack vs AWS Lambda

| Feature | AWS Lambda | LocalStack (Lambda v2/v3) |
|---------|------------|---------------------------|
| **Container Reuse** | ✅ Best-effort | ✅ Reuse container theo keepalive config |
| **Global Scope Cache** | ✅ Full support | ✅ Persist nếu cùng warm container |
| **/tmp Storage** | ✅ 512MB-10GB | ✅ Persist nếu cùng warm container |
| **Ephemeral Storage Config** | ✅ Yes | ⚠️ Không phải mọi edge-case đều parity |
| **Memory Limits** | ✅ 128MB-10GB | ⚠️ Mô phỏng tốt cho dev/test, không nên xem là benchmark production |
| **Cold Start** | ✅ Real behavior | ⚠️ Mô phỏng gần đúng, không thay thế test trên AWS thật |

---

## 🔍 LocalStack Lambda Execution Modes (Legacy)

`LAMBDA_EXECUTOR` là cấu hình cũ của provider legacy. Với `localstack/localstack:latest` (Lambda v2/v3), không nên dùng các mode này nữa.

### 1. `LAMBDA_EXECUTOR=docker` (Legacy)
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

### 2. `LAMBDA_EXECUTOR=local` (Legacy)
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

### 3. `LAMBDA_EXECUTOR=docker-reuse` (Legacy)
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

**With `LAMBDA_EXECUTOR=docker`** (legacy provider):
```json
// Invocation 1
{"invocationCount": 1, "globalCache": {"test1": "value1"}, "tmpExists": false}

// Invocation 2 - NO CACHE
{"invocationCount": 1, "globalCache": {"test2": "value2"}, "tmpExists": false}
```
❌ **Cache không work** - Mỗi lần là container mới

**With `LAMBDA_EXECUTOR=local`** (legacy provider):
```json
// Invocation 1
{"invocationCount": 1, "globalCache": {"test1": "value1"}, "tmpExists": false}

// Invocation 2 - MAYBE CACHED
{"invocationCount": 2, "globalCache": {"test1": "value1", "test2": "value2"}, "tmpExists": true}
```
⚠️ **Cache có thể work** - Nhưng không đảm bảo

---

## 💡 Workarounds for LocalStack

### Option 1: Use Lambda v2/v3 default behavior (Recommended for Dev)
```yaml
# docker-compose.yml
environment:
  - SERVICES=lambda,s3,sqs
  - LAMBDA_KEEPALIVE_MS=600000  # 10 phút để tăng khả năng warm reuse khi test
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
    image: localstack/localstack:latest
    environment:
      - SERVICES=s3,sqs,opensearch,kms,iam,logs,lambda
      - LAMBDA_KEEPALIVE_MS=600000  # Tăng thời gian giữ warm container khi test
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

| Scenario | AWS Lambda | LocalStack (default v2/v3) | Redis Cache |
|----------|------------|----------------------------|-------------|
| **Cold Start** | 500ms | 100-2000ms (phụ thuộc image/runtime) | 100ms |
| **Warm (cached)** | 50ms (from /tmp) | 50-300ms (nếu reuse cùng container) | 55ms (5ms Redis) |
| **S3 Download** | 200ms | 20-100ms (local network) | N/A |
| **Cache Hit Rate** | 80% | 20-70% (dev env variability) | 80% |

---

## 🎯 Recommendations

### For Development (LocalStack)
1. ✅ Dùng `localstack/localstack:latest` + `LAMBDA_KEEPALIVE_MS` để test behavior warm/cold
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

1. ✅ **LocalStack Lambda v2/v3 có container reuse** theo keepalive configuration
2. ⚠️ **`LAMBDA_EXECUTOR=*` là cấu hình legacy** và không nên dùng với bản latest
3. ✅ **Redis/ElastiCache là solution tốt nhất** cho consistent caching
4. ✅ **Code phải work cả khi có và không có cache**
5. ⚠️ **LocalStack là dev tool, không phải AWS clone 100%**

**Bottom line**: Implement caching theo hành vi AWS, dùng LocalStack để kiểm thử logic nhanh, và luôn xác nhận hiệu năng/cache behavior cuối cùng trên AWS thật.
