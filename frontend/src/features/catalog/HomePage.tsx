import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { PageSpinner } from "@/shared/ui/Spinner";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { Button } from "@/shared/ui/Button";
import { getErrorMessage } from "@/shared/api/errors";
import { useListCategoriesQuery, useListProductsQuery } from "./productsApi";
import { ProductCard } from "./ProductCard";

const PAGE_SIZE = 12;

export function HomePage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? "1") || 1;
  const q = params.get("q") ?? "";
  const categoryId = params.get("category") ?? "";

  const [searchInput, setSearchInput] = useState(q);

  const queryArg = useMemo(
    () => ({
      page,
      size: PAGE_SIZE,
      q: q || undefined,
      category_id: categoryId || undefined,
    }),
    [page, q, categoryId],
  );

  const { data: categories } = useListCategoriesQuery();
  const { data, isLoading, isFetching, error, refetch } =
    useListProductsQuery(queryArg);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam("q", searchInput.trim() || null);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Shop everything</h1>
          <p className="text-sm text-slate-600">
            {data ? `${data.total} products` : "Browse the catalog"}
          </p>
        </div>
        <form onSubmit={onSearch} className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search products…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input w-64"
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </section>

      {categories && categories.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => updateParam("category", null)}
            className={
              categoryId
                ? "rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                : "rounded-full bg-brand-600 px-3 py-1 text-xs text-white"
            }
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => updateParam("category", c.id)}
              className={
                categoryId === c.id
                  ? "rounded-full bg-brand-600 px-3 py-1 text-xs text-white"
                  : "rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
              }
            >
              {c.name}
            </button>
          ))}
        </div>
      ) : null}

      {isLoading ? <PageSpinner /> : null}

      {error ? (
        <ErrorBanner message={getErrorMessage(error)} onRetry={refetch} />
      ) : null}

      {data && data.items.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-500">
          No products match your filters.
        </div>
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <div
            className={
              "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" +
              (isFetching ? " opacity-70" : "")
            }
          >
            {data.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => updateParam("page", String(page - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => updateParam("page", String(page + 1))}
            >
              Next
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
