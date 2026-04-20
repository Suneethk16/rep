import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { PageSpinner } from "@/shared/ui/Spinner";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { Button } from "@/shared/ui/Button";
import { formatPrice } from "@/shared/format";
import { getErrorMessage } from "@/shared/api/errors";
import { useAppSelector } from "@/app/hooks";
import { selectIsAuthenticated } from "@/features/auth/authSlice";
import { useAddToCartMutation } from "@/features/cart/cartApi";
import { useGetProductQuery } from "./productsApi";

export function ProductDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const { data: product, isLoading, error, refetch } = useGetProductQuery(id, {
    skip: !id,
  });
  const [addToCart, { isLoading: adding, error: addError }] = useAddToCartMutation();

  const [quantity, setQuantity] = useState(1);

  if (isLoading) return <PageSpinner />;
  if (error) return <ErrorBanner message={getErrorMessage(error)} onRetry={refetch} />;
  if (!product) return null;

  const outOfStock = product.stock <= 0;
  const max = Math.max(1, product.stock || 1);

  const onAdd = async () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/products/${product.id}` } });
      return;
    }
    try {
      await addToCart({ product_id: product.id, quantity }).unwrap();
      navigate("/cart");
    } catch {
      /* banner */
    }
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="card aspect-square overflow-hidden bg-slate-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
            No image
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">SKU {product.sku}</p>
          <h1 className="mt-1 text-3xl font-semibold">{product.name}</h1>
          <p className="mt-2 text-2xl font-semibold text-brand-700">
            {formatPrice(product.price)}
          </p>
        </div>

        {product.description ? (
          <p className="whitespace-pre-line text-sm text-slate-700">
            {product.description}
          </p>
        ) : null}

        <p className="text-sm text-slate-600">
          {outOfStock
            ? "Currently out of stock."
            : `${product.stock} in stock`}
        </p>

        {addError ? <ErrorBanner message={getErrorMessage(addError)} /> : null}

        <div className="flex items-center gap-3">
          <label htmlFor="qty" className="text-sm text-slate-600">
            Qty
          </label>
          <input
            id="qty"
            type="number"
            min={1}
            max={max}
            value={quantity}
            onChange={(e) =>
              setQuantity(Math.max(1, Math.min(max, Number(e.target.value) || 1)))
            }
            className="input w-20"
            disabled={outOfStock}
          />
          <Button onClick={onAdd} loading={adding} disabled={outOfStock}>
            Add to cart
          </Button>
        </div>

        <Link to="/" className="text-sm text-brand-700 hover:underline">
          ← Back to shop
        </Link>
      </div>
    </div>
  );
}
