export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface IStoragePort {
  uploadFile(file: UploadedFile, key: string): Promise<string>;
  getFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
  generatePresignedUrl(key: string, expiresIn: number): Promise<string>;
}

export const IStoragePort = Symbol("IStoragePort");
