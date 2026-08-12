import { Readable } from 'node:stream';
import type { StorageService, StoredObjectInfo } from '@/infra/storage/storage.service';

/**
 * An in-memory MinIO.
 *
 * The ledger suites run against a real PostgreSQL because the money rules
 * depend on real transactions and real locks. Object storage has no such
 * rules: what matters is *which* key a service asks for and *whether* it
 * deletes one, so a Map answers those questions faster and without a bucket
 * to clean up between tests.
 */
export class FakeStorage {
  readonly objects = new Map<string, StoredObjectInfo & { body: Buffer }>();
  readonly removed: string[] = [];

  put(objectKey: string, body: string | Buffer, mimeType = 'application/pdf'): void {
    const buffer = typeof body === 'string' ? Buffer.from(body) : body;
    this.objects.set(objectKey, { body: buffer, sizeBytes: buffer.length, mimeType });
  }

  presignPut(objectKey: string): Promise<string> {
    return Promise.resolve(`https://storage.test/put/${objectKey}?signature=fake`);
  }

  presignGet(objectKey: string): Promise<string> {
    return Promise.resolve(`https://storage.test/get/${objectKey}?signature=fake`);
  }

  presignGetOrNull(objectKey: string | null): Promise<string | null> {
    return objectKey === null ? Promise.resolve(null) : this.presignGet(objectKey);
  }

  stat(objectKey: string): Promise<StoredObjectInfo | null> {
    const object = this.objects.get(objectKey);
    return Promise.resolve(
      object ? { sizeBytes: object.sizeBytes, mimeType: object.mimeType } : null,
    );
  }

  openRange(objectKey: string, offset: number, length: number): Promise<Readable> {
    const object = this.objects.get(objectKey);
    if (!object) {
      return Promise.reject(new Error(`ไม่พบไฟล์ ${objectKey} ใน FakeStorage`));
    }
    return Promise.resolve(Readable.from([object.body.subarray(offset, offset + length)]));
  }

  remove(objectKey: string): Promise<void> {
    this.removed.push(objectKey);
    this.objects.delete(objectKey);
    return Promise.resolve();
  }

  isReachable(): Promise<boolean> {
    return Promise.resolve(true);
  }

  /** Structurally compatible, so services take it without knowing it is a double. */
  asService(): StorageService {
    return this as unknown as StorageService;
  }
}
