"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { applyApiError } from "@/lib/auth/form-errors";
import { createCourse, listCategories } from "@/lib/catalog/api";
import { courseFormSchema, type CourseFormValues } from "@/lib/catalog/schemas";
import { instructorMessages } from "@/lib/messages/instructor";
import type { Category } from "@/lib/catalog/types";

const FIELDS = ["title", "description", "categoryId", "price"] as const;

/**
 * Creates the course row, then hands straight over to the editor, where the
 * cover and the lessons are added. Splitting it this way keeps the first
 * screen short enough that nobody abandons it.
 */
export default function NewCoursePage() {
  const router = useRouter();
  const { create, general, nav } = instructorMessages;

  const [categories, setCategories] = useState<Category[]>([]);
  const [banner, setBanner] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: { title: "", description: "", categoryId: "", price: "0" },
  });

  useEffect(() => {
    void listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  async function onSubmit(values: CourseFormValues): Promise<void> {
    setBanner(null);

    try {
      const course = await createCourse(values);
      router.push(`/instructor/courses/${course.id}`);
    } catch (caught) {
      const message = applyApiError<CourseFormValues>(caught, setError, FIELDS);
      if (message) {
        setBanner(message);
      }
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Breadcrumb items={[{ label: nav.dashboard, href: "/instructor" }, { label: create.title }]} />

      <Card>
        <CardHeader>
          <CardTitle>{create.title}</CardTitle>
          <p className="mt-1 text-sm text-muted">{create.subtitle}</p>
        </CardHeader>

        <CardBody>
          <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            {banner && <Alert tone="error">{banner}</Alert>}

            <Field id="title" label={general.title} error={errors.title?.message}>
              <Input
                id="title"
                {...register("title")}
                invalid={Boolean(errors.title)}
                placeholder={general.titlePlaceholder}
                autoComplete="off"
              />
            </Field>

            <Field id="description" label={general.description} error={errors.description?.message}>
              <Textarea
                id="description"
                rows={6}
                {...register("description")}
                invalid={Boolean(errors.description)}
                placeholder={general.descriptionPlaceholder}
              />
            </Field>

            <Field id="categoryId" label={general.category} error={errors.categoryId?.message}>
              <Select
                id="categoryId"
                {...register("categoryId")}
                invalid={Boolean(errors.categoryId)}
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
              hint={general.priceHint}
              error={errors.price?.message}
            >
              <Input
                id="price"
                inputMode="decimal"
                {...register("price")}
                invalid={Boolean(errors.price)}
                className="tabular"
              />
            </Field>

            <div className="flex items-center gap-3 border-t border-border pt-5">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? create.submitting : create.submit}
              </Button>
              <Button asChild type="button" variant="ghost">
                <Link href="/instructor">{create.cancel}</Link>
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
