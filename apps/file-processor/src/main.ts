// OpenTelemetry MUST be initialized before any other imports
import './tracing';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { MetricsInterceptor } from './infrastructure/interceptors/metrics.interceptor';
import { createNestWinstonLogger } from './infrastructure/logger/winston.config';

async function bootstrap() {
  // Use Winston as NestJS logger → logs go to Console + OTel Collector → Loki
  const winstonLogger = createNestWinstonLogger();

  const app = await NestFactory.create(AppModule, {
    logger: winstonLogger,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global metrics interceptor (OpenTelemetry)
  app.useGlobalInterceptors(new MetricsInterceptor());

  // CORS
  app.enableCors();

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('File Processor API')
    .setDescription('API for uploading and processing large files with chunking and Elasticsearch indexing')
    .setVersion('1.0')
    .addTag('files')
    .addTag('health')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
  logger.log(`📡 Logs → OTel Collector → Loki (Grafana :3001)`);
}

bootstrap();
