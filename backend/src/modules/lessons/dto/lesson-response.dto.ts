/**
 * The instructor's view of a lesson. Still no `videoKey`: the editor only ever
 * needs to know whether a video is attached, and the player uses the streaming
 * endpoint, so the key has no reason to be in any response.
 */
export interface LessonDto {
  id: string;
  courseId: string;
  title: string;
  orderIndex: number;
  durationSec: number | null;
  isPreview: boolean;
  hasVideo: boolean;
  materials: MaterialDto[];
  createdAt: string;
}

export interface MaterialDto {
  id: string;
  lessonId: string;
  fileName: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}
