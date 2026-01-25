import { Inject, Injectable, Logger } from '@nestjs/common';
import { IFileRepository } from '@domain/ports/file-repository.port';
import { FileUpload } from '@domain/entities/file-upload.entity';

export interface GetFileStatusCommand {
  fileId: string;
}

@Injectable()
export class GetFileStatusUseCase {
  private readonly logger = new Logger(GetFileStatusUseCase.name);

  constructor(
    @Inject(IFileRepository)
    private readonly fileRepository: IFileRepository,
  ) {}

  async execute(command: GetFileStatusCommand): Promise<FileUpload> {
    const { fileId } = command;

    this.logger.log(`Getting status for file: ${fileId}`);

    const fileUpload = await this.fileRepository.findById(fileId);

    if (!fileUpload) {
      throw new Error(`File not found: ${fileId}`);
    }

    return fileUpload;
  }
}
