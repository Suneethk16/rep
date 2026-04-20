import { useState } from "react";

import { PageSpinner } from "@/shared/ui/Spinner";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { Button } from "@/shared/ui/Button";
import { formatPrice } from "@/shared/format";
import { getErrorMessage } from "@/shared/api/errors";
import type { Product } from "@/shared/api/types";
import {
  useDeleteProductMutation,
  useListCategoriesQuery,
  useListProductsQuery,
} from "@/features/catalog/productsApi";
import { AdminProductForm } from "./AdminProductForm";

export function AdminProductsPage() {
  const [editing, setEditing] = useState<Product | null | "new">(null);

  const { data: categories = [] } = useListCategoriesQuery();
  const { data, isLoading, error, refetch } = useListProductsQuery({
    page: 1,
    size: 100,
  });
  const [deleteProduct, { isLoading: deleting }] = useDeleteProductMutation();

  const onDelete = async (id: string) => {
    if (!window.confirm("Delete this product? This cannot be undone.")) return;
    try {
      await deleteProduct(id).unwrap();
    } catch (e) {
      window.alert(getErrorMessage(e as never));
    }
  };

  if (isLoading) return <PageSpinner />;
  if (error) return <ErrorBanner message={getErrorMessage(error)} onRetry={refetch} />;

  const products = data?.items ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-slate-600">
            {products.length} product{products.length === 1 ? "" : "s"}
          </p>
        </div>
        {editing === null ? (
          <Button onClick={() => setEditing("new")}>New product</Button>
        ) : null}
      </header>

      {editing !== null ? (
        <div className="card p-6">
          <AdminProductForm
            product={editing === "new" ? null : editing}
            categories={categories}
            onDone={() => setEditing(null)}
          />
        </div>
      ) : null}

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-10 w-10 rounded border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-slate-100" />
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-3">{p.name}</td>
                <td className="px-4 py-3">{formatPrice(p.price)}</td>
                <td className="px-4 py-3">
                  {p.stock} <span className="text-xs text-slate-400">{p.stock_unit === "kg" ? "kg" : "pcs"}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditing(p)}
                    className="text-sm text-brand-700 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => onDelete(p.id)}
                    className="ml-3 text-sm text-red-600 hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  No products yet. Click <strong>New product</strong> to add one.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
