import { Controller, Logger } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import {
  MESSAGE_PATTERNS,
  REDIS_PREFIXES,
  REDIS_TTL,
} from "@chunk-files/shared";
import { ElasticsearchService } from "../services/elasticsearch.service";
import { RedisCacheService } from "../services/redis-cache.service";
import * as crypto from "crypto";

@Controller()
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly cacheService: RedisCacheService,
  ) {}

  /**
   * Handle search requests from API Gateway (request/response pattern)
   */
  @MessagePattern(MESSAGE_PATTERNS.SEARCH_FILES)
  async handleSearch(@Payload() data: any) {
    const { text, fileId, fileName, page = 1, size = 10 } = data.value || data;

    this.logger.log(
      `Search request: ${JSON.stringify({ text, fileId, fileName, page, size })}`,
    );

    try {
      // Check Redis cache
      const cacheKey = `${REDIS_PREFIXES.SEARCH_CACHE}${this.hashParams({ text, fileId, fileName, page, size })}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.log("Search cache hit");
        return JSON.parse(cached);
      }

      // Query Elasticsearch
      const result = await this.elasticsearchService.searchChunks({
        text,
        fileId,
        fileName,
        from: Math.max(0, page - 1) * size,
        size,
      });

      const response = {
        total: result.total,
        page: Number(page),
        size: Number(size),
        took: result.took,
        results: result.chunks.map((chunk) => ({
          id: chunk.id,
          fileId: chunk.fileId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content.substring(0, 500),
          fileName: chunk.metadata?.fileName || "",
          startByte: chunk.startByte,
          endByte: chunk.endByte,
          heading: chunk.heading,
          score: chunk.score,
        })),
      };

      // Cache in Redis
      await this.cacheService.set(
        cacheKey,
        JSON.stringify(response),
        REDIS_TTL.SEARCH_CACHE,
      );

      this.logger.log(
        `Search completed: ${result.total} results in ${result.took}ms`,
      );
      return response;
    } catch (error) {
      this.logger.error(`Search failed: ${error.message}`, error.stack);
      return { error: error.message, total: 0, results: [] };
    }
  }

  private hashParams(params: Record<string, any>): string {
    return crypto
      .createHash("md5")
      .update(JSON.stringify(params))
      .digest("hex");
  }
}
