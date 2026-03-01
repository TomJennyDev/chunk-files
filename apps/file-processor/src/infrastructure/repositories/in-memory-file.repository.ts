import { Injectable, Logger } from '@nestjs/common';
import { IFileRepository } from '@domain/ports/file-repository.port';
import { FileUpload } from '@domain/entities/file-upload.entity';

// In-memory repository for demo purposes
// In production, use a real database (PostgreSQL, MongoDB, etc.)
@Injectable()
export class InMemoryFileRepository implements IFileRepository {
  private readonly logger = new Logger(InMemoryFileRepository.name);
  private readonly store = new Map<string, FileUpload>();

  async save(fileUpload: FileUpload): Promise<FileUpload> {
    this.store.set(fileUpload.id, fileUpload);
    this.logger.log(`File saved: ${fileUpload.id}`);
    return fileUpload;
  }

  async findById(id: string): Promise<FileUpload | null> {
    const file = this.store.get(id);
    return file || null;
  }

  async findAll(): Promise<FileUpload[]> {
    return Array.from(this.store.values());
  }

  async update(fileUpload: FileUpload): Promise<FileUpload> {
    this.store.set(fileUpload.id, fileUpload);
    this.logger.log(`File updated: ${fileUpload.id}`);
    return fileUpload;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
    this.logger.log(`File deleted: ${id}`);
  }
}
