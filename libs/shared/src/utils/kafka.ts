import { KafkaOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

export interface KafkaConnectionConfig {
  clientId: string;
  brokers: string;
  groupId: string;
  sessionTimeout?: number;
  heartbeatInterval?: number;
  maxWaitTimeInMs?: number;
}

/**
 * Build standardized Kafka microservice options with proper retry,
 * connection timeout, and reconnection settings.
 */
export function buildKafkaMicroserviceOptions(
  config: KafkaConnectionConfig,
): KafkaOptions {
  const brokerList = config.brokers.split(',').map((b) => b.trim());

  return {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: config.clientId,
        brokers: brokerList,
        connectionTimeout: 10000, // 10s to establish connection
        authenticationTimeout: 10000,
        retry: {
          initialRetryTime: 1000, // Start with 1s
          retries: 15, // Up to 15 retries
          maxRetryTime: 30000, // Max 30s between retries
          factor: 0.2, // Randomization factor
          multiplier: 2, // Exponential backoff
        },
      },
      consumer: {
        groupId: config.groupId,
        sessionTimeout: config.sessionTimeout || 30000,
        heartbeatInterval: config.heartbeatInterval || 10000,
        maxWaitTimeInMs: config.maxWaitTimeInMs || 5000,
        retry: {
          initialRetryTime: 1000,
          retries: 10,
          maxRetryTime: 30000,
        },
      },
      subscribe: {
        fromBeginning: false,
      },
    },
  };
}

/**
 * Build Kafka client module options (for ClientsModule.registerAsync).
 */
export function buildKafkaClientOptions(config: {
  clientId: string;
  brokers: string;
  groupId: string;
}) {
  const brokerList = config.brokers.split(',').map((b) => b.trim());

  return {
    transport: Transport.KAFKA as Transport.KAFKA,
    options: {
      client: {
        clientId: config.clientId,
        brokers: brokerList,
        connectionTimeout: 10000,
        authenticationTimeout: 10000,
        retry: {
          initialRetryTime: 1000,
          retries: 15,
          maxRetryTime: 30000,
          factor: 0.2,
          multiplier: 2,
        },
      },
      consumer: {
        groupId: config.groupId,
      },
    },
  };
}

/**
 * Graceful shutdown handler — ensures Kafka connections are closed
 * and pending messages are flushed before process exits.
 */
export function setupGracefulShutdown(
  app: { close: () => Promise<void> },
  serviceName: string,
): void {
  const logger = new Logger(`${serviceName}:Shutdown`);
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.log(`Received ${signal}. Starting graceful shutdown...`);

    try {
      await Promise.race([
        app.close(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Shutdown timeout after 10s')),
            10000,
          ),
        ),
      ]);
      logger.log('Graceful shutdown complete.');
      process.exit(0);
    } catch (error) {
      logger.error(`Forced shutdown: ${error.message}`);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
