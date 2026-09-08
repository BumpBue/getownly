"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImageOff, Upload } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StickySaveBar } from "@/components/shared/StickySaveBar";
import { useToast } from "@/hooks/use-toast";
import { applyApiError } from "@/lib/auth/form-errors";
import { listCategories, updateCourse } from "@/lib/catalog/api";
import { courseFormSchema, type CourseFormValues } from "@/lib/catalog/schemas";
import { UPLOAD_ACCEPT, type Category, type CourseDetail } from "@/lib/catalog/types";
import { UploadError, uploadFile } from "@/lib/catalog/upload";
import { formatFileSize } from "@/lib/format";
import { instructorMessages } from "@/lib/messages/instructor";

const FIELDS = ["title", "description", "categoryId", "price"] as const;

/**
 * Title, description, category, price and cover.
 *
 * The cover is uploaded straight to MinIO and only its key is sent here; the
 * preview shown afterwards is the signed URL the API returns on the next read.
 */
export function GeneralTab({
  course,
  readOnly,
  onSaved,
}: {
  course: CourseDetail;
  readOnly: boolean;
  onSaved: (course: CourseDetail) => void;
}) {
  const { general } = instructorMessages;
  const toast = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [banner, setBanner] = useState<string | null>(null);

  const [coverUrl, setCoverUrl] = useState(course.coverUrl);
  const [coverProgress, setCoverProgress] = useState<number | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      title: course.title,
      description: course.description,
      categoryId: course.category.id,
      price: course.price,
    },
  });

  useEffect(() => {
    void listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  async function onSubmit(values: CourseFormValues): Promise<void> {
    setBanner(null);

    try {
      onSaved(await updateCourse(course.id, values));
      toast.success(general.saved);
      // Clears isDirty against the values just saved, not the original ones.
      reset(values);
    } catch (caught) {
      const message = applyApiError<CourseFormValues>(caught, setError, FIELDS);
      if (message) {
        setBanner(message);
      }
    }
  }

  async function onCoverPicked(file: File): Promise<void> {
    setBanner(null);
    setCoverProgress(0);

    try {
      const uploaded = await uploadFile("cover", file, setCoverProgress).promise;
      const updated = await updateCourse(course.id, { coverKey: uploaded.fileKey });
      setCoverUrl(updated.coverUrl);
      onSaved(updated);
      toast.success(general.saved);
    } catch (caught) {
      setBanner(
        caught instanceof UploadError
          ? caught.message
          : applyApiError<CourseFormValues>(caught, setError, FIELDS) ||
              instructorMessages.upload.failed,
      );
    } finally {
      setCoverProgress(null);
      // Clearing lets the same file be picked again after a failure.
      if (coverInput.current) {
        coverInput.current.value = "";
      }
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <CardTitle>{general.heading}</CardTitle>
        </CardHeader>

        <CardBody>
          <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            {banner && <Alert tone="error">{banner}</Alert>}

            <Field id="title" label={general.title} error={errors.title?.message}>
              <Input
                id="title"
                {...register("title")}
                invalid={Boolean(errors.title)}
                disabled={readOnly}
                placeholder={general.titlePlaceholder}
              />
            </Field>

            <Field id="description" label={general.description} error={errors.description?.message}>
              <Textarea
                id="description"
                rows={8}
                {...register("description")}
                invalid={Boolean(errors.description)}
                disabled={readOnly}
                placeholder={general.descriptionPlaceholder}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="categoryId" label={general.category} error={errors.categoryId?.message}>
                <Select
                  id="categoryId"
                  {...register("categoryId")}
                  invalid={Boolean(errors.categoryId)}
                  disabled={readOnly}
                >
                  <option value="">{general.categoryPlaceholder}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                id="price"
                label={general.price}
                hint={
                  course.status === "PUBLISHED" ? general.priceHintPublished : general.priceHint
                }
                error={errors.price?.message}
              >
                <Input
                  id="price"
                  inputMode="decimal"
                  {...register("price")}
                  invalid={Boolean(errors.price)}
                  disabled={readOnly}
                  className="tabular"
                />
              </Field>
            </div>

            <div className="border-t border-border pt-5">
              <Button type="submit" disabled={readOnly || isSubmitting}>
                {isSubmitting ? general.saving : general.save}
              </Button>
            </div>

            <StickySaveBar
              visible={isDirty && !readOnly}
              message={general.unsavedNotice}
              saveLabel={general.save}
              savingLabel={general.saving}
              saving={isSubmitting}
            />
          </form>
        </CardBody>
      </Card>

      <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>{general.storageHeading}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-2">
            <Progress
              value={(course.storageUsedBytes / course.storageLimitBytes) * 100}
              tone={
                course.storageUsedBytes / course.storageLimitBytes >= 0.9 ? "secondary" : "primary"
              }
            />
            <p className="tabular text-xs text-muted">
              {general.storageUsedOf} {formatFileSize(course.storageUsedBytes)} /{" "}
              {formatFileSize(course.storageLimitBytes)}
            </p>
            {course.storageUsedBytes >= course.storageLimitBytes ? (
              <p className="text-xs text-destructive">{general.storageFull}</p>
            ) : (
              course.storageUsedBytes / course.storageLimitBytes >= 0.9 && (
                <p className="text-xs text-pending">{general.storageNearLimit}</p>
              )
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{general.cover}</CardTitle>
          </CardHeader>

          <CardBody className="flex flex-col gap-3">
            <div className="relative aspect-video w-full overflow-hidden rounded-control border border-border bg-background">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- next/image optimises on the server, which cannot reach a URL signed for the browser
                <img
                  src={coverUrl}
                  alt={course.title}
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-subtle">
                  <ImageOff aria-hidden className="size-6" />
                  <span className="text-xs">{general.noCover}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-subtle">{general.coverHint}</p>

            {coverProgress !== null ? (
              <Progress value={coverProgress} label={general.coverUpload} />
            ) : (
              <>
                <input
                  ref={coverInput}
                  type="file"
                  accept={UPLOAD_ACCEPT.cover.join(",")}
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void onCoverPicked(file);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  block
                  disabled={readOnly}
                  onClick={() => coverInput.current?.click()}
                >
                  <Upload aria-hidden />
                  {coverUrl ? general.coverReplace : general.coverUpload}
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
