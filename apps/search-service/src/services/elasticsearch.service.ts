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
    } as any);

    this.indexName = this.configService.get<string>(
      "ELASTICSEARCH_INDEX",
      "file-chunks",
    );
    this.logger.log(`Elasticsearch: node=${node}, index=${this.indexName}`);
  }

  async onModuleInit() {
    try {
      const health = await this.client.cluster.health();
      this.logger.log(
        `Elasticsearch cluster: ${health.cluster_name} (${health.status})`,
      );
    } catch (error) {
      this.logger.warn(`Elasticsearch not ready: ${error.message}`);
    }
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
          highlight: {
            fields: { content: { fragment_size: 200, number_of_fragments: 3 } },
          },
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

  async getChunksByFileId(fileId: string): Promise<FileChunk[]> {
    const result = await this.searchChunks({ fileId, size: 10000 });
    return result.chunks;
  }
}
