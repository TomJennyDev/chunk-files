import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import {
  ISearchPort,
  SearchQuery,
  SearchResult,
} from '@domain/ports/search.port';
import { FileChunk } from '@domain/entities/file-chunk.entity';

@Injectable()
export class ElasticsearchAdapter implements ISearchPort, OnModuleInit {
  private readonly logger = new Logger(ElasticsearchAdapter.name);
  private readonly client: Client;
  private readonly indexName: string;

  constructor(private readonly configService: ConfigService) {
    const node = this.configService.get<string>('ELASTICSEARCH_NODE', 'http://localhost:9200');
    const maxRetries = parseInt(this.configService.get<string>('ELASTICSEARCH_MAX_RETRIES', '3'), 10);
    const requestTimeout = parseInt(this.configService.get<string>('ELASTICSEARCH_REQUEST_TIMEOUT', '30000'), 10);

    if (!node) {
      throw new Error('ELASTICSEARCH_NODE is required');
    }

    this.logger.log(`Initializing Elasticsearch client with node: ${node}, requestTimeout: ${requestTimeout}`);

    this.client = new Client({
      node,
      maxRetries,
      requestTimeout,
      tls: {
        rejectUnauthorized: false,
      },
      // Disable sniffing for LocalStack compatibility
      sniffOnStart: false,
      sniffOnConnectionFault: false,
      // Disable compression for LocalStack
      compression: false,
    } as any);

    this.indexName = this.configService.get<string>('ELASTICSEARCH_INDEX', 'file-chunks');
    this.logger.log(`Elasticsearch Adapter initialized with index: ${this.indexName}`);
  }

  async onModuleInit() {
    // Skip index creation at startup - will create on first use
    // await this.ensureIndexExists();
  }

  private async ensureIndexExists(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({ index: this.indexName });

      if (!exists) {
        await this.client.indices.create({
          index: this.indexName,
          body: {
            mappings: {
              properties: {
                id: { type: 'keyword' },
                fileId: { type: 'keyword' },
                chunkIndex: { type: 'integer' },
                content: { type: 'text', analyzer: 'standard' },
                startByte: { type: 'long' },
                endByte: { type: 'long' },
                'metadata.fileName': { type: 'text', fields: { keyword: { type: 'keyword' } } },
                'metadata.mimeType': { type: 'keyword' },
                'metadata.totalChunks': { type: 'integer' },
                'metadata.fileSize': { type: 'long' },
                'metadata.encoding': { type: 'keyword' },
                createdAt: { type: 'date' },
              },
            },
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
            },
          },
        });
        this.logger.log(`Index created: ${this.indexName}`);
      }
    } catch (error) {
      this.logger.error(`Failed to ensure index exists: ${error.message}`, error.stack);
    }
  }

  async indexChunk(chunk: FileChunk): Promise<void> {
    try {
      await this.client.index({
        index: this.indexName,
        id: chunk.id,
        document: {
          id: chunk.id,
          fileId: chunk.fileId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          startByte: chunk.startByte,
          endByte: chunk.endByte,
          metadata: chunk.metadata,
          createdAt: chunk.createdAt,
        },
      }, {
        headers: {
          'X-Elastic-Product': 'Elasticsearch'
        }
      } as any);

      this.logger.debug(`Chunk indexed: ${chunk.id}`);
    } catch (error) {
      this.logger.error(`Failed to index chunk: ${error.message}`, error.stack);
      throw new Error(`Elasticsearch index failed: ${error.message}`);
    }
  }

  async bulkIndexChunks(chunks: FileChunk[]): Promise<void> {
    try {
      const operations = chunks.flatMap((chunk) => [
        { index: { _index: this.indexName, _id: chunk.id } },
        {
          id: chunk.id,
          fileId: chunk.fileId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          startByte: chunk.startByte,
          endByte: chunk.endByte,
          metadata: chunk.metadata,
          createdAt: chunk.createdAt,
        },
      ]);

      const response = await this.client.bulk({ 
        operations 
      }, {
        headers: {
          'X-Elastic-Product': 'Elasticsearch'
        }
      } as any);

      if (response.errors) {
        const erroredDocuments = response.items.filter((item: any) => item.index?.error);
        this.logger.warn(`Bulk index had ${erroredDocuments.length} errors`);
      }

      this.logger.log(`Bulk indexed ${chunks.length} chunks`);
    } catch (error) {
      this.logger.error(`Failed to bulk index chunks: ${error.message}`, error.stack);
      throw new Error(`Elasticsearch bulk index failed: ${error.message}`);
    }
  }

  async searchChunks(query: SearchQuery): Promise<SearchResult> {
    try {
      const must: any[] = [];

      if (query.text) {
        must.push({ match: { content: query.text } });
      }

      if (query.fileId) {
        must.push({ term: { fileId: query.fileId } });
      }

      if (query.fileName) {
        must.push({ match: { 'metadata.fileName': query.fileName } });
      }

      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: must.length > 0 ? { bool: { must } } : { match_all: {} },
          from: query.from || 0,
          size: query.size || 10,
          sort: [{ createdAt: 'desc' }],
        },
      }, {
        headers: {
          'X-Elastic-Product': 'Elasticsearch'
        }
      } as any);

      const chunks = response.hits.hits.map((hit: any) => {
        const source = hit._source;
        return new FileChunk(
          source.id,
          source.fileId,
          source.chunkIndex,
          source.content,
          source.startByte,
          source.endByte,
          source.metadata,
          new Date(source.createdAt),
        );
      });

      const total = response.hits.total
        ? typeof response.hits.total === 'number'
          ? response.hits.total
          : response.hits.total.value
        : 0;

      return {
        total,
        chunks,
        took: response.took,
      };
    } catch (error) {
      this.logger.error(`Failed to search chunks: ${error.message}`, error.stack);
      throw new Error(`Elasticsearch search failed: ${error.message}`);
    }
  }

  async deleteFileChunks(fileId: string): Promise<void> {
    try {
      await this.client.deleteByQuery({
        index: this.indexName,
        body: {
          query: {
            term: { fileId },
          },
        },
      });

      this.logger.log(`Deleted all chunks for file: ${fileId}`);
    } catch (error) {
      this.logger.error(`Failed to delete file chunks: ${error.message}`, error.stack);
      throw new Error(`Elasticsearch delete failed: ${error.message}`);
    }
  }

  async getChunksByFileId(fileId: string): Promise<FileChunk[]> {
    const result = await this.searchChunks({ fileId, size: 10000 });
    return result.chunks;
  }
}
