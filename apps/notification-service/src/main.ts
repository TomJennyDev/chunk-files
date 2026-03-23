import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { CONSUMER_GROUPS, KAFKA_CLIENT_IDS } from '@chunk-files/shared';

async function bootstrap() {
  const logger = new Logger('NotificationService');

  // Create HTTP app for WebSocket server
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.WS_CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  // Connect Kafka microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: KAFKA_CLIENT_IDS.NOTIFICATION_SERVICE,
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      },
      consumer: {
        groupId: CONSUMER_GROUPS.NOTIFICATION_SERVICE,
        sessionTimeout: 30000,
        heartbeatInterval: 10000,
      },
    },
  });

  await app.startAllMicroservices();

  const port = process.env.APP_PORT || 3004;
  await app.listen(port);

  logger.log(`🚀 Notification Service running on: http://localhost:${port}`);
  logger.log(`🔌 WebSocket server ready on: ws://localhost:${port}`);
  logger.log(`📡 Kafka consumer: ${CONSUMER_GROUPS.NOTIFICATION_SERVICE}`);
}

bootstrap();
