import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";

import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { getErrorMessage } from "@/shared/api/errors";
import { useLoginMutation } from "./authApi";

interface FormValues {
  email: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [login, { isLoading, error }] = useLoginMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>();

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values).unwrap();
      const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(redirectTo, { replace: true });
    } catch {
      /* banner rendered below */
    }
  });

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">
          Don't have an account?{" "}
          <Link to="/register" className="text-brand-700 hover:underline">
            Create one
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
            {...register("email", { required: "Email is required" })}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password", { required: "Password is required" })}
          />
          <Button type="submit" loading={isLoading} className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
