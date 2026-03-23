import Redis, { RedisOptions } from 'ioredis';
import { Logger } from '@nestjs/common';

export interface RedisConnectionConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

/**
 * Build standardized Redis options with exponential backoff retry,
 * connection limit, and ready-check.
 */
export function buildRedisOptions(config: RedisConnectionConfig): RedisOptions {
  return {
    host: config.host,
    port: config.port,
    password: config.password || undefined,
    db: config.db || 0,
    keyPrefix: config.keyPrefix,
    // Connection management
    lazyConnect: true, // Don't connect until first command — allows startup ordering
    enableReadyCheck: true, // Verify connection is ready before sending commands
    maxRetriesPerRequest: 3,
    // Exponential backoff retry
    retryStrategy: (times: number) => {
      if (times > 20) {
        // Stop retrying after 20 attempts (~2 minutes with backoff)
        return null;
      }
      const delay = Math.min(times * 200, 5000); // Linear up to 5s cap
      return delay;
    },
    reconnectOnError: (err: Error) => {
      // Reconnect on READONLY errors (typical in Redis failover)
      const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNREFUSED'];
      return targetErrors.some((e) => err.message.includes(e));
    },
  };
}

/**
 * Create a Redis client with standardized options,
 * event logging, and startup connection with retry.
 */
export async function createRedisClient(
  config: RedisConnectionConfig,
  label = 'Redis',
): Promise<Redis> {
  const logger = new Logger(`${label}:Connection`);
  const options = buildRedisOptions(config);
  const client = new Redis(options);

  client.on('connect', () => logger.log(`${label} connected`));
  client.on('ready', () => logger.log(`${label} ready`));
  client.on('error', (err) => logger.error(`${label} error: ${err.message}`));
  client.on('close', () => logger.warn(`${label} connection closed`));
  client.on('reconnecting', (ms: number) =>
    logger.warn(`${label} reconnecting in ${ms}ms`),
  );

  // lazyConnect=true → must explicitly connect
  const maxRetries = 10;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await client.connect();
      logger.log(`${label} connection established (attempt ${attempt})`);
      return client;
    } catch (error) {
      if (attempt === maxRetries) {
        logger.error(
          `${label} failed to connect after ${maxRetries} attempts: ${error.message}`,
        );
        throw error;
      }
      const delay = Math.min(attempt * 1000, 5000);
      logger.warn(
        `${label} connection attempt ${attempt}/${maxRetries} failed: ${error.message}. Retrying in ${delay}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return client;
}

/**
 * Gracefully disconnect Redis client(s).
 */
export async function disconnectRedis(
  clients: Redis[],
  label = 'Redis',
): Promise<void> {
  const logger = new Logger(`${label}:Shutdown`);
  for (const client of clients) {
    try {
      await client.quit();
    } catch {
      logger.warn(`${label} forced disconnect`);
      client.disconnect();
    }
  }
  logger.log(`${label} disconnected`);
}
