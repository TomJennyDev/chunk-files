import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MICROSERVICE_CLIENTS, CONSUMER_GROUPS, KAFKA_CLIENT_IDS } from '@chunk-files/shared';
import { UploadController } from './controllers/upload.controller';
import { S3Service } from './services/s3.service';
import { RedisFileRepository } from './repositories/redis-file.repository';
import { RedisModule } from './modules/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    // Kafka producer to emit events to processing service
    ClientsModule.registerAsync([
      {
        name: MICROSERVICE_CLIENTS.PROCESSING_SERVICE,
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: `${KAFKA_CLIENT_IDS.UPLOAD_SERVICE}-producer`,
              brokers: configService.get<string>('KAFKA_BROKERS', 'localhost:9092').split(','),
            },
            consumer: {
              groupId: `${CONSUMER_GROUPS.PROCESSING_SERVICE}-upload`,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),

    RedisModule,
  ],
  controllers: [UploadController],
  providers: [S3Service, RedisFileRepository],
})
export class AppModule {}
