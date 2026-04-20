import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { getErrorMessage } from "@/shared/api/errors";
import type { Address } from "@/shared/api/types";
import type { AddressBody } from "./userApi";

interface Props {
  initial?: Address | null;
  submitLabel?: string;
  showDefaultToggle?: boolean;
  submitting?: boolean;
  error?: unknown;
  onSubmit: (values: AddressBody) => Promise<void> | void;
  onCancel?: () => void;
}

const EMPTY: AddressBody = {
  full_name: "",
  phone_number: "",
  street: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
  is_default: false,
};

export function AddressForm({
  initial,
  submitLabel = "Save address",
  showDefaultToggle = true,
  submitting = false,
  error,
  onSubmit,
  onCancel,
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddressBody>({ defaultValues: initial ?? EMPTY });

  useEffect(() => {
    reset(
      initial
        ? {
            full_name: initial.full_name,
            phone_number: initial.phone_number,
            street: initial.street,
            city: initial.city,
            state: initial.state,
            postal_code: initial.postal_code,
            country: initial.country,
            is_default: initial.is_default,
          }
        : EMPTY,
    );
  }, [initial, reset]);

  const submit = handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      {error ? <ErrorBanner message={getErrorMessage(error)} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Full name"
          autoComplete="name"
          error={errors.full_name?.message}
          {...register("full_name", { required: "Required" })}
        />
        <Input
          label="Phone number"
          autoComplete="tel"
          error={errors.phone_number?.message}
          {...register("phone_number", {
            required: "Required",
            minLength: { value: 5, message: "Too short" },
          })}
        />
      </div>

      <Input
        label="Street"
        autoComplete="address-line1"
        error={errors.street?.message}
        {...register("street", { required: "Required" })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="City"
          autoComplete="address-level2"
          error={errors.city?.message}
          {...register("city", { required: "Required" })}
        />
        <Input
          label="State / region"
          autoComplete="address-level1"
          error={errors.state?.message}
          {...register("state", { required: "Required" })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Postal code"
          autoComplete="postal-code"
          error={errors.postal_code?.message}
          {...register("postal_code", { required: "Required" })}
        />
        <Input
          label="Country"
          autoComplete="country-name"
          error={errors.country?.message}
          {...register("country", { required: "Required" })}
        />
      </div>

      {showDefaultToggle ? (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            {...register("is_default")}
          />
          Set as default address
        </label>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
