import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Res,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  HttpStatus,
  HttpException,
  Logger,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientKafka } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { firstValueFrom, timeout } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import {
  MICROSERVICE_CLIENTS,
  MESSAGE_PATTERNS,
  KAFKA_TOPICS,
  FileUploadedEvent,
  REDIS_PREFIXES,
  REDIS_TTL,
} from '@chunk-files/shared';
import { RedisService } from '../modules/redis.module';

@ApiTags('files')
@Controller('files')
export class FileController implements OnModuleInit {
  private readonly logger = new Logger(FileController.name);

  constructor(
    @Inject(MICROSERVICE_CLIENTS.UPLOAD_SERVICE)
    private readonly uploadClient: ClientKafka,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    // Subscribe to response topics
    this.uploadClient.subscribeToResponseOf(MESSAGE_PATTERNS.GET_FILE_STATUS);
    this.uploadClient.subscribeToResponseOf(MESSAGE_PATTERNS.GET_FILE_LIST);
    await this.uploadClient.connect();
    this.logger.log('Kafka client connected for upload service');
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file for processing' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded and queued for processing' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 524288000 }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    try {
      const correlationId = uuidv4();
      const fileId = uuidv4();
      const s3Key = `uploads/${fileId}/${file.originalname}`;

      this.logger.log(
        `[${correlationId}] Upload request: ${file.originalname} (${file.size} bytes)`,
      );

      // Emit file uploaded event to Kafka
      const event: FileUploadedEvent = {
        fileId,
        fileName: file.originalname,
        s3Key,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString(),
        correlationId,
      };

      // Send file buffer + metadata to upload service via Kafka
      this.uploadClient.emit(KAFKA_TOPICS.FILE_UPLOADED, {
        key: fileId,
        value: {
          ...event,
          fileBuffer: file.buffer.toString('base64'),
        },
      });

      // Cache initial status in Redis
      await this.redisService.set(
        `${REDIS_PREFIXES.FILE_STATUS}${fileId}`,
        JSON.stringify({
          fileId,
          fileName: file.originalname,
          status: 'uploaded',
          uploadedAt: event.uploadedAt,
          fileSize: file.size,
        }),
        REDIS_TTL.FILE_METADATA,
      );

      return {
        statusCode: HttpStatus.CREATED,
        message: 'File uploaded and queued for processing',
        data: {
          fileId,
          fileName: file.originalname,
          fileSize: file.size,
          s3Key,
          status: 'uploaded',
          uploadedAt: event.uploadedAt,
          correlationId,
        },
      };
    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`, error.stack);
      throw new HttpException(
        { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'File upload failed', error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':fileId/status')
  @ApiOperation({ summary: 'Get file processing status' })
  @ApiResponse({ status: 200, description: 'File status retrieved' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getFileStatus(@Param('fileId') fileId: string) {
    try {
      // Try Redis cache first
      const cached = await this.redisService.get(`${REDIS_PREFIXES.FILE_STATUS}${fileId}`);
      if (cached) {
        this.logger.log(`Cache hit for file status: ${fileId}`);
        return {
          statusCode: HttpStatus.OK,
          data: JSON.parse(cached),
          source: 'cache',
        };
      }

      // Fallback to microservice
      const result = await firstValueFrom(
        this.uploadClient
          .send(MESSAGE_PATTERNS.GET_FILE_STATUS, { fileId })
          .pipe(timeout(5000)),
      );

      // Update cache
      if (result) {
        await this.redisService.set(
          `${REDIS_PREFIXES.FILE_STATUS}${fileId}`,
          JSON.stringify(result),
          REDIS_TTL.FILE_STATUS,
        );
      }

      return {
        statusCode: HttpStatus.OK,
        data: result,
        source: 'service',
      };
    } catch (error) {
      throw new HttpException(
        { statusCode: HttpStatus.NOT_FOUND, message: 'File not found', error: error.message },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'List all uploaded files' })
  @ApiResponse({ status: 200, description: 'File list retrieved' })
  async listFiles() {
    try {
      const result = await firstValueFrom(
        this.uploadClient
          .send(MESSAGE_PATTERNS.GET_FILE_LIST, {})
          .pipe(timeout(5000)),
      );

      return {
        statusCode: HttpStatus.OK,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Failed to list files' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
