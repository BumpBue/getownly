-- The column always held a MinIO object key, never a URL: signed URLs expire,
-- so only the key is durable. Renamed rather than dropped and re-added, which
-- is what a generated migration would have done, so existing covers survive.
ALTER TABLE "Course" RENAME COLUMN "coverUrl" TO "coverKey";
