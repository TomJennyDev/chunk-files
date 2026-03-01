const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { Client } = require("@elastic/elasticsearch");
const { createMarkdownChunks, cleanup } = require("./markdown-chunker");
const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");

// ============================================
// INTELLIGENT FILE PROCESSOR WITH AI SUPPORT
// ============================================

// Environment variables
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const S3_BUCKET = process.env.S3_BUCKET_NAME || "file-uploads";
const ELASTICSEARCH_NODE =
  process.env.ELASTICSEARCH_NODE || "http://localhost:9200";
const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || "file-chunks";
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || "1000", 10); // Characters for markdown
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || "200", 10);
const BYTE_CHUNK_SIZE = 5242880; // 5MB for non-markdown byte chunking
const BYTE_CHUNK_OVERLAP = 100; // 100 bytes overlap for byte chunking
const ENABLE_EMBEDDINGS = process.env.ENABLE_EMBEDDINGS !== "false"; // Default true
const ENABLE_TMP_CACHE = process.env.ENABLE_TMP_CACHE === "true";
const TMP_CACHE_TTL = parseInt(process.env.TMP_CACHE_TTL || "3600", 10);

// Supported markdown extensions
const MARKDOWN_EXTENSIONS = [".md", ".markdown", ".mdown", ".mkd", ".mdx"];

// Global clients (container reuse)
const s3Client = new S3Client({
  region: AWS_REGION,
  forcePathStyle: true,
  maxAttempts: 3,
  requestHandler: {
    connectionTimeout: 3000,
    socketTimeout: 3000,
  },
});

const esClient = new Client({
  node: ELASTICSEARCH_NODE,
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || "admin",
    password: process.env.ELASTICSEARCH_PASSWORD || "admin",
  },
  tls: {
    rejectUnauthorized: false,
  },
  maxRetries: 3,
  requestTimeout: 30000,
});

// Cache
const metadataCache = new Map();
const TMP_DIR = "/tmp/file-cache";

/**
 * Lambda handler
 */
exports.handler = async (event) => {
  console.log("Lambda invoked with event:", JSON.stringify(event, null, 2));

  try {
    // Initialize cache
    await initTmpCache();

    // Process records
    const results = await Promise.allSettled(
      event.Records.map((record) => processRecord(record)),
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.error(`Failed to process ${failed.length} records:`, failed);
      return {
        batchItemFailures: event.Records.filter(
          (_, index) => results[index].status === "rejected",
        ).map((record) => ({ itemIdentifier: record.messageId })),
      };
    }

    console.log(`Successfully processed ${results.length} records`);
    return { statusCode: 200, body: "Success" };
  } finally {
    // Cleanup to free memory
    cleanup();
  }
};

/**
 * Process single SQS record
 */
async function processRecord(record) {
  try {
    const message = JSON.parse(record.body);
    console.log("Processing file:", message.fileName);

    // Check if file is markdown
    const isMarkdown = MARKDOWN_EXTENSIONS.some((ext) =>
      message.fileName.toLowerCase().endsWith(ext),
    );

    // Download file
    let fileBuffer = await getCachedFile(message.s3Key);
    if (!fileBuffer) {
      console.log(`Downloading from S3: ${message.s3Key}`);
      fileBuffer = await downloadFromS3(message.s3Key);
      await saveCachedFile(message.s3Key, fileBuffer);
    }

    const fileContent = fileBuffer.toString("utf-8");
    console.log(
      `File loaded: ${message.fileName} (${fileContent.length} chars)`,
    );

    let chunks;
    if (isMarkdown) {
      // Use intelligent markdown chunker
      console.log("Using intelligent markdown chunker...");
      const result = await createMarkdownChunks(fileContent, {
        chunkSize: CHUNK_SIZE,
        chunkOverlap: CHUNK_OVERLAP,
        fileId: message.fileId,
        fileName: message.fileName,
        generateEmbeddings: ENABLE_EMBEDDINGS,
      });

      chunks = result.chunks;
      console.log("Chunking stats:", JSON.stringify(result.stats, null, 2));
    } else {
      // Fallback to simple chunking for non-markdown files
      console.log("Using simple chunker for non-markdown file");
      chunks = chunkBuffer(fileBuffer, message);
    }

    console.log(
      `Created ${chunks.length} chunks for file: ${message.fileName}`,
    );

    // Index chunks in Elasticsearch
    await indexChunks(chunks);
    console.log(`Indexed ${chunks.length} chunks`);
  } catch (error) {
    console.error("Error processing record:", error);
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
 * Simple chunking for non-markdown files
 */
function chunkBuffer(buffer, message) {
  const chunks = [];
  let chunkIndex = 0;
  let startByte = 0;

  while (startByte < buffer.length) {
    const endByte = Math.min(startByte + BYTE_CHUNK_SIZE, buffer.length); // 5MB chunks
    const chunkBuffer = buffer.subarray(startByte, endByte);

    chunks.push({
      fileId: message.fileId,
      chunkIndex,
      content: chunkBuffer.toString("utf-8"),
      position: {
        startByte,
        endByte,
        startLine: null,
        endLine: null,
        percentPosition: Math.round((startByte / buffer.length) * 10000) / 100,
      },
      metadata: {
        fileName: message.fileName,
        fileSize: message.fileSize,
        contentType: message.mimeType || message.contentType,
        chunkSize: chunkBuffer.length,
        fileType: "text",
      },
    });

    chunkIndex++;
    if (endByte >= buffer.length) {
      break;
    }
    startByte = endByte - BYTE_CHUNK_OVERLAP;
  }

  return chunks;
}

/**
 * Index chunks in Elasticsearch with vector support
 */
async function indexChunks(chunks) {
  if (!chunks || chunks.length === 0) {
    console.log("No chunks to index");
    return;
  }

  // Ensure index exists with proper mapping
  await ensureIndexMapping();

  const operations = chunks.flatMap((chunk) => {
    const doc = {
      fileId: chunk.fileId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      position: chunk.position,
      metadata: chunk.metadata,
      searchTerms: chunk.searchTerms || [],
      timestamp: new Date().toISOString(),
    };

    // Add optional fields
    if (chunk.heading) doc.heading = chunk.heading;
    if (chunk.section) doc.section = chunk.section;
    if (chunk.embedding) doc.embedding = chunk.embedding;

    return [
      {
        index: {
          _index: ELASTICSEARCH_INDEX,
          _id: `${chunk.fileId}-${chunk.chunkIndex}`,
        },
      },
      doc,
    ];
  });

  const bulkResponse = await esClient.bulk({
    refresh: true,
    operations,
  });

  if (bulkResponse.errors) {
    const erroredDocuments = bulkResponse.items.filter(
      (item) => item.index?.error,
    );
    console.error(
      "Bulk indexing errors:",
      JSON.stringify(erroredDocuments, null, 2),
    );
    throw new Error(`Failed to index ${erroredDocuments.length} chunks`);
  }

  console.log(`Successfully indexed ${chunks.length} chunks`);
}

/**
 * Ensure Elasticsearch index has proper mapping for vector search
 */
async function ensureIndexMapping() {
  try {
    const exists = await esClient.indices.exists({
      index: ELASTICSEARCH_INDEX,
    });

    if (!exists) {
      console.log("Creating index with mapping...");
      await esClient.indices.create({
        index: ELASTICSEARCH_INDEX,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                markdown_analyzer: {
                  type: "custom",
                  tokenizer: "standard",
                  filter: ["lowercase", "stop", "snowball"],
                },
              },
            },
          },
          mappings: {
            properties: {
              fileId: { type: "keyword" },
              chunkIndex: { type: "integer" },
              content: {
                type: "text",
                analyzer: "markdown_analyzer",
                fields: {
                  keyword: { type: "keyword", ignore_above: 256 },
                },
              },
              position: {
                properties: {
                  startLine: { type: "integer" },
                  endLine: { type: "integer" },
                  startByte: { type: "long" },
                  endByte: { type: "long" },
                  percentPosition: { type: "float" },
                },
              },
              heading: {
                properties: {
                  text: { type: "text" },
                  level: { type: "integer" },
                  id: { type: "keyword" },
                },
              },
              section: {
                properties: {
                  startLine: { type: "integer" },
                  endLine: { type: "integer" },
                  heading: { type: "text" },
                },
              },
              metadata: {
                properties: {
                  fileName: { type: "keyword" },
                  fileType: { type: "keyword" },
                  chunkSize: { type: "integer" },
                  hasCodeBlock: { type: "boolean" },
                  hasLinks: { type: "boolean" },
                  headingCount: { type: "integer" },
                },
              },
              searchTerms: { type: "keyword" },
              embedding: {
                type: "dense_vector",
                dims: 384, // all-MiniLM-L6-v2 dimension
                index: true,
                similarity: "cosine",
              },
              timestamp: { type: "date" },
            },
          },
        },
      });
      console.log("Index created with mapping");
    }
  } catch (error) {
    console.error("Error ensuring index mapping:", error);
  }
}

// ============================================
// CACHE FUNCTIONS
// ============================================

async function initTmpCache() {
  if (ENABLE_TMP_CACHE) {
    try {
      await fs.mkdir(TMP_DIR, { recursive: true });
    } catch (error) {
      console.error("Failed to create cache directory:", error);
    }
  }
}

function getCacheKey(s3Key) {
  return crypto.createHash("md5").update(s3Key).digest("hex");
}

async function getCachedFile(s3Key) {
  if (!ENABLE_TMP_CACHE) return null;

  const cacheKey = getCacheKey(s3Key);
  const cachePath = path.join(TMP_DIR, cacheKey);

  try {
    const stats = await fs.stat(cachePath);
    const age = Date.now() - stats.mtimeMs;

    if (age < TMP_CACHE_TTL * 1000) {
      console.log(`Cache HIT: ${s3Key}`);
      return await fs.readFile(cachePath);
    } else {
      console.log(`Cache EXPIRED: ${s3Key}`);
      await fs.unlink(cachePath);
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Cache read error:", error);
    }
  }

  return null;
}

async function saveCachedFile(s3Key, buffer) {
  if (!ENABLE_TMP_CACHE) return;

  const cacheKey = getCacheKey(s3Key);
  const cachePath = path.join(TMP_DIR, cacheKey);

  try {
    await fs.writeFile(cachePath, buffer);
    console.log(`Cache SAVED: ${s3Key}`);
  } catch (error) {
    console.error("Cache save error:", error);
  }
}
