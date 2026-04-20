import { Link, useSearchParams } from "react-router-dom";
import clsx from "clsx";

import { PageSpinner } from "@/shared/ui/Spinner";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { formatDate, formatPrice } from "@/shared/format";
import { getErrorMessage } from "@/shared/api/errors";
import type { OrderStatus } from "@/shared/api/types";
import { useListOrdersQuery } from "./ordersApi";

const statusClass: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-emerald-100 text-emerald-800",
  shipped: "bg-sky-100 text-sky-800",
  delivered: "bg-slate-100 text-slate-800",
  cancelled: "bg-red-100 text-red-800",
};

export function OrdersPage() {
  const [params] = useSearchParams();
  const placedId = params.get("placed");
  const { data, isLoading, error, refetch } = useListOrdersQuery();

  if (isLoading) return <PageSpinner />;
  if (error) return <ErrorBanner message={getErrorMessage(error)} onRetry={refetch} />;

  const orders = data ?? [];

  return (
    <div className="space-y-6">
      {placedId ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Order placed. Confirmation #
          <span className="font-mono">{placedId.slice(0, 8)}</span> — we've sent a
          receipt to your email.
        </div>
      ) : null}

      <h1 className="text-2xl font-semibold">Your orders</h1>

      {orders.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-600">
          You haven't placed any orders yet.{" "}
          <Link to="/" className="text-brand-700 hover:underline">
            Start shopping
          </Link>
          .
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => (
            <li key={o.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-slate-500">
                    #{o.id.slice(0, 8)}
                  </p>
                  <p className="text-sm text-slate-600">
                    Placed {formatDate(o.created_at)}
                  </p>
                </div>
                <span
                  className={clsx(
                    "rounded-full px-3 py-1 text-xs font-medium capitalize",
                    statusClass[o.status],
                  )}
                >
                  {o.status}
                </span>
                <span className="text-lg font-semibold">{formatPrice(o.total)}</span>
              </div>
              <ul className="mt-3 divide-y divide-slate-200 text-sm">
                {o.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-4 py-2">
                    <span>
                      {i.product_name}{" "}
                      <span className="text-slate-500">× {i.quantity}</span>
                    </span>
                    <span>{formatPrice(Number(i.unit_price) * i.quantity)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
