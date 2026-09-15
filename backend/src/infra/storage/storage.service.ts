import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'node:stream';
import { envFlag } from '@/config/env.validation';

/**
 * A region has to be given to sign a request, but neither storage backend
 * this client talks to (MinIO, Cloudflare R2) cares what the string says —
 * MinIO accepts any region when it has none configured itself, and R2's own
 * docs say to send exactly this value. So it is a constant, not something
 * asked of the server: the old minio-js client needed a follow-up call to
 * discover the bucket's real region before it would sign correctly, but the
 * AWS SDK has no such requirement, and that whole round trip goes away here.
 */
const REGION = 'auto';

/** What the bucket knows about a stored object. */
export interface StoredObjectInfo {
  sizeBytes: number;
  mimeType: string;
}

/**
 * The only place in the application that talks to object storage.
 *
 * Built on the AWS S3 SDK rather than a MinIO-specific client, so the same
 * code runs against local MinIO (`docker compose`) and Cloudflare R2 in
 * production — both speak the S3 API, and only the endpoint/credentials
 * differ. Nothing here is ACL-aware on purpose: R2 rejects requests that
 * carry an ACL header at all, and the objects never needed one to begin
 * with, so no command below sets one.
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
 *   - `client` reaches storage from wherever the API happens to run. In
 *     Docker that is `minio:9000`, a name only the compose network resolves.
 *   - `signingClient` builds URLs the **browser** will open. Those must name a
 *     host the browser can reach — `localhost` on the port compose publishes,
 *     which is not the port MinIO listens on inside the network — and the
 *     signature is computed over that host, so it cannot be rewritten after.
 *
 * On a developer machine both are `localhost` and the two collapse into one.
 * On Cloudflare R2 both are the same public endpoint too, so this split costs
 * nothing there — it exists for MinIO's container-network case and is simply
 * inert when the two endpoints happen to match.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  /** Same bucket, but addressed the way the browser will address it. */
  private readonly signingClient: S3Client;
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

    const accessKeyId = this.config.getOrThrow<string>('MINIO_ACCESS_KEY');
    const secretAccessKey = this.config.getOrThrow<string>('MINIO_SECRET_KEY');
    const credentials = { accessKeyId, secretAccessKey };

    this.client = new S3Client({
      endpoint: buildEndpoint(
        this.config.getOrThrow<string>('MINIO_ENDPOINT'),
        Number(this.config.getOrThrow<string | number>('MINIO_PORT')),
        envFlag(this.config.get<string>('MINIO_USE_SSL')),
      ),
      region: REGION,
      credentials,
      // Path-style (`endpoint/bucket/key`) rather than virtual-hosted
      // (`bucket.endpoint/key`): MinIO's local endpoint has no DNS entry for
      // a bucket subdomain, and R2 supports path-style against its own
      // per-account endpoint too, so one setting works for both.
      forcePathStyle: true,
    });

    // getOrThrow, not a fallback to MINIO_ENDPOINT: a wrong public address
    // does not break anything until somebody uploads a file, which on demo
    // day is the worst possible moment to discover it. Missing configuration
    // stops the process at boot instead.
    this.signingClient = new S3Client({
      endpoint: buildEndpoint(
        this.config.getOrThrow<string>('MINIO_PUBLIC_ENDPOINT'),
        Number(this.config.getOrThrow<string | number>('MINIO_PUBLIC_PORT')),
        envFlag(this.config.get<string>('MINIO_PUBLIC_USE_SSL')),
      ),
      region: REGION,
      credentials,
      forcePathStyle: true,
    });
  }

  /**
   * Creates the bucket if the docker init container has not, so a fresh
   * machine does not fail on the first upload with a confusing S3 error.
   *
   * Not fatal on failure: R2 buckets are created outside this service (the
   * Cloudflare dashboard, or `wrangler`), and a missing bucket there should
   * surface as a clear error on the first real upload, not stop the API from
   * booting.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      // HeadBucketCommand has no declared error shape for "missing" in the S3
      // model, so the status code is the only reliable signal, checked
      // directly rather than via `instanceof` against a specific exception
      // class that may not apply to this command.
      if (isNotFoundError(error)) {
        try {
          await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
          this.logger.log(`สร้าง bucket "${this.bucket}" แล้ว`);
        } catch (createError) {
          this.logger.error(
            `สร้าง bucket "${this.bucket}" ไม่สำเร็จ`,
            createError instanceof Error ? createError.stack : String(createError),
          );
        }
        return;
      }

      // Not fatal: the API still serves every route that does not touch files,
      // and a wrong storage address should not stop the whole server from booting.
      this.logger.error(
        `เชื่อมต่อ object storage ไม่สำเร็จ ตรวจค่า MINIO_* ใน .env`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Temporary URL the browser PUTs the file to, bypassing this API entirely. */
  presignPut(objectKey: string): Promise<string> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: objectKey });
    return getSignedUrl(this.signingClient, command, { expiresIn: this.uploadExpirySeconds });
  }

  /** Temporary URL the browser reads the file from. Never used for lesson video. */
  presignGet(objectKey: string, downloadName?: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      // RFC 5987, so Thai file names survive the round trip.
      ResponseContentDisposition: downloadName
        ? `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`
        : undefined,
    });
    return getSignedUrl(this.signingClient, command, { expiresIn: this.downloadExpirySeconds });
  }

  /**
   * `presignGet` for screens where a missing picture is nicer than a missing
   * page: covers, avatars, transfer slips. Storage being down costs a
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
      const info = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      return {
        sizeBytes: info.ContentLength ?? 0,
        mimeType: info.ContentType ?? 'application/octet-stream',
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
  async openRange(objectKey: string, offset: number, length: number): Promise<Readable> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Range: `bytes=${offset}-${offset + length - 1}`,
      }),
    );
    // In the Node runtime this SDK uses, Body is always a Node Readable.
    return response.Body as Readable;
  }

  async remove(objectKey: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    } catch (error) {
      // A missing object is the state we wanted anyway, and a storage hiccup
      // must not roll back the database row the caller just deleted.
      this.logger.warn(
        `ลบไฟล์ ${objectKey} จาก storage ไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Used by /health to report whether object storage is actually reachable. */
  async isReachable(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}

function buildEndpoint(host: string, port: number, useSSL: boolean): string {
  const protocol = useSSL ? 'https' : 'http';
  if ((useSSL && port === 443) || (!useSSL && port === 80)) {
    return `${protocol}://${host}`;
  }
  return `${protocol}://${host}:${port}`;
}

function isNotFoundError(error: unknown): boolean {
  const status = (error as { $metadata?: { httpStatusCode?: number } } | undefined)?.$metadata
    ?.httpStatusCode;
  return status === 404;
}
