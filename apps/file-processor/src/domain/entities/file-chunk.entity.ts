// Domain Entity: File Chunk
export class FileChunk {
  constructor(
    public readonly id: string,
    public readonly fileId: string,
    public readonly chunkIndex: number,
    public readonly content: string,
    public readonly startByte: number,
    public readonly endByte: number,
    public readonly metadata: ChunkMetadata,
    public readonly createdAt: Date,
    public readonly heading?: ChunkHeading,
    public readonly score?: number,
  ) {}
}

export interface ChunkMetadata {
  fileName: string;
  mimeType: string;
  totalChunks: number;
  fileSize: number;
  encoding?: string;
}

export interface ChunkHeading {
  text: string;
  level: number;
  id: string;
}
