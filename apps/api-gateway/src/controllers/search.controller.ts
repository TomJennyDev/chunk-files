import {
  Controller,
  Get,
  Query,
  HttpStatus,
  HttpException,
  Logger,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { firstValueFrom, timeout } from 'rxjs';
import {
  MICROSERVICE_CLIENTS,
  MESSAGE_PATTERNS,
  REDIS_PREFIXES,
  REDIS_TTL,
} from '@chunk-files/shared';
import { RedisService } from '../modules/redis.module';
import * as crypto from 'crypto';

@ApiTags('search')
@Controller('search')
export class SearchController implements OnModuleInit {
  private readonly logger = new Logger(SearchController.name);

  constructor(
    @Inject(MICROSERVICE_CLIENTS.SEARCH_SERVICE)
    private readonly searchClient: ClientKafka,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    this.searchClient.subscribeToResponseOf(MESSAGE_PATTERNS.SEARCH_FILES);
    await this.searchClient.connect();
    this.logger.log('Kafka client connected for search service');
  }

  @Get()
  @ApiOperation({ summary: 'Search file contents across all indexed chunks' })
  @ApiQuery({ name: 'text', required: false, description: 'Full-text search query' })
  @ApiQuery({ name: 'fileId', required: false, description: 'Filter by file ID' })
  @ApiQuery({ name: 'fileName', required: false, description: 'Filter by file name' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'size', required: false, type: Number, description: 'Results per page' })
  @ApiResponse({ status: 200, description: 'Search results retrieved' })
  async searchFiles(
    @Query('text') text?: string,
    @Query('fileId') fileId?: string,
    @Query('fileName') fileName?: string,
    @Query('page') page: number = 1,
    @Query('size') size: number = 10,
  ) {
    try {
      const searchParams = {
        text,
        fileId,
        fileName,
        page: Number(page),
        size: Number(size),
      };

      // Generate cache key from search params
      const cacheKey = `${REDIS_PREFIXES.SEARCH_CACHE}${this.hashSearchParams(searchParams)}`;

      // Check Redis cache
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.logger.log(`Search cache hit for: ${JSON.stringify(searchParams)}`);
        return {
          statusCode: HttpStatus.OK,
          data: JSON.parse(cached),
          source: 'cache',
        };
      }

      // Send to search microservice via Kafka
      const result = await firstValueFrom(
        this.searchClient
          .send(MESSAGE_PATTERNS.SEARCH_FILES, searchParams)
          .pipe(timeout(10000)),
      );

      // Cache results in Redis
      await this.redisService.set(
        cacheKey,
        JSON.stringify(result),
        REDIS_TTL.SEARCH_CACHE,
      );

      return {
        statusCode: HttpStatus.OK,
        data: result,
        source: 'service',
      };
    } catch (error) {
      this.logger.error(`Search failed: ${error.message}`, error.stack);
      throw new HttpException(
        { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Search failed', error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private hashSearchParams(params: Record<string, any>): string {
    return crypto
      .createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex');
  }
}
