import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>("REDIS_HOST", "localhost");
    const port = this.configService.get<number>("REDIS_PORT", 6379);

    this.redis = new Redis({
      host,
      port,
      password: this.configService.get<string>("REDIS_PASSWORD") || undefined,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    this.redis.on("connect", () =>
      this.logger.log(`Redis cache connected: ${host}:${port}`),
    );
    this.redis.on("error", (err) =>
      this.logger.error(`Redis cache error: ${err.message}`),
    );
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redis.set(key, value, "EX", ttl);
    } else {
      await this.redis.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
      this.logger.log(
        `Invalidated ${keys.length} cache keys matching: ${pattern}`,
      );
    }
  }
}
