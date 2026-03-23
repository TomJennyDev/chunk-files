import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import {
  FileUpload,
  REDIS_PREFIXES,
  REDIS_TTL,
  IFileRepository,
} from "@chunk-files/shared";

@Injectable()
export class RedisFileRepository implements IFileRepository, OnModuleDestroy {
  private readonly logger = new Logger(RedisFileRepository.name);
  private readonly redis: Redis;
  private readonly prefix = REDIS_PREFIXES.FILE_METADATA;

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
      this.logger.log(`Redis connected: ${host}:${port}`),
    );
    this.redis.on("error", (err) =>
      this.logger.error(`Redis error: ${err.message}`),
    );
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async save(fileUpload: FileUpload): Promise<FileUpload> {
    const key = `${this.prefix}${fileUpload.id}`;
    await this.redis.set(
      key,
      JSON.stringify(fileUpload.toJSON()),
      "EX",
      REDIS_TTL.FILE_METADATA,
    );

    // Also add to the file list set
    await this.redis.sadd("file:list", fileUpload.id);

    // Update status cache
    await this.redis.set(
      `${REDIS_PREFIXES.FILE_STATUS}${fileUpload.id}`,
      JSON.stringify(fileUpload.toJSON()),
      "EX",
      REDIS_TTL.FILE_STATUS,
    );

    this.logger.log(`File saved to Redis: ${fileUpload.id}`);
    return fileUpload;
  }

  async findById(id: string): Promise<FileUpload | null> {
    const key = `${this.prefix}${id}`;
    const data = await this.redis.get(key);
    if (!data) return null;

    return FileUpload.fromJSON(JSON.parse(data));
  }

  async findAll(): Promise<FileUpload[]> {
    const fileIds = await this.redis.smembers("file:list");
    const files: FileUpload[] = [];

    for (const id of fileIds) {
      const file = await this.findById(id);
      if (file) files.push(file);
    }

    return files;
  }

  async update(fileUpload: FileUpload): Promise<FileUpload> {
    return this.save(fileUpload);
  }

  async delete(id: string): Promise<void> {
    const key = `${this.prefix}${id}`;
    await this.redis.del(key);
    await this.redis.srem("file:list", id);
    await this.redis.del(`${REDIS_PREFIXES.FILE_STATUS}${id}`);
    this.logger.log(`File deleted from Redis: ${id}`);
  }
}
