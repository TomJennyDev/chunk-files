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
} from "@nestjs/common";
import { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
} from "@nestjs/swagger";
import { UploadFileUseCase } from "@application/use-cases/upload-file.use-case";
import { GetFileStatusUseCase } from "@application/use-cases/get-file-status.use-case";
import { SearchFilesUseCase } from "@application/use-cases/search-files.use-case";
import { CustomFileTypeValidator } from "../validators/custom-file-type.validator";
import { IStoragePort } from "@domain/ports/storage.port";
import { IFileRepository } from "@domain/ports/file-repository.port";

@ApiTags("files")
@Controller("files")
export class FileController {
  private readonly logger = new Logger(FileController.name);

  constructor(
    private readonly uploadFileUseCase: UploadFileUseCase,
    private readonly getFileStatusUseCase: GetFileStatusUseCase,
    private readonly searchFilesUseCase: SearchFilesUseCase,
    @Inject(IStoragePort)
    private readonly storagePort: IStoragePort,
    @Inject(IFileRepository)
    private readonly fileRepository: IFileRepository,
  ) {}

  @Post("upload")
  @ApiOperation({ summary: "Upload a file for processing" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: "File uploaded successfully" })
  @ApiResponse({ status: 400, description: "Invalid file" })
  @UseInterceptors(FileInterceptor("file"))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 524288000 }), // 500MB
          new CustomFileTypeValidator({
            fileExtensions: [
              ".txt",
              ".pdf",
              ".doc",
              ".docx",
              ".md",
              ".json",
              ".xml",
              ".csv",
            ],
            mimeTypes:
              /(text\/plain|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/markdown|application\/json|application\/xml|text\/xml|text\/csv)/,
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
        message: "File uploaded successfully",
        data: result,
      };
    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "File upload failed",
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(":fileId/status")
  @ApiOperation({ summary: "Get file processing status" })
  @ApiResponse({ status: 200, description: "File status retrieved" })
  @ApiResponse({ status: 404, description: "File not found" })
  async getFileStatus(@Param("fileId") fileId: string) {
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
          progress:
            fileUpload.totalChunks && fileUpload.processedChunks
              ? Math.round(
                  (fileUpload.processedChunks / fileUpload.totalChunks) * 100,
                )
              : 0,
          error: fileUpload.error,
          uploadedAt: fileUpload.uploadedAt,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          message: "File not found",
          error: error.message,
        },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Get(":fileId/download")
  @ApiOperation({ summary: "Download original file from S3" })
  @ApiResponse({ status: 200, description: "File content returned" })
  @ApiResponse({ status: 404, description: "File not found" })
  async downloadFile(
    @Param("fileId") fileId: string,
    @Query("fileName") fileName: string | undefined,
    @Res() res: Response,
  ) {
    try {
      // Try to get file metadata from repository first
      const fileUpload = await this.fileRepository.findById(fileId);

      let s3Key: string;
      let contentType: string;
      let originalName: string;

      if (fileUpload) {
        s3Key = fileUpload.s3Key;
        contentType = fileUpload.mimeType || "application/octet-stream";
        originalName = fileUpload.originalName;
      } else if (fileName) {
        // Fallback: construct s3Key from fileId + fileName
        // This handles in-memory repository loss after restart
        s3Key = `uploads/${fileId}/${fileName}`;
        contentType = fileName.endsWith(".md") ? "text/markdown" : "application/octet-stream";
        originalName = fileName;
      } else {
        throw new HttpException(
          { statusCode: HttpStatus.NOT_FOUND, message: "File not found. Provide ?fileName= query param as fallback." },
          HttpStatus.NOT_FOUND,
        );
      }

      this.logger.log(`Downloading file from S3: ${s3Key}`);
      const buffer = await this.storagePort.getFile(s3Key);

      res.set({
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(originalName)}"`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
      });

      res.send(buffer);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Download failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "File download failed",
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("search")
  @ApiOperation({ summary: "Search file contents" })
  @ApiResponse({ status: 200, description: "Search results retrieved" })
  async searchFiles(
    @Query("text") text?: string,
    @Query("fileId") fileId?: string,
    @Query("fileName") fileName?: string,
    @Query("page") page: number = 0,
    @Query("size") size: number = 10,
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
            fileName: chunk.metadata?.fileName || "",
            startByte: chunk.startByte,
            endByte: chunk.endByte,
            heading: chunk.heading || undefined,
            score: chunk.score,
          })),
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "Search failed",
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
