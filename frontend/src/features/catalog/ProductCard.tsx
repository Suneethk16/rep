import { Link } from "react-router-dom";

import { formatPrice } from "@/shared/format";
import type { Product } from "@/shared/api/types";

export function ProductCard({ product }: { product: Product }) {
  const outOfStock = product.stock <= 0;
  return (
    <Link
      to={`/products/${product.id}`}
      className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-slate-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            No image
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-2 text-sm font-medium text-slate-900">
          {product.name}
        </h3>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-base font-semibold text-slate-900">
            {formatPrice(product.price)}
          </span>
          {outOfStock ? (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              Out of stock
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
