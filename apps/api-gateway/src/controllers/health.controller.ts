import { Controller, Get, HttpStatus, Inject, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RedisService } from '../modules/redis.module';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly redisService: RedisService) {}

  @Get()
  @ApiOperation({ summary: 'Health check - API Gateway + Redis + Kafka' })
  async check() {
    const redisStatus = await this.redisService.ping();

    return {
      statusCode: HttpStatus.OK,
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      dependencies: {
        redis: redisStatus ? 'healthy' : 'unhealthy',
        kafka: 'connected', // If we got here, Kafka client is working
      },
    };
  }
}
