import { Fragment, useState } from "react";
import clsx from "clsx";

import { PageSpinner } from "@/shared/ui/Spinner";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { formatDate, formatPrice } from "@/shared/format";
import { getErrorMessage } from "@/shared/api/errors";
import type { Order, OrderStatus } from "@/shared/api/types";
import {
  useListAdminOrdersQuery,
  useUpdateAdminOrderStatusMutation,
} from "./adminApi";

const STATUS_OPTIONS: OrderStatus[] = [
  "pending",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
];

const STATUS_CLASS: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-emerald-100 text-emerald-800",
  shipped: "bg-sky-100 text-sky-800",
  delivered: "bg-slate-100 text-slate-800",
  cancelled: "bg-red-100 text-red-800",
};

export function AdminOrdersPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useListAdminOrdersQuery();
  const [updateStatus, { isLoading: saving, error: mutationError }] =
    useUpdateAdminOrderStatusMutation();

  if (isLoading) return <PageSpinner />;
  if (error) return <ErrorBanner message={getErrorMessage(error)} onRetry={refetch} />;

  const orders = data ?? [];

  const onStatusChange = async (order: Order, status: OrderStatus) => {
    if (status === order.status) return;
    try {
      await updateStatus({ id: order.id, status }).unwrap();
    } catch (e) {
      window.alert(getErrorMessage(e as never));
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-slate-600">
          {orders.length} order{orders.length === 1 ? "" : "s"}
        </p>
      </header>

      {mutationError ? (
        <ErrorBanner message={getErrorMessage(mutationError)} />
      ) : null}

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Placed</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {orders.map((o) => {
              const itemCount = o.items.reduce((n, i) => n + i.quantity, 0);
              const expanded = expandedId === o.id;
              return (
                <Fragment key={o.id}>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs">
                      #{o.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(o.created_at)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {o.user_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">{itemCount}</td>
                    <td className="px-4 py-3">{formatPrice(o.total)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={clsx(
                            "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                            STATUS_CLASS[o.status],
                          )}
                        >
                          {o.status}
                        </span>
                        <select
                          className="input h-8 py-0 text-xs"
                          value={o.status}
                          disabled={saving}
                          onChange={(e) =>
                            onStatusChange(o, e.target.value as OrderStatus)
                          }
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expanded ? null : o.id)
                        }
                        className="text-sm text-brand-700 hover:underline"
                      >
                        {expanded ? "Hide" : "View"}
                      </button>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr>
                      <td colSpan={7} className="bg-slate-50 px-4 py-4">
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Shipping address
                            </p>
                            <p className="text-sm text-slate-800">
                              {o.shipping_address}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Line items
                            </p>
                            <ul className="divide-y divide-slate-200 text-sm">
                              {o.items.map((i) => (
                                <li
                                  key={i.id}
                                  className="flex justify-between gap-4 py-1.5"
                                >
                                  <span>
                                    {i.product_name}
                                    <span className="text-slate-500">
                                      {" "}
                                      × {i.quantity}
                                    </span>
                                  </span>
                                  <span>
                                    {formatPrice(
                                      Number(i.unit_price) * i.quantity,
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {orders.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  No orders yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
