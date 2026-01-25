import { FileUpload } from '../entities/file-upload.entity';

// Output Port: Storage Port
export interface IStoragePort {
  uploadFile(file: Express.Multer.File, key: string): Promise<string>;
  getFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
  generatePresignedUrl(key: string, expiresIn: number): Promise<string>;
}

export const IStoragePort = Symbol('IStoragePort');
