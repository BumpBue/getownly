import { Role } from '@prisma/client';
import { UPLOAD_MAX_MB, mbToBytes } from '@getownly/shared';

/**
 * What may be uploaded, by whom, and how big.
 *
 * This table is the whole enforcement point: the API refuses to hand out a
 * presigned URL unless the request matches a row here, so an oversized or
 * unexpected file never gets anywhere to land (CLAUDE.md, "ไฟล์และวิดีโอ").
 *
 * The sizes themselves are not here and are not in `.env`: they are fixed by
 * the scope document and live in packages/shared/src/limits.ts, so the web app
 * refuses the same file for the same reason and no deployment can raise a
 * ceiling the document promises.
 */

export const UPLOAD_KINDS = ['video', 'material', 'cover', 'avatar', 'slip'] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

interface KindRule {
  /** Accepted MIME type -> the extension the object key will end with. */
  extensionByMimeType: Record<string, string>;
  /** Roles allowed to upload this kind. `null` means any signed-in user. */
  allowedRoles: Role[] | null;
  /** Thai wording used in the "unsupported type" message. */
  acceptLabel: string;
}

const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export const UPLOAD_RULES: Record<UploadKind, KindRule> = {
  video: {
    extensionByMimeType: {
      'video/mp4': 'mp4',
      'video/webm': 'webm',
    },
    allowedRoles: [Role.INSTRUCTOR, Role.ADMIN],
    acceptLabel: 'MP4 หรือ WebM',
  },
  material: {
    extensionByMimeType: {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/zip': 'zip',
      // Windows and older browsers label .zip this way.
      'application/x-zip-compressed': 'zip',
    },
    allowedRoles: [Role.INSTRUCTOR, Role.ADMIN],
    acceptLabel: 'PDF, DOCX, PPTX, XLSX หรือ ZIP',
  },
  cover: {
    extensionByMimeType: IMAGE_TYPES,
    allowedRoles: [Role.INSTRUCTOR, Role.ADMIN],
    acceptLabel: 'JPG, PNG หรือ WebP',
  },
  avatar: {
    extensionByMimeType: IMAGE_TYPES,
    allowedRoles: null,
    acceptLabel: 'JPG, PNG หรือ WebP',
  },
  slip: {
    extensionByMimeType: {
      'image/jpeg': 'jpg',
      'image/png': 'png',
    },
    allowedRoles: null,
    acceptLabel: 'JPG หรือ PNG',
  },
};

export function maxBytesFor(kind: UploadKind): number {
  return mbToBytes(UPLOAD_MAX_MB[kind]);
}

export function maxMbFor(kind: UploadKind): number {
  return UPLOAD_MAX_MB[kind];
}

export function isUploadKind(value: string): value is UploadKind {
  return (UPLOAD_KINDS as readonly string[]).includes(value);
}

/**
 * Object keys are `<kind>/<userId>/<uuid>.<ext>`.
 *
 * The kind sits in front so access rules can be decided from the key alone,
 * before any database lookup — which is how the video refusal below works.
 */
export function buildObjectKey(
  kind: UploadKind,
  userId: string,
  uuid: string,
  ext: string,
): string {
  return `${kind}/${userId}/${uuid}.${ext}`;
}

export interface ParsedObjectKey {
  kind: UploadKind;
  ownerId: string;
}

/** Returns null for anything that is not a key this API ever issued. */
export function parseObjectKey(objectKey: string): ParsedObjectKey | null {
  // No traversal, no absolute paths, no empty segments.
  if (objectKey.includes('..') || objectKey.startsWith('/') || objectKey.includes('//')) {
    return null;
  }

  const segments = objectKey.split('/');
  if (segments.length !== 3) {
    return null;
  }

  const [kind, ownerId, fileName] = segments;
  if (!isUploadKind(kind) || ownerId.length === 0 || fileName.length === 0) {
    return null;
  }

  return { kind, ownerId };
}
