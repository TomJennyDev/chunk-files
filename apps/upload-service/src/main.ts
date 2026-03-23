import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import { CONSUMER_GROUPS, KAFKA_CLIENT_IDS } from "@chunk-files/shared";

async function bootstrap() {
  const logger = new Logger("UploadService");

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: KAFKA_CLIENT_IDS.UPLOAD_SERVICE,
          brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
        },
        consumer: {
          groupId: CONSUMER_GROUPS.UPLOAD_SERVICE,
          sessionTimeout: 30000,
          heartbeatInterval: 10000,
        },
      },
    },
  );

  await app.listen();
  logger.log("🚀 Upload Service is running (Kafka consumer)");
  logger.log(
    `📡 Kafka broker: ${process.env.KAFKA_BROKERS || "localhost:9092"}`,
  );
}

bootstrap();
