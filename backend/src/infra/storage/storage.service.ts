import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import type { Readable } from 'node:stream';
import { envFlag } from '@/config/env.validation';

/** What MinIO knows about a stored object. */
export interface StoredObjectInfo {
  sizeBytes: number;
  mimeType: string;
}

/**
 * The only place in the application that talks to MinIO.
 *
 * Two ways out of the bucket exist and they are deliberately different:
 *
 *   - presignGet / presignPut hand the browser a temporary URL and step aside.
 *     Used for covers, avatars, attachments and slips.
 *   - openRange streams bytes back through the API. Used for lesson videos,
 *     which must never leave as a shareable URL (CLAUDE.md, ข้อห้าม 10).
 *
 * There are also two *clients*, and the difference matters the moment the API
 * stops sharing a network with the browser:
 *
 *   - `client` reaches MinIO from wherever the API happens to run. In Docker
 *     that is `minio:9000`, a name only the compose network resolves.
 *   - `signingClient` builds URLs the **browser** will open. Those must name a
 *     host the browser can reach — `localhost:9000` — and the signature is
 *     computed over that host, so it cannot simply be rewritten afterwards.
 *
 * On a developer machine both are `localhost` and the two collapse into one.
 * Under `docker compose --profile full` they differ, and getting this wrong
 * produced uploads that failed with ERR_NAME_NOT_RESOLVED while every page
 * still rendered — which is why both are required configuration rather than
 * one defaulting to the other.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: MinioClient;
  /** Same bucket, but addressed the way the browser will address it. */
  private readonly signingClient: MinioClient;
  private readonly bucket: string;
  private readonly downloadExpirySeconds: number;
  private readonly uploadExpirySeconds: number;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('MINIO_BUCKET');
    this.downloadExpirySeconds = Number(
      this.config.getOrThrow<string | number>('MINIO_PRESIGN_EXPIRY_SECONDS'),
    );
    this.uploadExpirySeconds = Number(
      this.config.getOrThrow<string | number>('MINIO_PRESIGN_UPLOAD_EXPIRY_SECONDS'),
    );

    const accessKey = this.config.getOrThrow<string>('MINIO_ACCESS_KEY');
    const secretKey = this.config.getOrThrow<string>('MINIO_SECRET_KEY');

    this.client = new MinioClient({
      endPoint: this.config.getOrThrow<string>('MINIO_ENDPOINT'),
      port: Number(this.config.getOrThrow<string | number>('MINIO_PORT')),
      useSSL: envFlag(this.config.get<string>('MINIO_USE_SSL')),
      accessKey,
      secretKey,
    });

    // getOrThrow, not a fallback to MINIO_ENDPOINT: a wrong public address
    // does not break anything until somebody uploads a file, which on demo
    // day is the worst possible moment to discover it. Missing configuration
    // stops the process at boot instead.
    this.signingClient = new MinioClient({
      endPoint: this.config.getOrThrow<string>('MINIO_PUBLIC_ENDPOINT'),
      port: Number(this.config.getOrThrow<string | number>('MINIO_PUBLIC_PORT')),
      useSSL: envFlag(this.config.get<string>('MINIO_PUBLIC_USE_SSL')),
      accessKey,
      secretKey,
    });
  }

  /**
   * Creates the bucket if the docker init container has not, so a fresh
   * machine does not fail on the first upload with a confusing S3 error.
   */
  async onModuleInit(): Promise<void> {
    try {
      if (!(await this.client.bucketExists(this.bucket))) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`สร้าง bucket "${this.bucket}" ใน MinIO แล้ว`);
      }
    } catch (error) {
      // Not fatal: the API still serves every route that does not touch files,
      // and a wrong MinIO address should not stop the whole server from booting.
      this.logger.error(
        `เชื่อมต่อ MinIO ไม่สำเร็จ ตรวจค่า MINIO_* ใน .env`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Temporary URL the browser PUTs the file to, bypassing this API entirely. */
  presignPut(objectKey: string): Promise<string> {
    return this.signingClient.presignedPutObject(this.bucket, objectKey, this.uploadExpirySeconds);
  }

  /** Temporary URL the browser reads the file from. Never used for lesson video. */
  presignGet(objectKey: string, downloadName?: string): Promise<string> {
    const headers = downloadName
      ? {
          // RFC 5987, so Thai file names survive the round trip.
          'response-content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
        }
      : undefined;

    return this.signingClient.presignedGetObject(
      this.bucket,
      objectKey,
      this.downloadExpirySeconds,
      headers,
    );
  }

  /**
   * `presignGet` for screens where a missing picture is nicer than a missing
   * page: covers, avatars, transfer slips. MinIO being down costs a
   * placeholder, not a 500 (the caller renders `null` as "no image").
   */
  async presignGetOrNull(objectKey: string | null): Promise<string | null> {
    if (!objectKey) {
      return null;
    }

    try {
      return await this.presignGet(objectKey);
    } catch (error) {
      this.logger.warn(
        `สร้างลิงก์ชั่วคราวของ ${objectKey} ไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /** Size and content type, or null when the object is not there. */
  async stat(objectKey: string): Promise<StoredObjectInfo | null> {
    try {
      const info = await this.client.statObject(this.bucket, objectKey);
      return {
        sizeBytes: info.size,
        mimeType:
          typeof info.metaData?.['content-type'] === 'string'
            ? info.metaData['content-type']
            : 'application/octet-stream',
      };
    } catch {
      return null;
    }
  }

  /**
   * Opens `length` bytes starting at `offset` as a stream.
   *
   * The stream is piped straight to the response; the file is never buffered
   * in memory, which is what keeps a 500MB video from costing 500MB of RAM
   * per viewer (PLAN.md, R6).
   */
  openRange(objectKey: string, offset: number, length: number): Promise<Readable> {
    return this.client.getPartialObject(this.bucket, objectKey, offset, length);
  }

  async remove(objectKey: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, objectKey);
    } catch (error) {
      // A missing object is the state we wanted anyway, and a storage hiccup
      // must not roll back the database row the caller just deleted.
      this.logger.warn(
        `ลบไฟล์ ${objectKey} จาก MinIO ไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Used by /health to report whether object storage is actually reachable. */
  async isReachable(): Promise<boolean> {
    try {
      return await this.client.bucketExists(this.bucket);
    } catch {
      return false;
    }
  }
}
