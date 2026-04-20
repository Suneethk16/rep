import { Link, useNavigate } from "react-router-dom";

import { PageSpinner } from "@/shared/ui/Spinner";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { Button } from "@/shared/ui/Button";
import { formatPrice } from "@/shared/format";
import { getErrorMessage } from "@/shared/api/errors";
import { useAppSelector } from "@/app/hooks";
import { selectIsAuthenticated } from "@/features/auth/authSlice";
import {
  useGetCartQuery,
  useRemoveCartItemMutation,
  useUpdateCartItemMutation,
} from "./cartApi";

export function CartPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const { data: cart, isLoading, error, refetch } = useGetCartQuery(undefined, {
    skip: !isAuthenticated,
  });
  const [updateItem, { isLoading: updating }] = useUpdateCartItemMutation();
  const [removeItem, { isLoading: removing }] = useRemoveCartItemMutation();

  if (!isAuthenticated) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-semibold">Your cart</h1>
        <p className="mt-2 text-sm text-slate-600">
          Please sign in to view your cart.
        </p>
        <Link to="/login" className="btn-primary mt-4 inline-flex">
          Sign in
        </Link>
      </div>
    );
  }

  if (isLoading) return <PageSpinner />;
  if (error) return <ErrorBanner message={getErrorMessage(error)} onRetry={refetch} />;

  const items = cart?.items ?? [];
  const subtotal = Number(cart?.total ?? 0);

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-semibold">Your cart is empty</h1>
        <Link to="/" className="btn-primary mt-4 inline-flex">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Your cart</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ul className="card divide-y divide-slate-200">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 p-4">
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded bg-slate-100">
                {item.product_image_url ? (
                  <img
                    src={item.product_image_url}
                    alt={item.product_name}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex-1">
                <Link
                  to={`/products/${item.product_id}`}
                  className="font-medium hover:underline"
                >
                  {item.product_name}
                </Link>
                <p className="text-sm text-slate-500">
                  {formatPrice(item.unit_price)} each
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, item.product_stock)}
                  value={item.quantity}
                  disabled={updating}
                  onChange={(e) => {
                    const q = Math.max(1, Number(e.target.value) || 1);
                    if (q !== item.quantity) {
                      void updateItem({ itemId: item.id, quantity: q });
                    }
                  }}
                  className="input w-20"
                />
              </div>
              <div className="w-24 text-right font-medium">
                {formatPrice(item.line_total)}
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={removing}
                className="text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        <aside className="card h-fit space-y-4 p-6">
          <h2 className="text-lg font-semibold">Summary</h2>
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span className="font-medium">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-500">
            <span>Shipping</span>
            <span>Calculated at checkout</span>
          </div>
          <div className="border-t border-slate-200 pt-3 text-base font-semibold">
            <div className="flex justify-between">
              <span>Total</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
          </div>
          <Button className="w-full" onClick={() => navigate("/checkout")}>
            Checkout
          </Button>
        </aside>
      </div>
    </div>
  );
}
