import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ClientsModule, Transport } from "@nestjs/microservices";
import {
  MICROSERVICE_CLIENTS,
  CONSUMER_GROUPS,
  KAFKA_CLIENT_IDS,
} from "@chunk-files/shared";
import { ProcessingController } from "./controllers/processing.controller";
import { ChunkingService } from "./services/chunking.service";
import { S3Service } from "./services/s3.service";
import { ElasticsearchService } from "./services/elasticsearch.service";
import { ProgressService } from "./services/progress.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),

    // Kafka producer to emit completion/failure events
    ClientsModule.registerAsync([
      {
        name: MICROSERVICE_CLIENTS.UPLOAD_SERVICE,
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: `${KAFKA_CLIENT_IDS.PROCESSING_SERVICE}-producer`,
              brokers: configService
                .get<string>("KAFKA_BROKERS", "localhost:9092")
                .split(","),
            },
            consumer: {
              groupId: `${CONSUMER_GROUPS.PROCESSING_SERVICE}-results`,
            },
          },
        }),
        inject: [ConfigService],
      },
      {
        name: MICROSERVICE_CLIENTS.NOTIFICATION_SERVICE,
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: `${KAFKA_CLIENT_IDS.PROCESSING_SERVICE}-notify`,
              brokers: configService
                .get<string>("KAFKA_BROKERS", "localhost:9092")
                .split(","),
            },
            consumer: {
              groupId: `${CONSUMER_GROUPS.PROCESSING_SERVICE}-notify`,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [ProcessingController],
  providers: [
    ChunkingService,
    S3Service,
    ElasticsearchService,
    ProgressService,
  ],
})
export class AppModule {}
