import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FileController } from './presentation/controllers/file.controller';
import { HealthController } from './presentation/controllers/health.controller';
import { UploadFileUseCase } from './application/use-cases/upload-file.use-case';
import { ProcessFileUseCase } from './application/use-cases/process-file.use-case';
import { SearchFilesUseCase } from './application/use-cases/search-files.use-case';
import { GetFileStatusUseCase } from './application/use-cases/get-file-status.use-case';
import { S3Adapter } from './infrastructure/adapters/s3.adapter';
import { SQSAdapter } from './infrastructure/adapters/sqs.adapter';
import { ElasticsearchAdapter } from './infrastructure/adapters/elasticsearch.adapter';
import { InMemoryFileRepository } from './infrastructure/repositories/in-memory-file.repository';
import { IStoragePort } from './domain/ports/storage.port';
import { IQueuePort } from './domain/ports/queue.port';
import { ISearchPort } from './domain/ports/search.port';
import { IFileRepository } from './domain/ports/file-repository.port';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: configService.get<number>('MAX_FILE_SIZE', 524288000),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [FileController, HealthController],
  providers: [
    // Use Cases
    UploadFileUseCase,
    ProcessFileUseCase,
    SearchFilesUseCase,
    GetFileStatusUseCase,

    // Adapters
    {
      provide: IStoragePort,
      useClass: S3Adapter,
    },
    {
      provide: IQueuePort,
      useClass: SQSAdapter,
    },
    {
      provide: ISearchPort,
      useClass: ElasticsearchAdapter,
    },
    {
      provide: IFileRepository,
      useClass: InMemoryFileRepository,
    },
  ],
})
export class AppModule {}
