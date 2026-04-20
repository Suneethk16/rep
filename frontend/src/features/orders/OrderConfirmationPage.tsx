import { Link, useNavigate, useSearchParams } from "react-router-dom";
import clsx from "clsx";

import { PageSpinner } from "@/shared/ui/Spinner";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { Button } from "@/shared/ui/Button";
import { formatDate, formatPrice } from "@/shared/format";
import { getErrorMessage } from "@/shared/api/errors";
import type { OrderStatus } from "@/shared/api/types";
import { useGetOrderByPaymentIntentQuery } from "@/features/checkout/paymentApi";

const statusClass: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-emerald-100 text-emerald-800",
  shipped: "bg-sky-100 text-sky-800",
  delivered: "bg-slate-100 text-slate-800",
  cancelled: "bg-red-100 text-red-800",
};

export function OrderConfirmationPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const piId = params.get("payment_intent");
  const redirectStatus = params.get("redirect_status");

  // Stripe redirected back with a failed status (e.g. 3DS failure).
  if (redirectStatus === "failed") {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <div className="text-4xl">❌</div>
        <h1 className="text-2xl font-semibold text-red-700">Payment failed</h1>
        <p className="text-sm text-slate-600">
          Your payment could not be completed. No charge was made.
        </p>
        <Button onClick={() => navigate("/checkout")}>Try again</Button>
      </div>
    );
  }

  if (!piId) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-semibold">No payment reference found</h1>
        <p className="mt-2 text-sm text-slate-600">
          <Link to="/" className="text-brand-700 hover:underline">
            Return to shop
          </Link>
        </p>
      </div>
    );
  }

  return <ConfirmationContent piId={piId} />;
}

function ConfirmationContent({ piId }: { piId: string }) {
  const { data: order, isLoading, error, refetch } = useGetOrderByPaymentIntentQuery(piId);

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <PageSpinner />
        <p className="mt-4 text-sm text-slate-600">Confirming your payment…</p>
      </div>
    );
  }

  if (error) {
    const msg = getErrorMessage(error);
    const isProcessing = msg.toLowerCase().includes("not yet completed");

    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        {isProcessing ? (
          <>
            <div className="text-4xl">⏳</div>
            <h1 className="text-xl font-semibold">Payment is being processed</h1>
            <p className="text-sm text-slate-600">
              Your payment is still being confirmed. Please wait a moment and
              refresh.
            </p>
            <Button onClick={() => refetch()}>Refresh</Button>
          </>
        ) : (
          <>
            <ErrorBanner message={msg} onRetry={() => refetch()} />
            <Button variant="secondary" onClick={() => refetch()}>
              Retry
            </Button>
          </>
        )}
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Success header */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-6 py-5 text-center">
        <p className="text-3xl">✅</p>
        <h1 className="mt-2 text-2xl font-semibold text-emerald-800">
          Order confirmed!
        </h1>
        <p className="mt-1 text-sm text-emerald-700">
          Thank you for your purchase. A receipt has been sent to your email.
        </p>
      </div>

      {/* Order meta */}
      <section className="card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Order ID
            </p>
            <p className="mt-0.5 font-mono text-sm text-slate-800">
              #{order.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Date
            </p>
            <p className="mt-0.5 text-sm text-slate-800">
              {formatDate(order.created_at)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Payment
            </p>
            <span
              className={clsx(
                "mt-0.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                order.payment_status === "succeeded"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-yellow-100 text-yellow-800",
              )}
            >
              {order.payment_status}
            </span>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Order status
            </p>
            <span
              className={clsx(
                "mt-0.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                statusClass[order.status],
              )}
            >
              {order.status}
            </span>
          </div>
        </div>
      </section>

      {/* Items */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold">Items ordered</h2>
        <ul className="mt-4 divide-y divide-slate-200 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 py-3">
              <span>
                {item.product_name}{" "}
                <span className="text-slate-500">× {item.quantity}</span>
              </span>
              <span className="font-medium">
                {formatPrice(Number(item.unit_price) * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-base font-semibold">
          <span>Total</span>
          <span>{formatPrice(order.total)}</span>
        </div>
      </section>

      {/* Delivery address */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold">Delivery address</h2>
        <address className="mt-3 whitespace-pre-line text-sm text-slate-700 not-italic">
          {order.shipping_address}
        </address>
      </section>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pb-6">
        <Link to="/orders">
          <Button variant="secondary">View all orders</Button>
        </Link>
        <Link to="/">
          <Button>Continue shopping</Button>
        </Link>
      </div>
    </div>
  );
}
