import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { UploadFileUseCase } from '@application/use-cases/upload-file.use-case';
import { GetFileStatusUseCase } from '@application/use-cases/get-file-status.use-case';
import { SearchFilesUseCase } from '@application/use-cases/search-files.use-case';
import { CustomFileTypeValidator } from '../validators/custom-file-type.validator';

@ApiTags('files')
@Controller('files')
export class FileController {
  private readonly logger = new Logger(FileController.name);

  constructor(
    private readonly uploadFileUseCase: UploadFileUseCase,
    private readonly getFileStatusUseCase: GetFileStatusUseCase,
    private readonly searchFilesUseCase: SearchFilesUseCase,
  ) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file for processing' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 524288000 }), // 500MB
          new CustomFileTypeValidator({ 
            fileExtensions: ['.txt', '.pdf', '.doc', '.docx', '.md', '.json', '.xml', '.csv'],
            mimeTypes: /(text\/plain|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/markdown|application\/json|application\/xml|text\/xml|text\/csv)/
          }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    try {
      this.logger.log(`Upload request received: ${file.originalname}`);
      const result = await this.uploadFileUseCase.execute({ file });
      return {
        statusCode: HttpStatus.CREATED,
        message: 'File uploaded successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'File upload failed',
          error: error.message,
        },
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
      const fileUpload = await this.getFileStatusUseCase.execute({ fileId });
      return {
        statusCode: HttpStatus.OK,
        data: {
          fileId: fileUpload.id,
          fileName: fileUpload.originalName,
          status: fileUpload.status,
          totalChunks: fileUpload.totalChunks,
          processedChunks: fileUpload.processedChunks,
          progress: fileUpload.totalChunks && fileUpload.processedChunks
            ? Math.round((fileUpload.processedChunks / fileUpload.totalChunks) * 100)
            : 0,
          error: fileUpload.error,
          uploadedAt: fileUpload.uploadedAt,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'File not found',
          error: error.message,
        },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Get('search')
  @ApiOperation({ summary: 'Search file contents' })
  @ApiResponse({ status: 200, description: 'Search results retrieved' })
  async searchFiles(
    @Query('text') text?: string,
    @Query('fileId') fileId?: string,
    @Query('fileName') fileName?: string,
    @Query('page') page: number = 0,
    @Query('size') size: number = 10,
  ) {
    try {
      const result = await this.searchFilesUseCase.execute({
        text,
        fileId,
        fileName,
        page: Number(page),
        size: Number(size),
      });

      return {
        statusCode: HttpStatus.OK,
        data: {
          total: result.total,
          page: Number(page),
          size: Number(size),
          took: result.took,
          results: result.chunks.map((chunk) => ({
            id: chunk.id,
            fileId: chunk.fileId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content.substring(0, 500), // Preview only
            fileName: chunk.metadata.fileName,
            startByte: chunk.startByte,
            endByte: chunk.endByte,
          })),
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Search failed',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
