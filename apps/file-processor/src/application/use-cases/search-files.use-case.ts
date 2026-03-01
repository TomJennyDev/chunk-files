import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ISearchPort,
  SearchQuery,
  SearchResult,
} from "@domain/ports/search.port";

export interface SearchFilesCommand {
  text?: string;
  fileId?: string;
  fileName?: string;
  page?: number;
  size?: number;
}

@Injectable()
export class SearchFilesUseCase {
  private readonly logger = new Logger(SearchFilesUseCase.name);

  constructor(
    @Inject(ISearchPort)
    private readonly searchPort: ISearchPort,
  ) {}

  async execute(command: SearchFilesCommand): Promise<SearchResult> {
    const { text, fileId, fileName, page = 0, size = 10 } = command;

    this.logger.log(`Searching files with query: ${JSON.stringify(command)}`);

    const query: SearchQuery = {
      text,
      fileId,
      fileName,
      from: Math.max(0, page - 1) * size,
      size,
    };

    const result = await this.searchPort.searchChunks(query);

    this.logger.log(`Found ${result.total} results in ${result.took}ms`);

    return result;
  }
}
