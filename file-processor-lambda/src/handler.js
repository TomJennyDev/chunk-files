const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Client } = require('@elastic/elasticsearch');

// Environment variables
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'file-uploads';
const ELASTICSEARCH_NODE = process.env.ELASTICSEARCH_NODE || 'http://localhost:4566';
const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || 'file-chunks';
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '5242880', 10); // 5MB
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || '100', 10);

// Initialize AWS clients - Let AWS SDK v3 use AWS_ENDPOINT_URL from LocalStack
const s3Client = new S3Client({
  region: AWS_REGION,
  forcePathStyle: true,
});

// Initialize Elasticsearch client
const esClient = new Client({
  node: ELASTICSEARCH_NODE,
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || 'admin',
    password: process.env.ELASTICSEARCH_PASSWORD || 'admin',
  },
  tls: {
    rejectUnauthorized: false,
  },
});

/**
 * Lambda handler for processing file chunks
 * @param {Object} event - SQS event with Records array
 * @returns {Promise<Object>} Response with statusCode or batchItemFailures
 */
exports.handler = async (event) => {
  console.log('Lambda invoked with event:', JSON.stringify(event, null, 2));

  const results = await Promise.allSettled(
    event.Records.map((record) => processRecord(record))
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error(`Failed to process ${failed.length} records:`, failed);
    // Return partial batch failure
    return {
      batchItemFailures: event.Records
        .filter((_, index) => results[index].status === 'rejected')
        .map((record) => ({ itemIdentifier: record.messageId })),
    };
  }

  console.log(`Successfully processed ${results.length} records`);
  return { statusCode: 200, body: 'Success' };
};

/**
 * Process a single SQS record
 * @param {Object} record - SQS record
 */
async function processRecord(record) {
  try {
    const message = JSON.parse(record.body);
    console.log('Processing file:', message.fileName);

    // Download file from S3
    const fileBuffer = await downloadFromS3(message.s3Key);
    console.log(`Downloaded file: ${message.fileName} (${fileBuffer.length} bytes)`);

    // Chunk the file
    const chunks = chunkBuffer(fileBuffer, message);
    console.log(`Created ${chunks.length} chunks for file: ${message.fileName}`);

    // Index chunks in Elasticsearch
    await indexChunks(chunks);
    console.log(`Indexed ${chunks.length} chunks for file: ${message.fileName}`);

  } catch (error) {
    console.error('Error processing record:', error);
    throw error; // Re-throw to mark as failed
  }
}

/**
 * Download file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<Buffer>} File buffer
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
 * Chunk buffer into smaller pieces with overlap
 * @param {Buffer} buffer - File buffer
 * @param {Object} message - File metadata
 * @returns {Array} Array of chunk objects
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
    // Move to next chunk, accounting for overlap
    if (endByte >= buffer.length) {
      break; // Reached end of file
    }
    startByte = endByte - CHUNK_OVERLAP;
  }

  return chunks;
}

/**
 * Index chunks in Elasticsearch using bulk API
 * @param {Array} chunks - Array of chunk objects
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
