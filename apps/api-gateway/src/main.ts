import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors();

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle("Chunk Files API Gateway")
    .setDescription(
      "Microservices API Gateway - Routes requests to Upload, Processing, Search, and Notification services via Kafka",
    )
    .setVersion("2.0")
    .addTag("files", "File upload and management")
    .addTag("search", "Full-text search across file chunks")
    .addTag("health", "Health check endpoints")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);

  const logger = new Logger("ApiGateway");
  logger.log(`🚀 API Gateway running on: http://localhost:${port}`);
  logger.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  logger.log(
    `📡 Kafka broker: ${process.env.KAFKA_BROKERS || "localhost:9092"}`,
  );
  logger.log(
    `🔴 Redis: ${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`,
  );
}

bootstrap();
