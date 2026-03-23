import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>("AWS_ENDPOINT");
    const region = this.configService.get<string>("AWS_REGION", "us-east-1");

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: this.configService.get<string>(
          "AWS_ACCESS_KEY_ID",
          "test",
        ),
        secretAccessKey: this.configService.get<string>(
          "AWS_SECRET_ACCESS_KEY",
          "test",
        ),
      },
      forcePathStyle: this.configService.get<boolean>(
        "S3_FORCE_PATH_STYLE",
        true,
      ),
    });

    this.bucketName = this.configService.get<string>(
      "S3_BUCKET_NAME",
      "file-uploads",
    );
  }

  async getFile(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    this.logger.log(`Downloaded from S3: ${key} (${buffer.length} bytes)`);
    return buffer;
  }
}
