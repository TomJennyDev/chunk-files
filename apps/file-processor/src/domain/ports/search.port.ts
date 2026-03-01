import { FileChunk } from '../entities/file-chunk.entity';

// Output Port: Search Port (Elasticsearch)
export interface ISearchPort {
  indexChunk(chunk: FileChunk): Promise<void>;
  bulkIndexChunks(chunks: FileChunk[]): Promise<void>;
  searchChunks(query: SearchQuery): Promise<SearchResult>;
  deleteFileChunks(fileId: string): Promise<void>;
  getChunksByFileId(fileId: string): Promise<FileChunk[]>;
}

export const ISearchPort = Symbol('ISearchPort');

export interface SearchQuery {
  text?: string;
  fileId?: string;
  fileName?: string;
  from?: number;
  size?: number;
}

export interface SearchResult {
  total: number;
  chunks: FileChunk[];
  took: number;
}
