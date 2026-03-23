import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { REDIS_PREFIXES } from "@chunk-files/shared";

/**
 * Tracks processing progress in Redis for real-time status updates
 */
@Injectable()
export class ProgressService implements OnModuleDestroy {
  private readonly logger = new Logger(ProgressService.name);
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>("REDIS_HOST", "localhost"),
      port: this.configService.get<number>("REDIS_PORT", 6379),
      password: this.configService.get<string>("REDIS_PASSWORD") || undefined,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async updateProgress(
    fileId: string,
    totalChunks: number,
    processedChunks: number,
  ): Promise<void> {
    const key = `${REDIS_PREFIXES.FILE_PROGRESS}${fileId}`;
    const percentage = Math.round((processedChunks / totalChunks) * 100);

    await this.redis.hmset(key, {
      fileId,
      totalChunks: totalChunks.toString(),
      processedChunks: processedChunks.toString(),
      percentage: percentage.toString(),
      updatedAt: new Date().toISOString(),
    });

    // Publish progress update via Redis pub/sub
    await this.redis.publish(
      `${REDIS_PREFIXES.NOTIFICATION_CHANNEL}${fileId}`,
      JSON.stringify({
        type: "progress",
        fileId,
        totalChunks,
        processedChunks,
        percentage,
      }),
    );
  }

  async getProgress(fileId: string): Promise<Record<string, string>> {
    const key = `${REDIS_PREFIXES.FILE_PROGRESS}${fileId}`;
    return this.redis.hgetall(key);
  }
}
