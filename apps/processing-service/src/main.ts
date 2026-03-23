import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import { CONSUMER_GROUPS, KAFKA_CLIENT_IDS } from "@chunk-files/shared";

async function bootstrap() {
  const logger = new Logger("ProcessingService");

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: KAFKA_CLIENT_IDS.PROCESSING_SERVICE,
          brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
        },
        consumer: {
          groupId: CONSUMER_GROUPS.PROCESSING_SERVICE,
          sessionTimeout: 60000, // longer for processing
          heartbeatInterval: 10000,
          maxWaitTimeInMs: 5000,
        },
      },
    },
  );

  await app.listen();
  logger.log("🚀 Processing Service is running (Kafka consumer)");
  logger.log(
    `📡 Kafka broker: ${process.env.KAFKA_BROKERS || "localhost:9092"}`,
  );
  logger.log(
    `🔍 Elasticsearch: ${process.env.ELASTICSEARCH_NODE || "http://localhost:9200"}`,
  );
}

bootstrap();
