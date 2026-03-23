import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MICROSERVICE_CLIENTS, CONSUMER_GROUPS, KAFKA_CLIENT_IDS } from '@chunk-files/shared';
import { FileController } from './controllers/file.controller';
import { SearchController } from './controllers/search.controller';
import { HealthController } from './controllers/health.controller';
import { RedisModule } from './modules/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Multer for file uploads
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: configService.get<number>('MAX_FILE_SIZE', 524288000),
        },
      }),
      inject: [ConfigService],
    }),

    // Kafka Clients for each microservice
    ClientsModule.registerAsync([
      {
        name: MICROSERVICE_CLIENTS.UPLOAD_SERVICE,
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: KAFKA_CLIENT_IDS.API_GATEWAY,
              brokers: configService.get<string>('KAFKA_BROKERS', 'localhost:9092').split(','),
            },
            consumer: {
              groupId: CONSUMER_GROUPS.API_GATEWAY,
            },
          },
        }),
        inject: [ConfigService],
      },
      {
        name: MICROSERVICE_CLIENTS.SEARCH_SERVICE,
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: `${KAFKA_CLIENT_IDS.API_GATEWAY}-search`,
              brokers: configService.get<string>('KAFKA_BROKERS', 'localhost:9092').split(','),
            },
            consumer: {
              groupId: `${CONSUMER_GROUPS.API_GATEWAY}-search`,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),

    // Redis Module
    RedisModule,
  ],
  controllers: [FileController, SearchController, HealthController],
})
export class AppModule {}
