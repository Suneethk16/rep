import { type FormEvent, useState } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

import { Button } from "@/shared/ui/Button";
import { formatPrice } from "@/shared/format";

interface Props {
  amount: string;
  onSuccess: (paymentIntentId: string) => void;
  onCancel: () => void;
}

export function PaymentForm({ amount, onSuccess, onCancel }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Fallback for redirect-based payment methods (e.g. 3D Secure).
        return_url: `${window.location.origin}/order-confirmation`,
      },
      // For standard card payments this resolves without redirect.
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message ?? "Payment failed. Please try again.");
      setSubmitting(false);
    } else if (paymentIntent?.status === "succeeded") {
      onSuccess(paymentIntent.id);
    } else {
      setError("Unexpected payment state. Please contact support.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3 pt-2">
        <Button
          type="submit"
          loading={submitting}
          disabled={!stripe || !elements}
          className="flex-1"
        >
          Pay {formatPrice(amount)}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={submitting}
          onClick={onCancel}
        >
          Back
        </Button>
      </div>

      <p className="text-center text-xs text-slate-500">
        Test card: 4242 4242 4242 4242 · any future date · any CVC
      </p>
    </form>
  );
}
