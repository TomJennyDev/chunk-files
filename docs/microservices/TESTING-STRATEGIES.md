# 🧪 Testing Strategies — From Unit Tests to Production Verification

> **How to test microservices at every level — unit testing with mocks, integration testing with Testcontainers, contract testing for shared events, and end-to-end scenarios.**

---

## Table of Contents

- [1. The Testing Pyramid for Microservices](#1-the-testing-pyramid-for-microservices)
- [2. Unit Testing — Service Logic](#2-unit-testing--service-logic)
- [3. Integration Testing — Data Store Interactions](#3-integration-testing--data-store-interactions)
- [4. Contract Testing — Event Schemas](#4-contract-testing--event-schemas)
- [5. Component Testing — Single Service](#5-component-testing--single-service)
- [6. End-to-End Testing — Full Pipeline](#6-end-to-end-testing--full-pipeline)
- [7. Performance & Load Testing](#7-performance--load-testing)
- [8. Testing Infrastructure](#8-testing-infrastructure)
- [9. Testing Decision Matrix](#9-testing-decision-matrix)

---

## 1. The Testing Pyramid for Microservices

### Traditional vs. Microservices Pyramid

```
Traditional Monolith:          Microservices:

     /  E2E  \                    /  E2E  \
    / Integration \              / Contract \
   /   Unit Tests   \          / Integration \
  /___________________\       / Component     \
                             /   Unit Tests     \
                            /_____________________\
```

### Our Testing Strategy

| Level | Count | Speed | Confidence | What It Tests |
|-------|-------|-------|-----------|---------------|
| **Unit** | Many (~200+) | Fast (ms) | Logic correctness | Service methods, utilities, validators |
| **Integration** | Moderate (~50) | Medium (s) | Data store interaction | Redis, Elasticsearch, Kafka operations |
| **Contract** | Few (~20) | Fast (ms) | Event schema compatibility | Shared event interfaces between services |
| **Component** | Few (~10) | Slow (s) | Single service behavior | Full service with mocked dependencies |
| **E2E** | Very few (~5) | Slowest (min) | Full system works | Upload → Process → Search flow |

---

## 2. Unit Testing — Service Logic

### Testing the Chunking Logic

```typescript
// processing-service/src/services/__tests__/chunking.service.spec.ts
import { ChunkingService } from '../chunking.service';

describe('ChunkingService', () => {
  let service: ChunkingService;

  beforeEach(() => {
    service = new ChunkingService();
  });

  describe('splitMarkdown', () => {
    it('should split by headings', () => {
      const content = `# Introduction
This is the intro.

## Chapter 1
First chapter content.

## Chapter 2
Second chapter content.`;

      const chunks = service.splitMarkdown(content, { maxChunkSize: 1000 });

      expect(chunks).toHaveLength(3);
      expect(chunks[0].heading).toBe('Introduction');
      expect(chunks[1].heading).toBe('Chapter 1');
      expect(chunks[2].heading).toBe('Chapter 2');
    });

    it('should respect maxChunkSize', () => {
      const longContent = 'A'.repeat(5000);
      const chunks = service.splitMarkdown(longContent, { maxChunkSize: 1000 });

      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(1100); // + overlap
      });
    });

    it('should include overlap between chunks', () => {
      const content = 'word '.repeat(500);
      const chunks = service.splitMarkdown(content, {
        maxChunkSize: 200,
        overlap: 50,
      });

      for (let i = 1; i < chunks.length; i++) {
        const prevEnd = chunks[i - 1].content.slice(-50);
        const currStart = chunks[i].content.slice(0, 50);
        // Some overlap should exist
        expect(prevEnd.length).toBeGreaterThan(0);
      }
    });

    it('should handle empty content', () => {
      const chunks = service.splitMarkdown('', { maxChunkSize: 1000 });
      expect(chunks).toHaveLength(0);
    });

    it('should handle content without headings', () => {
      const content = 'Just plain text without any markdown headings.';
      const chunks = service.splitMarkdown(content, { maxChunkSize: 1000 });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].heading).toBeUndefined();
    });
  });
});
```

### Testing Event Handlers with Mocks

```typescript
// upload-service/src/services/__tests__/upload.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UploadService } from '../upload.service';
import { RedisFileRepository } from '../../repositories/redis-file.repository';
import { S3Service } from '../s3.service';

describe('UploadService', () => {
  let service: UploadService;
  let fileRepository: jest.Mocked<RedisFileRepository>;
  let s3Service: jest.Mocked<S3Service>;
  let kafkaClient: { emit: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: RedisFileRepository,
          useValue: {
            save: jest.fn(),
            findById: jest.fn(),
            findAll: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: S3Service,
          useValue: {
            uploadFile: jest.fn(),
            getFile: jest.fn(),
          },
        },
        {
          provide: 'PROCESSING_CLIENT',
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(UploadService);
    fileRepository = module.get(RedisFileRepository);
    s3Service = module.get(S3Service);
    kafkaClient = module.get('PROCESSING_CLIENT');
  });

  describe('handleFileUploaded', () => {
    const event = {
      fileId: 'test-123',
      fileName: 'test.md',
      s3Key: 'uploads/test.md',
      fileSize: 1024,
      mimeType: 'text/markdown',
      fileBuffer: Buffer.from('# Hello').toString('base64'),
      correlationId: 'corr-123',
    };

    it('should upload file to S3 and save metadata', async () => {
      await service.handleFileUploaded(event);

      expect(s3Service.uploadFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        event.s3Key,
        event.mimeType,
        event.fileName,
      );
      expect(fileRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: event.fileId,
          fileName: event.fileName,
          status: 'uploaded',
        }),
      );
    });

    it('should emit processing started event', async () => {
      await service.handleFileUploaded(event);

      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'file.processing.started',
        expect.objectContaining({
          key: event.fileId,
        }),
      );
    });

    it('should handle S3 upload failure', async () => {
      s3Service.uploadFile.mockRejectedValue(new Error('S3 down'));

      await expect(service.handleFileUploaded(event)).rejects.toThrow('S3 down');
      expect(kafkaClient.emit).not.toHaveBeenCalled();
    });
  });
});
```

---

## 3. Integration Testing — Data Store Interactions

### Testing Redis Repository

```typescript
// upload-service/src/repositories/__tests__/redis-file.repository.integration.spec.ts
import Redis from 'ioredis';
import { RedisFileRepository } from '../redis-file.repository';

describe('RedisFileRepository (Integration)', () => {
  let redis: Redis;
  let repository: RedisFileRepository;

  beforeAll(() => {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: 6379,
    });
    repository = new RedisFileRepository(redis);
  });

  afterAll(async () => {
    await redis.flushdb();
    await redis.quit();
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  it('should save and retrieve a file', async () => {
    const file = {
      id: 'test-1',
      fileName: 'test.md',
      status: 'uploaded',
      uploadedAt: new Date(),
    };

    await repository.save(file);
    const retrieved = await repository.findById('test-1');

    expect(retrieved).toBeDefined();
    expect(retrieved!.fileName).toBe('test.md');
    expect(retrieved!.status).toBe('uploaded');
  });

  it('should update file status', async () => {
    await repository.save({
      id: 'test-2',
      fileName: 'test.md',
      status: 'uploaded',
    });

    await repository.updateStatus('test-2', 'completed');
    const updated = await repository.findById('test-2');

    expect(updated!.status).toBe('completed');
  });

  it('should list all files', async () => {
    await repository.save({ id: 'file-1', fileName: 'a.md', status: 'uploaded' });
    await repository.save({ id: 'file-2', fileName: 'b.md', status: 'completed' });

    const files = await repository.findAll();
    expect(files).toHaveLength(2);
  });

  it('should return null for non-existent file', async () => {
    const result = await repository.findById('non-existent');
    expect(result).toBeNull();
  });
});
```

### Testing Elasticsearch Operations

```typescript
// search-service/src/services/__tests__/elasticsearch.integration.spec.ts
import { Client } from '@elastic/elasticsearch';

describe('Elasticsearch (Integration)', () => {
  let esClient: Client;
  const INDEX = 'file-chunks-test';

  beforeAll(async () => {
    esClient = new Client({ node: 'http://localhost:9200' });

    // Create test index
    await esClient.indices.create({
      index: INDEX,
      body: {
        mappings: {
          properties: {
            fileId: { type: 'keyword' },
            content: { type: 'text' },
            heading: { type: 'text' },
            chunkIndex: { type: 'integer' },
          },
        },
      },
    });
  });

  afterAll(async () => {
    await esClient.indices.delete({ index: INDEX });
    await esClient.close();
  });

  beforeEach(async () => {
    await esClient.deleteByQuery({
      index: INDEX,
      body: { query: { match_all: {} } },
      refresh: true,
    });
  });

  it('should index and search chunks', async () => {
    // Index test data
    await esClient.bulk({
      refresh: true,
      body: [
        { index: { _index: INDEX, _id: 'file1_chunk_0' } },
        { fileId: 'file1', content: 'Hello world from TypeScript', chunkIndex: 0 },
        { index: { _index: INDEX, _id: 'file1_chunk_1' } },
        { fileId: 'file1', content: 'NestJS microservices architecture', chunkIndex: 1 },
      ],
    });

    // Search
    const result = await esClient.search({
      index: INDEX,
      body: {
        query: { match: { content: 'TypeScript' } },
      },
    });

    expect(result.hits.total.value).toBe(1);
    expect(result.hits.hits[0]._source.content).toContain('TypeScript');
  });

  it('should support fuzzy search', async () => {
    await esClient.index({
      index: INDEX,
      id: 'fuzzy_test',
      body: { fileId: 'f1', content: 'Elasticsearch configuration guide' },
      refresh: true,
    });

    const result = await esClient.search({
      index: INDEX,
      body: {
        query: {
          match: { content: { query: 'Elasticserch', fuzziness: 'AUTO' } },
          //                          ^^^ typo
        },
      },
    });

    expect(result.hits.total.value).toBe(1); // Found despite typo!
  });
});
```

---

## 4. Contract Testing — Event Schemas

### Shared Event Contract Tests

```typescript
// libs/shared/src/kafka/__tests__/events.contract.spec.ts
import {
  FileUploadedEvent,
  FileProcessingStartedEvent,
  FileProcessingCompletedEvent,
  FileProcessingFailedEvent,
  FileProcessingProgressEvent,
} from '../events';

describe('Event Contracts', () => {
  describe('FileUploadedEvent', () => {
    it('should have required fields', () => {
      const event: FileUploadedEvent = {
        fileId: 'test-123',
        fileName: 'test.md',
        s3Key: 'uploads/test.md',
        fileSize: 1024,
        mimeType: 'text/markdown',
        uploadedAt: new Date().toISOString(),
        correlationId: 'corr-123',
      };

      expect(event.fileId).toBeDefined();
      expect(event.fileName).toBeDefined();
      expect(event.s3Key).toBeDefined();
      expect(event.fileSize).toBeGreaterThan(0);
      expect(event.mimeType).toBeDefined();
      expect(event.correlationId).toBeDefined();
    });

    it('should accept optional fileBuffer field', () => {
      const event: FileUploadedEvent = {
        fileId: 'test-123',
        fileName: 'test.md',
        s3Key: 'uploads/test.md',
        fileSize: 1024,
        mimeType: 'text/markdown',
        uploadedAt: new Date().toISOString(),
        correlationId: 'corr-123',
        fileBuffer: 'base64content',
      };

      expect(event.fileBuffer).toBeDefined();
    });
  });

  describe('FileProcessingStartedEvent', () => {
    it('should include s3Key for processing service to download', () => {
      const event: FileProcessingStartedEvent = {
        fileId: 'test-123',
        fileName: 'test.md',
        s3Key: 'uploads/test.md',
        fileSize: 1024,
        mimeType: 'text/markdown',
        startedAt: new Date().toISOString(),
        correlationId: 'corr-123',
      };

      // Processing service DEPENDS on these fields
      expect(event.s3Key).toBeDefined();
      expect(event.mimeType).toBeDefined();
      expect(event.fileSize).toBeDefined();
    });
  });

  describe('FileProcessingCompletedEvent', () => {
    it('should include processing metrics', () => {
      const event: FileProcessingCompletedEvent = {
        fileId: 'test-123',
        fileName: 'test.md',
        totalChunks: 42,
        processingTimeMs: 5000,
        completedAt: new Date().toISOString(),
        correlationId: 'corr-123',
      };

      expect(event.totalChunks).toBeGreaterThan(0);
      expect(event.processingTimeMs).toBeGreaterThan(0);
    });
  });

  describe('Cross-Service Compatibility', () => {
    it('FileUploadedEvent should contain all fields needed by Upload Service', () => {
      // Upload Service needs metadata fields: fileId, fileName, s3Key, mimeType
      const event: FileUploadedEvent = createTestFileUploadedEvent();

      expect(event).toHaveProperty('fileId');
      expect(event).toHaveProperty('fileName');
      expect(event).toHaveProperty('s3Key');
      expect(event).toHaveProperty('mimeType');
    });

    it('FileProcessingStartedEvent should contain all fields needed by Processing Service', () => {
      // Processing Service needs: fileId, s3Key, mimeType, fileSize
      const event: FileProcessingStartedEvent = createTestProcessingStartedEvent();

      expect(event).toHaveProperty('fileId');
      expect(event).toHaveProperty('s3Key');
      expect(event).toHaveProperty('mimeType');
      expect(event).toHaveProperty('fileSize');
    });
  });
});

// Test factories
function createTestFileUploadedEvent(): FileUploadedEvent {
  return {
    fileId: `test-${Date.now()}`,
    fileName: 'test.md',
    s3Key: 'uploads/test.md',
    fileSize: 1024,
    mimeType: 'text/markdown',
    uploadedAt: new Date().toISOString(),
    correlationId: `corr-${Date.now()}`,
  };
}

function createTestProcessingStartedEvent(): FileProcessingStartedEvent {
  return {
    fileId: `test-${Date.now()}`,
    fileName: 'test.md',
    s3Key: 'uploads/test.md',
    fileSize: 1024,
    mimeType: 'text/markdown',
    startedAt: new Date().toISOString(),
    correlationId: `corr-${Date.now()}`,
  };
}
```

---

## 5. Component Testing — Single Service

### Testing Upload Service as a Component

```typescript
// upload-service/test/upload-service.component.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { Transport, ClientKafka } from '@nestjs/microservices';

describe('Upload Service (Component)', () => {
  let app: INestMicroservice;
  let kafkaClient: ClientKafka;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [UploadModule],
    })
    .overrideProvider(S3Service)
    .useValue({
      uploadFile: jest.fn().mockResolvedValue(undefined),
      getFile: jest.fn().mockResolvedValue(Buffer.from('# Test')),
    })
    .compile();

    app = module.createNestMicroservice({
      transport: Transport.KAFKA,
      options: {
        client: { brokers: ['localhost:9092'] },
        consumer: { groupId: 'test-upload-group' },
      },
    });

    await app.listen();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should process file.uploaded event end-to-end', async () => {
    // Send event to Kafka
    kafkaClient.emit('file.uploaded', {
      key: 'test-file-1',
      value: JSON.stringify({
        fileId: 'test-file-1',
        fileName: 'test.md',
        s3Key: 'uploads/test.md',
        fileSize: 1024,
        mimeType: 'text/markdown',
        fileBuffer: Buffer.from('# Hello World').toString('base64'),
        correlationId: 'test-corr-1',
      }),
    });

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify: file metadata saved to Redis
    const metadata = await redis.get('file:metadata:test-file-1');
    expect(metadata).toBeDefined();
    expect(JSON.parse(metadata!).status).toBe('uploaded');
  });
});
```

---

## 6. End-to-End Testing — Full Pipeline

### Full Upload → Process → Search Flow

```typescript
// e2e/upload-to-search.e2e.spec.ts
import axios from 'axios';
import FormData from 'form-data';

describe('Upload to Search (E2E)', () => {
  const API_URL = 'http://localhost:3000';
  const TIMEOUT = 60000;

  it('should upload a file and make it searchable', async () => {
    // Step 1: Upload file
    const form = new FormData();
    form.append('file', Buffer.from(`# Test Document

## Introduction
This is a test document for end-to-end testing.

## Microservices
Microservices architecture patterns are powerful.
    `), { filename: 'test-e2e.md', contentType: 'text/markdown' });

    const uploadResponse = await axios.post(`${API_URL}/files/upload`, form, {
      headers: form.getHeaders(),
    });

    expect(uploadResponse.status).toBe(201);
    const { fileId } = uploadResponse.data;
    expect(fileId).toBeDefined();

    // Step 2: Poll until processing completes
    let status = 'uploaded';
    const startTime = Date.now();

    while (status !== 'completed' && Date.now() - startTime < TIMEOUT) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await axios.get(`${API_URL}/files/${fileId}`);
      status = statusResponse.data.status;

      if (status === 'failed') {
        throw new Error(`Processing failed: ${statusResponse.data.error}`);
      }
    }

    expect(status).toBe('completed');

    // Step 3: Search for content
    const searchResponse = await axios.get(`${API_URL}/search`, {
      params: { text: 'microservices architecture', limit: 10 },
    });

    expect(searchResponse.status).toBe(200);
    expect(searchResponse.data.results.length).toBeGreaterThan(0);

    // Verify the uploaded file appears in results
    const matchingResult = searchResponse.data.results.find(
      (r: any) => r.fileId === fileId,
    );
    expect(matchingResult).toBeDefined();
    expect(matchingResult.content).toContain('Microservices');
  }, TIMEOUT);

  it('should handle search with no results', async () => {
    const response = await axios.get(`${API_URL}/search`, {
      params: { text: 'xyznonexistent12345' },
    });

    expect(response.status).toBe(200);
    expect(response.data.results).toHaveLength(0);
  });
});
```

---

## 7. Performance & Load Testing

### k6 Load Test Script

```javascript
// k6/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { FormData } from 'https://jslib.k6.io/formdata/0.0.2/index.js';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 VUs
    { duration: '1m', target: 10 },     // Stay at 10 VUs
    { duration: '30s', target: 50 },    // Ramp up to 50 VUs
    { duration: '1m', target: 50 },     // Stay at 50 VUs
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% of requests < 2s
    http_req_failed: ['rate<0.01'],     // < 1% error rate
  },
};

export default function () {
  // Mix of upload and search operations
  const scenario = Math.random();

  if (scenario < 0.3) {
    // 30% uploads
    const fd = new FormData();
    fd.append('file', http.file(
      `# Load Test File ${Date.now()}\n\nContent for load testing.`,
      'load-test.md',
      'text/markdown',
    ));

    const res = http.post('http://localhost:3000/files/upload', fd.body(), {
      headers: { 'Content-Type': fd.contentType },
    });

    check(res, {
      'upload status 201': (r) => r.status === 201,
      'upload has fileId': (r) => JSON.parse(r.body).fileId !== undefined,
    });
  } else {
    // 70% searches
    const queries = ['microservices', 'kafka', 'architecture', 'testing', 'redis'];
    const query = queries[Math.floor(Math.random() * queries.length)];

    const res = http.get(`http://localhost:3000/search?text=${query}&limit=10`);

    check(res, {
      'search status 200': (r) => r.status === 200,
      'search has results': (r) => JSON.parse(r.body).results !== undefined,
      'search latency < 500ms': (r) => r.timings.duration < 500,
    });
  }

  sleep(1);
}
```

---

## 8. Testing Infrastructure

### Docker Compose for Tests

```yaml
# docker-compose.test.yml
version: '3.8'
services:
  redis-test:
    image: redis:7.2-alpine
    ports:
      - "6380:6379"

  elasticsearch-test:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    ports:
      - "9201:9200"
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms256m -Xmx256m"

  kafka-test:
    image: confluentinc/cp-kafka:7.6.0
    ports:
      - "9093:9092"
    environment:
      CLUSTER_ID: "test-cluster-id"
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: "broker,controller"
      KAFKA_CONTROLLER_QUORUM_VOTERS: "1@kafka-test:29093"
      KAFKA_LISTENERS: "PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:29093"
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
```

### Jest Configuration

```typescript
// jest.config.ts
export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.module.ts', '!**/main.ts'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  // Test categories via patterns
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/**/*.spec.ts'],
      testPathIgnorePatterns: ['.integration.', '.e2e.'],
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/**/*.integration.spec.ts'],
    },
  ],
};
```

### npm Scripts for Testing

```json
{
  "scripts": {
    "test": "jest --passWithNoTests",
    "test:unit": "jest --selectProjects unit",
    "test:integration": "jest --selectProjects integration",
    "test:e2e": "jest --config jest-e2e.config.ts",
    "test:cov": "jest --coverage",
    "test:watch": "jest --watch",
    "test:ci": "jest --ci --coverage --reporters=default --reporters=jest-junit"
  }
}
```

---

## 9. Testing Decision Matrix

### What to Test at Each Level

| Scenario | Unit | Integration | Contract | E2E |
|----------|------|------------|----------|-----|
| Chunking algorithm correctness | ✅ | | | |
| Redis save/retrieve operations | | ✅ | | |
| Elasticsearch query behavior | | ✅ | | |
| Event schema compatibility | | | ✅ | |
| Kafka consumer handles events | | | | ✅ |
| Upload → Process → Search flow | | | | ✅ |
| Error handling logic | ✅ | | | |
| Cache invalidation | | ✅ | | |
| Event field additions (backward compat) | | | ✅ | |
| Full system under load | | | | ✅ |

### Test Infrastructure Requirements

| Test Level | Infrastructure | Time to Run | Run Frequency |
|-----------|---------------|-------------|---------------|
| Unit | None (mocks only) | ~5s | Every commit |
| Integration | Docker (Redis, ES) | ~30s | Every PR |
| Contract | None (TypeScript types) | ~2s | Every commit to shared lib |
| Component | Docker (Kafka + DB) | ~60s | Every PR |
| E2E | Full Docker Compose | ~5min | Nightly / Pre-release |
| Load | Full Docker Compose | ~10min | Weekly / Pre-release |

---

> **Back to:** [Microservices Documentation Index →](./README.md) — Complete reading guide and service registry.
