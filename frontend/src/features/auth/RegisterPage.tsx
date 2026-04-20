import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";

import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { getErrorMessage } from "@/shared/api/errors";
import { useRegisterMutation } from "./authApi";

interface FormValues {
  email: string;
  full_name: string;
  password: string;
  confirm: string;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [register, { isLoading, error }] = useRegisterMutation();
  const {
    register: field,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>();

  const onSubmit = handleSubmit(async (values) => {
    try {
      await register({
        email: values.email,
        password: values.password,
        full_name: values.full_name || undefined,
      }).unwrap();
      navigate("/", { replace: true });
    } catch {
      /* banner */
    }
  });

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold">Create an account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Already have one?{" "}
          <Link to="/login" className="text-brand-700 hover:underline">
            Sign in
          </Link>
          .
        </p>

        {error ? (
          <div className="mt-4">
            <ErrorBanner message={getErrorMessage(error)} />
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...field("email", { required: "Email is required" })}
          />
          <Input
            label="Full name (optional)"
            autoComplete="name"
            {...field("full_name")}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...field("password", {
              required: "Password is required",
              minLength: { value: 8, message: "Minimum 8 characters" },
            })}
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...field("confirm", {
              validate: (v) => v === watch("password") || "Passwords do not match",
            })}
          />
          <Button type="submit" loading={isLoading} className="w-full">
            Create account
          </Button>
        </form>
      </div>
    </div>
  );
}
