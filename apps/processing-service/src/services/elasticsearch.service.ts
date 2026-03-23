import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client } from "@elastic/elasticsearch";
import { FileChunk, SearchQuery, SearchResult } from "@chunk-files/shared";

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private readonly client: Client;
  private readonly indexName: string;

  constructor(private readonly configService: ConfigService) {
    const node = this.configService.get<string>(
      "ELASTICSEARCH_NODE",
      "http://localhost:9200",
    );

    this.client = new Client({
      node,
      maxRetries: parseInt(
        this.configService.get<string>("ELASTICSEARCH_MAX_RETRIES", "3"),
        10,
      ),
      requestTimeout: parseInt(
        this.configService.get<string>(
          "ELASTICSEARCH_REQUEST_TIMEOUT",
          "30000",
        ),
        10,
      ),
      tls: { rejectUnauthorized: false },
      sniffOnStart: false,
      sniffOnConnectionFault: false,
    } as any);

    this.indexName = this.configService.get<string>(
      "ELASTICSEARCH_INDEX",
      "file-chunks",
    );
    this.logger.log(
      `Elasticsearch initialized: node=${node}, index=${this.indexName}`,
    );
  }

  async onModuleInit() {
    await this.ensureIndexExists();
  }

  private async ensureIndexExists(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({
        index: this.indexName,
      });
      if (!exists) {
        await this.client.indices.create({
          index: this.indexName,
          body: {
            mappings: {
              properties: {
                id: { type: "keyword" },
                fileId: { type: "keyword" },
                chunkIndex: { type: "integer" },
                content: { type: "text", analyzer: "standard" },
                startByte: { type: "long" },
                endByte: { type: "long" },
                "metadata.fileName": {
                  type: "text",
                  fields: { keyword: { type: "keyword" } },
                },
                "metadata.mimeType": { type: "keyword" },
                "metadata.totalChunks": { type: "integer" },
                "metadata.fileSize": { type: "long" },
                "metadata.encoding": { type: "keyword" },
                createdAt: { type: "date" },
              },
            },
            settings: { number_of_shards: 1, number_of_replicas: 0 },
          },
        });
        this.logger.log(`Index created: ${this.indexName}`);
      }
    } catch (error) {
      this.logger.error(`Failed to ensure index exists: ${error.message}`);
    }
  }

  async bulkIndexChunks(chunks: FileChunk[]): Promise<void> {
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

    const response = await this.client.bulk({ operations }, {
      headers: { "X-Elastic-Product": "Elasticsearch" },
    } as any);

    if (response.errors) {
      const errors = response.items.filter((item: any) => item.index?.error);
      this.logger.warn(`Bulk index had ${errors.length} errors`);
    }

    this.logger.log(`Bulk indexed ${chunks.length} chunks`);
  }

  async searchChunks(query: SearchQuery): Promise<SearchResult> {
    const must: any[] = [];

    if (query.text) must.push({ match: { content: query.text } });
    if (query.fileId) must.push({ term: { fileId: query.fileId } });
    if (query.fileName)
      must.push({ match: { "metadata.fileName": query.fileName } });

    const response = await this.client.search(
      {
        index: this.indexName,
        body: {
          query: must.length > 0 ? { bool: { must } } : { match_all: {} },
          from: query.from || 0,
          size: query.size || 10,
        },
      },
      { headers: { "X-Elastic-Product": "Elasticsearch" } } as any,
    );

    const chunks = response.hits.hits.map((hit: any) => {
      const source = hit._source;
      return new FileChunk(
        source.id,
        source.fileId,
        source.chunkIndex,
        source.content,
        source.startByte ?? 0,
        source.endByte ?? 0,
        source.metadata,
        new Date(source.createdAt),
        source.heading,
        hit._score,
      );
    });

    const total =
      typeof response.hits.total === "number"
        ? response.hits.total
        : (response.hits.total?.value ?? 0);

    return { total, chunks, took: response.took };
  }

  async deleteFileChunks(fileId: string): Promise<void> {
    await this.client.deleteByQuery({
      index: this.indexName,
      body: { query: { term: { fileId } } },
    });
    this.logger.log(`Deleted chunks for file: ${fileId}`);
  }
}
