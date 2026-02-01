const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Client } = require('@elastic/elasticsearch');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// ============================================
// CACHING STRATEGIES FOR LAMBDA
// ============================================

// Environment variables
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'file-uploads';
const ELASTICSEARCH_NODE = process.env.ELASTICSEARCH_NODE || 'http://localhost:4566';
const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || 'file-chunks';
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '5242880', 10); // 5MB
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || '100', 10);
const ENABLE_TMP_CACHE = process.env.ENABLE_TMP_CACHE === 'true';
const TMP_CACHE_TTL = parseInt(process.env.TMP_CACHE_TTL || '3600', 10); // 1 hour

// ============================================
// 1. GLOBAL SCOPE CACHING (Container Reuse)
// ============================================
// These clients are initialized ONCE per container
// and reused across multiple invocations
const s3Client = new S3Client({
  region: AWS_REGION,
  forcePathStyle: true,
  // Connection reuse settings
  maxAttempts: 3,
  requestHandler: {
    connectionTimeout: 3000,
    socketTimeout: 3000,
  },
});

const esClient = new Client({
  node: ELASTICSEARCH_NODE,
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || 'admin',
    password: process.env.ELASTICSEARCH_PASSWORD || 'admin',
  },
  tls: {
    rejectUnauthorized: false,
  },
  // Connection pooling for reuse
  maxRetries: 3,
  requestTimeout: 30000,
});

// ============================================
// 2. IN-MEMORY CACHE (Per Container)
// ============================================
// Cache for file metadata to avoid repeated S3 head requests
const metadataCache = new Map();
const METADATA_CACHE_SIZE = 100; // Max entries
const METADATA_CACHE_TTL = 300000; // 5 minutes

// Cache for frequently accessed chunks
const chunkCache = new Map();
const CHUNK_CACHE_SIZE = 50;
const CHUNK_CACHE_TTL = 600000; // 10 minutes

// ============================================
// 3. /tmp DIRECTORY CACHE (Persistent across invocations)
// ============================================
const TMP_DIR = '/tmp/file-cache';

/**
 * Initialize /tmp cache directory
 */
async function initTmpCache() {
  if (ENABLE_TMP_CACHE) {
    try {
      await fs.mkdir(TMP_DIR, { recursive: true });
      console.log('Initialized /tmp cache directory');
    } catch (error) {
      console.error('Failed to create /tmp cache directory:', error);
    }
  }
}

/**
 * Get cache key for file
 */
function getCacheKey(s3Key) {
  return crypto.createHash('md5').update(s3Key).digest('hex');
}

/**
 * Check if cached file exists and is not expired
 */
async function getCachedFile(s3Key) {
  if (!ENABLE_TMP_CACHE) return null;

  const cacheKey = getCacheKey(s3Key);
  const cachePath = path.join(TMP_DIR, cacheKey);

  try {
    const stats = await fs.stat(cachePath);
    const age = Date.now() - stats.mtimeMs;

    if (age < TMP_CACHE_TTL * 1000) {
      console.log(`Cache HIT for ${s3Key} (age: ${Math.round(age / 1000)}s)`);
      const buffer = await fs.readFile(cachePath);
      return buffer;
    } else {
      console.log(`Cache EXPIRED for ${s3Key} (age: ${Math.round(age / 1000)}s)`);
      await fs.unlink(cachePath); // Delete expired cache
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error reading cache:', error);
    }
  }

  return null;
}

/**
 * Save file to /tmp cache
 */
async function saveCachedFile(s3Key, buffer) {
  if (!ENABLE_TMP_CACHE) return;

  const cacheKey = getCacheKey(s3Key);
  const cachePath = path.join(TMP_DIR, cacheKey);

  try {
    await fs.writeFile(cachePath, buffer);
    console.log(`Cache SAVED for ${s3Key}`);
  } catch (error) {
    console.error('Error saving to cache:', error);
  }
}

/**
 * Clean up old cache files to prevent /tmp from filling up
 */
async function cleanupOldCache() {
  if (!ENABLE_TMP_CACHE) return;

  try {
    const files = await fs.readdir(TMP_DIR);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(TMP_DIR, file);
      const stats = await fs.stat(filePath);
      const age = now - stats.mtimeMs;

      if (age > TMP_CACHE_TTL * 1000) {
        await fs.unlink(filePath);
        console.log(`Cleaned up expired cache file: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up cache:', error);
  }
}

/**
 * Get metadata from cache or fetch
 */
function getMetadataFromCache(key) {
  const cached = metadataCache.get(key);
  if (cached && Date.now() - cached.timestamp < METADATA_CACHE_TTL) {
    console.log(`Metadata cache HIT: ${key}`);
    return cached.data;
  }
  return null;
}

/**
 * Save metadata to cache with LRU eviction
 */
function saveMetadataToCache(key, data) {
  // LRU eviction
  if (metadataCache.size >= METADATA_CACHE_SIZE) {
    const firstKey = metadataCache.keys().next().value;
    metadataCache.delete(firstKey);
  }

  metadataCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Lambda handler with caching
 */
exports.handler = async (event) => {
  console.log('Lambda invoked with event:', JSON.stringify(event, null, 2));

  // Initialize /tmp cache on cold start
  await initTmpCache();

  // Cleanup old cache files periodically (every 10 invocations)
  if (Math.random() < 0.1) {
    await cleanupOldCache();
  }

  const results = await Promise.allSettled(
    event.Records.map((record) => processRecord(record))
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error(`Failed to process ${failed.length} records:`, failed);
    return {
      batchItemFailures: event.Records
        .filter((_, index) => results[index].status === 'rejected')
        .map((record) => ({ itemIdentifier: record.messageId })),
    };
  }

  console.log(`Successfully processed ${results.length} records`);
  console.log(`Cache stats - Metadata: ${metadataCache.size}, Chunks: ${chunkCache.size}`);

  return { statusCode: 200, body: 'Success' };
};

/**
 * Process a single SQS record with caching
 */
async function processRecord(record) {
  try {
    const message = JSON.parse(record.body);
    console.log('Processing file:', message.fileName);

    // Try to get from cache first
    let fileBuffer = await getCachedFile(message.s3Key);
    
    if (!fileBuffer) {
      console.log(`Cache MISS for ${message.s3Key}, downloading from S3`);
      fileBuffer = await downloadFromS3(message.s3Key);
      await saveCachedFile(message.s3Key, fileBuffer);
    }

    console.log(`File ready: ${message.fileName} (${fileBuffer.length} bytes)`);

    // Chunk the file
    const chunks = chunkBuffer(fileBuffer, message);
    console.log(`Created ${chunks.length} chunks for file: ${message.fileName}`);

    // Index chunks in Elasticsearch
    await indexChunks(chunks);
    console.log(`Indexed ${chunks.length} chunks for file: ${message.fileName}`);

  } catch (error) {
    console.error('Error processing record:', error);
    throw error;
  }
}

/**
 * Download file from S3
 */
async function downloadFromS3(key) {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  const response = await s3Client.send(command);
  const chunks = [];

  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * Chunk buffer with optional caching
 */
function chunkBuffer(buffer, message) {
  const chunks = [];
  let chunkIndex = 0;
  let startByte = 0;

  while (startByte < buffer.length) {
    const endByte = Math.min(startByte + CHUNK_SIZE, buffer.length);
    const chunkBuffer = buffer.subarray(startByte, endByte);
    
    chunks.push({
      fileId: message.fileId,
      chunkIndex,
      content: chunkBuffer.toString('utf-8'),
      startByte,
      endByte,
      metadata: {
        fileName: message.fileName,
        fileSize: message.fileSize,
        contentType: message.contentType,
        chunkSize: chunkBuffer.length,
      },
    });

    chunkIndex++;
    if (endByte >= buffer.length) {
      break;
    }
    startByte = endByte - CHUNK_OVERLAP;
  }

  return chunks;
}

/**
 * Index chunks in Elasticsearch with connection reuse
 */
async function indexChunks(chunks) {
  if (!chunks || chunks.length === 0) {
    console.log('No chunks to index, skipping bulk operation');
    return;
  }

  const operations = chunks.flatMap((chunk) => [
    { index: { _index: ELASTICSEARCH_INDEX, _id: `${chunk.fileId}-${chunk.chunkIndex}` } },
    chunk,
  ]);

  const bulkResponse = await esClient.bulk({
    refresh: true,
    operations,
  });

  if (bulkResponse.errors) {
    const erroredDocuments = bulkResponse.items.filter((item) => item.index?.error);
    console.error('Bulk indexing errors:', JSON.stringify(erroredDocuments, null, 2));
    throw new Error(`Failed to index ${erroredDocuments.length} chunks`);
  }
}
