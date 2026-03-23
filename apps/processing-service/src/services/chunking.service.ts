import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v4 as uuidv4 } from "uuid";
import { FileChunk } from "@chunk-files/shared";

@Injectable()
export class ChunkingService {
  private readonly logger = new Logger(ChunkingService.name);
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(private readonly configService: ConfigService) {
    this.chunkSize = this.configService.get<number>("CHUNK_SIZE", 5242880);
    this.chunkOverlap = this.configService.get<number>("CHUNK_OVERLAP", 100);
  }

  splitIntoChunks(
    buffer: Buffer,
    fileId: string,
    fileName: string,
    fileSize: number,
    mimeType: string,
  ): FileChunk[] {
    const chunks: FileChunk[] = [];
    const totalChunks = Math.ceil(buffer.length / this.chunkSize);

    for (let i = 0; i < buffer.length; i += this.chunkSize) {
      const start = Math.max(0, i - this.chunkOverlap);
      const end = Math.min(buffer.length, i + this.chunkSize);
      const chunkBuffer = buffer.slice(start, end);
      const content = chunkBuffer.toString("utf-8");

      const chunk = new FileChunk(
        uuidv4(),
        fileId,
        Math.floor(i / this.chunkSize),
        content,
        start,
        end,
        {
          fileName,
          mimeType,
          totalChunks,
          fileSize,
          encoding: "utf-8",
        },
        new Date(),
      );

      chunks.push(chunk);
    }

    this.logger.log(
      `Split ${fileName} into ${chunks.length} chunks (chunkSize=${this.chunkSize}, overlap=${this.chunkOverlap})`,
    );
    return chunks;
  }
}
