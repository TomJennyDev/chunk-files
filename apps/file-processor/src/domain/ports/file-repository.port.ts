import { FileUpload } from '../entities/file-upload.entity';

// Output Port: Repository Port
export interface IFileRepository {
  save(fileUpload: FileUpload): Promise<FileUpload>;
  findById(id: string): Promise<FileUpload | null>;
  findAll(): Promise<FileUpload[]>;
  update(fileUpload: FileUpload): Promise<FileUpload>;
  delete(id: string): Promise<void>;
}

export const IFileRepository = Symbol('IFileRepository');
