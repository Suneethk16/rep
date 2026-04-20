import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { getErrorMessage } from "@/shared/api/errors";
import type { Category, Product } from "@/shared/api/types";
import {
  useCreateProductMutation,
  useUpdateProductMutation,
  type ProductInput,
} from "@/features/catalog/productsApi";
import { useUploadProductImageMutation } from "./adminApi";

interface Props {
  product?: Product | null;
  categories: Category[];
  onDone: () => void;
}

interface FormValues {
  sku: string;
  name: string;
  description: string;
  price: string;
  stock: number;
  stock_unit: string;
  image_url: string;
  category_id: string;
}

export function AdminProductForm({ product, categories, onDone }: Props) {
  const editing = Boolean(product);
  const [createProduct, createState] = useCreateProductMutation();
  const [updateProduct, updateState] = useUpdateProductMutation();
  const [uploadImage, uploadState] = useUploadProductImageMutation();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const busy =
    createState.isLoading || updateState.isLoading || uploadState.isLoading;
  const mutationError = createState.error ?? updateState.error;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      sku: "",
      name: "",
      description: "",
      price: "",
      stock: 0,
      stock_unit: "qty",
      image_url: "",
      category_id: "",
    },
  });

  useEffect(() => {
    reset({
      sku: product?.sku ?? "",
      name: product?.name ?? "",
      description: product?.description ?? "",
      price: product?.price ?? "",
      stock: product?.stock ?? 0,
      stock_unit: product?.stock_unit ?? "qty",
      image_url: product?.image_url ?? "",
      category_id: product?.category_id ?? "",
    });
    setUploadError(null);
  }, [product, reset]);

  const imageUrl = watch("image_url");

  const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const { url } = await uploadImage(file).unwrap();
      setValue("image_url", url, { shouldDirty: true });
    } catch (err) {
      setUploadError(getErrorMessage(err as never));
    } finally {
      e.target.value = "";
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    const payload: ProductInput = {
      sku: values.sku,
      name: values.name,
      description: values.description,
      price: values.price,
      stock: Number(values.stock),
      stock_unit: values.stock_unit,
      image_url: values.image_url || null,
      category_id: values.category_id || null,
    };
    try {
      if (product) {
        await updateProduct({ id: product.id, patch: payload }).unwrap();
      } else {
        await createProduct(payload).unwrap();
      }
      onDone();
    } catch {
      /* banner below */
    }
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <h2 className="text-lg font-semibold">
        {editing ? "Edit product" : "New product"}
      </h2>

      {mutationError ? (
        <ErrorBanner message={getErrorMessage(mutationError)} />
      ) : null}
      {uploadError ? <ErrorBanner message={uploadError} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="SKU"
          error={errors.sku?.message}
          {...register("sku", { required: "Required" })}
        />
        <Input
          label="Name"
          error={errors.name?.message}
          {...register("name", { required: "Required" })}
        />
      </div>

      <div>
        <label htmlFor="description" className="label">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          className="input"
          {...register("description")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Price (₹)"
          type="number"
          step="0.01"
          min="0"
          error={errors.price?.message}
          {...register("price", { required: "Required" })}
        />
        <div>
          <label className="label">Category</label>
          <select className="input" {...register("category_id")}>
            <option value="">— none —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {categories.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">
              No categories yet — add some in the{" "}
              <a href="/admin/categories" className="underline">
                Categories
              </a>{" "}
              page.
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="label">Stock</label>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            className="input w-32"
            {...register("stock", { required: "Required", valueAsNumber: true })}
          />
          <select
            className="input w-36"
            {...register("stock_unit")}
            title="Stock unit"
          >
            <option value="qty">Quantity (pcs)</option>
            <option value="kg">Weight (kg)</option>
          </select>
        </div>
        {errors.stock && (
          <p className="mt-1 text-xs text-red-600">{errors.stock.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Input label="Image URL" {...register("image_url")} />
        <div className="flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <input
              type="file"
              accept="image/*"
              onChange={onFileSelect}
              className="hidden"
              disabled={uploadState.isLoading}
            />
            {uploadState.isLoading ? "Uploading…" : "Upload image"}
          </label>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Product preview"
              className="h-12 w-12 rounded border border-slate-200 object-cover"
            />
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" loading={busy}>
          {editing ? "Save changes" : "Create product"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
