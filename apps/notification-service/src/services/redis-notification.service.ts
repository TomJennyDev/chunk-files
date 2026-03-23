import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { REDIS_CHANNELS } from "@chunk-files/shared";

@Injectable()
export class RedisNotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisNotificationService.name);
  private readonly publisher: Redis;
  private readonly subscriber: Redis;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>("REDIS_HOST", "localhost");
    const port = this.configService.get<number>("REDIS_PORT", 6379);

    const config = {
      host,
      port,
      password: this.configService.get<string>("REDIS_PASSWORD") || undefined,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
    };

    this.publisher = new Redis(config);
    this.subscriber = new Redis(config);

    this.publisher.on("connect", () =>
      this.logger.log(`Redis publisher connected: ${host}:${port}`),
    );
    this.publisher.on("error", (err) =>
      this.logger.error(`Redis publisher error: ${err.message}`),
    );
  }

  async onModuleInit() {
    // Subscribe to notification channels
    await this.subscriber.subscribe(
      REDIS_CHANNELS.FILE_EVENTS,
      REDIS_CHANNELS.NOTIFICATIONS,
    );

    this.subscriber.on("message", (channel, message) => {
      this.logger.debug(
        `Redis message on ${channel}: ${message.substring(0, 100)}...`,
      );
    });

    this.logger.log("Redis Pub/Sub subscriptions active");
  }

  async onModuleDestroy() {
    await this.publisher.quit();
    await this.subscriber.quit();
  }

  async publishEvent(event: string, data: any): Promise<void> {
    const message = JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
    });

    await this.publisher.publish(REDIS_CHANNELS.NOTIFICATIONS, message);
  }

  async publishFileEvent(
    fileId: string,
    event: string,
    data: any,
  ): Promise<void> {
    const message = JSON.stringify({
      event,
      fileId,
      data,
      timestamp: new Date().toISOString(),
    });

    await this.publisher.publish(REDIS_CHANNELS.FILE_EVENTS, message);
  }
}
