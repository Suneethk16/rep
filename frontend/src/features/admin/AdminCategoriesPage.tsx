import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { getErrorMessage } from "@/shared/api/errors";
import {
  useListCategoriesQuery,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
} from "@/features/catalog/productsApi";

interface FormValues {
  name: string;
  slug: string;
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function AdminCategoriesPage() {
  const { data: categories = [], isLoading, error, refetch } = useListCategoriesQuery();
  const [createCategory, createState] = useCreateCategoryMutation();
  const [deleteCategory] = useDeleteCategoryMutation();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { name: "", slug: "" } });

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue("slug", toSlug(e.target.value));
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createCategory({ name: values.name, slug: values.slug }).unwrap();
      reset({ name: "", slug: "" });
    } catch {
      /* error shown via createState.error */
    }
  });

  const onDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete category "${name}"? Products in this category will become uncategorised.`)) return;
    setDeleteError(null);
    try {
      await deleteCategory(id).unwrap();
    } catch (e) {
      setDeleteError(getErrorMessage(e as never));
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="text-sm text-slate-600">
          {categories.length} categor{categories.length === 1 ? "y" : "ies"}
        </p>
      </header>

      {/* Add category form */}
      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold">Add category</h2>
        {createState.error ? (
          <ErrorBanner message={getErrorMessage(createState.error)} />
        ) : null}
        <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit} noValidate>
          <div className="w-48">
            <Input
              label="Name"
              error={errors.name?.message}
              {...register("name", { required: "Required", onChange: onNameChange })}
            />
          </div>
          <div className="w-48">
            <Input
              label="Slug"
              error={errors.slug?.message}
              {...register("slug", {
                required: "Required",
                pattern: { value: /^[a-z0-9-]+$/, message: "Lowercase letters, numbers, hyphens only" },
              })}
            />
          </div>
          <Button type="submit" loading={createState.isLoading}>
            Add
          </Button>
        </form>
      </div>

      {/* Category list */}
      {deleteError ? <ErrorBanner message={deleteError} /> : null}
      {error ? (
        <ErrorBanner message={getErrorMessage(error)} onRetry={refetch} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500">
                    No categories yet. Add one above.
                  </td>
                </tr>
              ) : (
                categories.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.slug}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onDelete(c.id, c.name)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
