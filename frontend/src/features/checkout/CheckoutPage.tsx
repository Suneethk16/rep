import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import clsx from "clsx";

import { PageSpinner } from "@/shared/ui/Spinner";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { Button } from "@/shared/ui/Button";
import { formatPrice } from "@/shared/format";
import { getErrorMessage } from "@/shared/api/errors";
import { useGetCartQuery } from "@/features/cart/cartApi";
import { AddressForm } from "@/features/profile/AddressForm";
import {
  useCreateAddressMutation,
  useListAddressesQuery,
  useUpdateAddressMutation,
  type AddressBody,
} from "@/features/profile/userApi";
import type { Address } from "@/shared/api/types";
import { PaymentForm } from "./PaymentForm";
import { useCreatePaymentIntentMutation } from "./paymentApi";

// Initialise once at module level — never inside a component.
const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string)
  : null;

type Phase = "address" | "payment";

export function CheckoutPage() {
  const navigate = useNavigate();

  const { data: cart, isLoading: cartLoading } = useGetCartQuery();
  const {
    data: addresses,
    isLoading: addressesLoading,
    error: addressesError,
    refetch: refetchAddresses,
  } = useListAddressesQuery();

  const [createAddress, createState] = useCreateAddressMutation();
  const [updateAddress, updateState] = useUpdateAddressMutation();
  const [createPaymentIntent, piState] = useCreatePaymentIntentMutation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("address");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [piAmount, setPiAmount] = useState<string>("0");
  const [addressMode, setAddressMode] = useState<
    { kind: "list" } | { kind: "add" } | { kind: "edit"; address: Address }
  >({ kind: "list" });

  // Auto-select default address once list arrives.
  useEffect(() => {
    if (!addresses || addresses.length === 0) return;
    if (selectedId && addresses.some((a) => a.id === selectedId)) return;
    const def = addresses.find((a) => a.is_default) ?? addresses[0];
    setSelectedId(def.id);
  }, [addresses, selectedId]);

  if (cartLoading || addressesLoading) return <PageSpinner />;

  const items = cart?.items ?? [];
  const subtotal = Number(cart?.total ?? 0);
  const list = addresses ?? [];

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-semibold">Nothing to check out</h1>
        <p className="mt-2 text-sm text-slate-600">
          Add products to your cart before checking out.
        </p>
      </div>
    );
  }

  // ── Address handlers ───────────────────────────────────────────────

  const handleCreate = async (values: AddressBody) => {
    try {
      const created = await createAddress(values).unwrap();
      setSelectedId(created.id);
      setAddressMode({ kind: "list" });
    } catch {
      /* banner inside AddressForm */
    }
  };

  const handleUpdate = async (id: string, values: AddressBody) => {
    try {
      await updateAddress({ id, patch: values }).unwrap();
      setSelectedId(id);
      setAddressMode({ kind: "list" });
    } catch {
      /* banner inside AddressForm */
    }
  };

  // ── Proceed to payment ─────────────────────────────────────────────

  const handleProceedToPayment = async () => {
    if (!selectedId) return;
    try {
      const result = await createPaymentIntent({
        address_id: selectedId,
      }).unwrap();
      setClientSecret(result.client_secret);
      setPiAmount(result.amount);
      setPhase("payment");
    } catch {
      /* piState.error shown below */
    }
  };

  const handlePaymentSuccess = (piId: string) => {
    navigate(`/order-confirmation?payment_intent=${piId}`, { replace: true });
  };

  const handleBackToAddress = () => {
    setPhase("address");
    setClientSecret(null);
  };

  // ── Stripe not configured ──────────────────────────────────────────

  if (phase === "payment" && !stripePromise) {
    return (
      <div className="py-16 text-center text-sm text-slate-600">
        Stripe is not configured.{" "}
        <span className="font-mono">VITE_STRIPE_PUBLISHABLE_KEY</span> is
        missing.
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <section>
        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-3 text-sm">
          <span
            className={clsx(
              "font-medium",
              phase === "address" ? "text-brand-700" : "text-slate-400",
            )}
          >
            1 · Delivery address
          </span>
          <span className="text-slate-300">›</span>
          <span
            className={clsx(
              "font-medium",
              phase === "payment" ? "text-brand-700" : "text-slate-400",
            )}
          >
            2 · Payment
          </span>
        </div>

        {/* ── Phase 1: address ── */}
        {phase === "address" && (
          <>
            {piState.error ? (
              <div className="mb-4">
                <ErrorBanner message={getErrorMessage(piState.error)} />
              </div>
            ) : null}
            {addressesError ? (
              <div className="mb-4">
                <ErrorBanner
                  message={getErrorMessage(addressesError)}
                  onRetry={() => refetchAddresses()}
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold">Delivery address</h1>
              {addressMode.kind === "list" && list.length > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAddressMode({ kind: "add" })}
                >
                  Add new
                </Button>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {addressMode.kind === "add" ? (
                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="mb-3 text-sm font-medium text-slate-700">
                    New address
                  </h3>
                  <AddressForm
                    submitting={createState.isLoading}
                    error={createState.error}
                    onSubmit={handleCreate}
                    onCancel={
                      list.length > 0
                        ? () => setAddressMode({ kind: "list" })
                        : undefined
                    }
                  />
                </div>
              ) : addressMode.kind === "edit" ? (
                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="mb-3 text-sm font-medium text-slate-700">
                    Edit address
                  </h3>
                  <AddressForm
                    initial={addressMode.address}
                    submitting={updateState.isLoading}
                    error={updateState.error}
                    onSubmit={(v) => handleUpdate(addressMode.address.id, v)}
                    onCancel={() => setAddressMode({ kind: "list" })}
                  />
                </div>
              ) : list.length === 0 ? (
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="mb-3 text-sm text-slate-600">
                    Add a delivery address to continue.
                  </p>
                  <AddressForm
                    submitting={createState.isLoading}
                    error={createState.error}
                    onSubmit={handleCreate}
                    showDefaultToggle={false}
                  />
                </div>
              ) : (
                list.map((address) => {
                  const selected = selectedId === address.id;
                  return (
                    <label
                      key={address.id}
                      className={clsx(
                        "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition",
                        selected
                          ? "border-brand-600 bg-brand-50/40 ring-2 ring-brand-500"
                          : "border-slate-200 hover:border-slate-300",
                      )}
                    >
                      <input
                        type="radio"
                        name="shipping-address"
                        checked={selected}
                        onChange={() => setSelectedId(address.id)}
                        className="mt-1 h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <div className="flex-1 text-sm text-slate-700">
                        <p className="font-medium">
                          {address.full_name}
                          {address.is_default ? (
                            <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                              Default
                            </span>
                          ) : null}
                        </p>
                        <p className="text-slate-500">{address.phone_number}</p>
                        <p className="mt-1">{address.street}</p>
                        <p>
                          {address.city}, {address.state} {address.postal_code}
                        </p>
                        <p>{address.country}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setAddressMode({ kind: "edit", address });
                        }}
                        className="shrink-0 text-sm font-medium text-brand-700 hover:underline"
                      >
                        Edit
                      </button>
                    </label>
                  );
                })
              )}
            </div>

            {addressMode.kind === "list" && list.length > 0 ? (
              <Button
                type="button"
                onClick={handleProceedToPayment}
                loading={piState.isLoading}
                disabled={!selectedId}
                className="mt-6 w-full"
              >
                Proceed to payment →
              </Button>
            ) : null}
          </>
        )}

        {/* ── Phase 2: payment ── */}
        {phase === "payment" && clientSecret && stripePromise ? (
          <div>
            <h1 className="text-2xl font-semibold">Payment</h1>
            <div className="mt-6 rounded-lg border border-slate-200 p-6">
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: { theme: "stripe" },
                }}
              >
                <PaymentForm
                  amount={piAmount}
                  onSuccess={handlePaymentSuccess}
                  onCancel={handleBackToAddress}
                />
              </Elements>
            </div>
          </div>
        ) : null}
      </section>

      {/* ── Order summary sidebar ── */}
      <aside className="card h-fit p-6">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <ul className="mt-3 divide-y divide-slate-200 text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between gap-4 py-2">
              <span className="truncate">
                {i.product_name}{" "}
                <span className="text-slate-500">× {i.quantity}</span>
              </span>
              <span className="font-medium">{formatPrice(i.line_total)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-base font-semibold">
          <span>Total</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
      </aside>
    </div>
  );
}
