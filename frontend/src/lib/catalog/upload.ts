import { instructorMessages } from '@/lib/messages/instructor';
import { presignUpload } from './api';
import { UPLOAD_ACCEPT, UPLOAD_MAX_MB, type UploadKind } from './types';

/**
 * Uploads a file straight to MinIO with a presigned URL.
 *
 * XMLHttpRequest rather than fetch, for one reason: fetch still cannot report
 * upload progress, and a 500MB video with no progress bar looks like a frozen
 * page. The API never sees the bytes — only the request for a place to put
 * them, and the key afterwards.
 */

export interface UploadResult {
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface UploadHandle {
  promise: Promise<UploadResult>;
  /** Aborts the transfer. The presigned URL simply goes unused. */
  cancel: () => void;
}

/** Thrown for problems we can name in Thai before ever contacting the server. */
export class UploadError extends Error {}

export function checkFileBeforeUpload(kind: UploadKind, file: File): string | null {
  const { upload } = instructorMessages;

  if (!UPLOAD_ACCEPT[kind].includes(file.type)) {
    return upload.unsupportedType;
  }
  if (file.size > UPLOAD_MAX_MB[kind] * 1024 * 1024) {
    return `${upload.tooLargePrefix} ${UPLOAD_MAX_MB[kind]} ${upload.tooLargeSuffix}`;
  }
  return null;
}

export function uploadFile(
  kind: UploadKind,
  file: File,
  onProgress: (percent: number) => void,
  options?: { courseId?: string },
): UploadHandle {
  const request = new XMLHttpRequest();
  let cancelled = false;

  const promise = (async (): Promise<UploadResult> => {
    const problem = checkFileBeforeUpload(kind, file);
    if (problem) {
      throw new UploadError(problem);
    }

    // The server re-checks type and size before it issues the URL; the check
    // above only saves the user a round trip. courseId is what lets it also
    // check the 3 GB per-course cap for a video or a material.
    const { uploadUrl, fileKey } = await presignUpload({
      kind,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      courseId: options?.courseId,
    });

    if (cancelled) {
      throw new UploadError(instructorMessages.upload.cancel);
    }

    await new Promise<void>((resolve, reject) => {
      request.open('PUT', uploadUrl);
      request.setRequestHeader('Content-Type', file.type);

      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });

      request.addEventListener('load', () => {
        if (request.status >= 200 && request.status < 300) {
          resolve();
        } else {
          reject(new UploadError(instructorMessages.upload.failed));
        }
      });
      request.addEventListener('error', () =>
        reject(new UploadError(instructorMessages.upload.failed)),
      );
      request.addEventListener('abort', () =>
        reject(new UploadError(instructorMessages.upload.cancel)),
      );

      request.send(file);
    });

    onProgress(100);

    return {
      fileKey,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    };
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      request.abort();
    },
  };
}
