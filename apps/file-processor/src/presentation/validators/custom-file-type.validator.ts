import { FileValidator } from '@nestjs/common';

export class CustomFileTypeValidator extends FileValidator {
  private allowedExtensions: string[];
  private allowedMimeTypes: RegExp;

  constructor(
    protected readonly validationOptions: {
      fileExtensions: string[];
      mimeTypes?: RegExp;
    },
  ) {
    super(validationOptions);
    this.allowedExtensions = validationOptions.fileExtensions;
    this.allowedMimeTypes = validationOptions.mimeTypes || /.*/;
  }

  isValid(file: Express.Multer.File): boolean {
    if (!file) {
      return false;
    }

    // Get file extension from original filename
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    
    // Check if extension is allowed
    const extensionValid = this.allowedExtensions.includes(`.${fileExtension}`);
    
    // Check if mimetype matches (optional, as fallback)
    const mimeTypeValid = this.allowedMimeTypes.test(file.mimetype);

    // Valid if either extension matches OR mimetype matches
    return extensionValid || mimeTypeValid;
  }

  buildErrorMessage(): string {
    return `File type not allowed. Accepted file types: ${this.allowedExtensions.join(', ')}`;
  }
}
