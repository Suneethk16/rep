import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { PageSpinner } from "@/shared/ui/Spinner";
import { getErrorMessage } from "@/shared/api/errors";
import { formatDate } from "@/shared/format";
import type { Address, User } from "@/shared/api/types";
import { AddressForm } from "./AddressForm";
import {
  useChangePasswordMutation,
  useCreateAddressMutation,
  useDeleteAddressMutation,
  useGetUserProfileQuery,
  useListAddressesQuery,
  useUpdateAddressMutation,
  useUpdateUserProfileMutation,
  useUploadAvatarMutation,
  type AddressBody,
  type UpdateProfileBody,
} from "./userApi";

function avatarInitials(user: User): string {
  const source = user.full_name?.trim() || user.email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return source[0]?.toUpperCase() ?? "?";
  const first = parts[0][0] ?? "";
  const second = parts.length > 1 ? parts[1][0] ?? "" : "";
  return (first + second).toUpperCase();
}

export function ProfilePage() {
  const { data: profile, isLoading, error, refetch } = useGetUserProfileQuery();

  if (isLoading) return <PageSpinner />;
  if (error)
    return <ErrorBanner message={getErrorMessage(error)} onRetry={refetch} />;
  if (!profile) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <p className="text-sm text-slate-600">
          Member since {formatDate(profile.created_at)} · Role{" "}
          <span className="capitalize">{profile.role}</span>
        </p>
      </header>

      <AvatarSection profile={profile} />
      <PersonalInfoSection profile={profile} />
      <ChangePasswordSection />
      <AddressesSection />
    </div>
  );
}

// ─── Avatar ─────────────────────────────────────────────────────────

function AvatarSection({ profile }: { profile: User }) {
  const [uploadAvatar, { isLoading, error }] = useUploadAvatarMutation();
  const [preview, setPreview] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const displayUrl = preview ?? profile.avatar_url;

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setSuccess(null);
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    try {
      await uploadAvatar(file).unwrap();
      setSuccess("Profile picture updated.");
      if (fileRef.current) fileRef.current.value = "";
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
    } catch {
      /* banner below */
    }
  };

  const handleClear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">Profile picture</h2>
      {error ? (
        <div className="mt-4">
          <ErrorBanner message={getErrorMessage(error)} />
        </div>
      ) : null}
      {success ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-5">
        <div className="h-20 w-20 overflow-hidden rounded-full bg-brand-600 text-white">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Avatar"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-semibold">
              {avatarInitials(profile)}
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handlePick}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleUpload}
              loading={isLoading}
              disabled={!preview}
            >
              Upload
            </Button>
            {preview ? (
              <Button
                type="button"
                variant="secondary"
                onClick={handleClear}
                disabled={isLoading}
              >
                Clear
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">
            JPG, PNG, WEBP or GIF up to 5 MB.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Personal info ──────────────────────────────────────────────────

interface InfoFormValues {
  full_name: string;
  email: string;
}

function PersonalInfoSection({ profile }: { profile: User }) {
  const [updateProfile, { isLoading, error }] = useUpdateUserProfileMutation();
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<InfoFormValues>({
    defaultValues: {
      full_name: profile.full_name ?? "",
      email: profile.email,
    },
  });

  useEffect(() => {
    reset({ full_name: profile.full_name ?? "", email: profile.email });
  }, [profile, reset]);

  const newEmail = watch("email");
  const emailChanging =
    newEmail.trim().length > 0 &&
    newEmail.trim().toLowerCase() !== profile.email;

  const onSubmit = handleSubmit(async (values) => {
    const body: UpdateProfileBody = {
      full_name: values.full_name.trim() || null,
    };
    if (emailChanging) {
      body.email = values.email.trim();
      body.current_password = currentPassword;
    }
    setSuccess(null);
    try {
      await updateProfile(body).unwrap();
      setSuccess("Profile updated.");
      setCurrentPassword("");
      reset({
        full_name: values.full_name,
        email: emailChanging ? values.email.trim() : profile.email,
      });
    } catch {
      /* banner below */
    }
  });

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">Personal info</h2>
      {error ? (
        <div className="mt-4">
          <ErrorBanner message={getErrorMessage(error)} />
        </div>
      ) : null}
      {success ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <form className="mt-4 space-y-4" onSubmit={onSubmit} noValidate>
        <Input
          label="Full name"
          autoComplete="name"
          error={errors.full_name?.message}
          {...register("full_name", {
            maxLength: { value: 255, message: "Too long" },
          })}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email", {
            required: "Email is required",
            pattern: { value: /.+@.+\..+/, message: "Invalid email" },
          })}
        />
        {emailChanging ? (
          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        ) : null}
        <div className="flex items-center justify-end pt-2">
          <Button
            type="submit"
            loading={isLoading}
            disabled={!isDirty || (emailChanging && !currentPassword)}
          >
            Update info
          </Button>
        </div>
      </form>
    </section>
  );
}

// ─── Change password ────────────────────────────────────────────────

interface PasswordFormValues {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

function ChangePasswordSection() {
  const [changePassword, { isLoading, error }] = useChangePasswordMutation();
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSuccess(null);
    try {
      await changePassword(values).unwrap();
      setSuccess("Password changed successfully.");
      reset();
    } catch {
      /* banner below */
    }
  });

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">Change password</h2>
      {error ? (
        <div className="mt-4">
          <ErrorBanner message={getErrorMessage(error)} />
        </div>
      ) : null}
      {success ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <form className="mt-4 space-y-4" onSubmit={onSubmit} noValidate>
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          error={errors.current_password?.message}
          {...register("current_password", { required: "Required" })}
        />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          error={errors.new_password?.message}
          {...register("new_password", {
            required: "Required",
            minLength: { value: 8, message: "Minimum 8 characters" },
          })}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm_password?.message}
          {...register("confirm_password", {
            required: "Required",
            validate: (v) =>
              v === watch("new_password") || "Passwords do not match",
          })}
        />
        <div className="flex items-center justify-end pt-2">
          <Button type="submit" loading={isLoading}>
            Update password
          </Button>
        </div>
      </form>
    </section>
  );
}

// ─── Addresses ──────────────────────────────────────────────────────

function AddressesSection() {
  const { data: addresses, isLoading, error, refetch } = useListAddressesQuery();
  const [createAddress, createState] = useCreateAddressMutation();
  const [updateAddress, updateState] = useUpdateAddressMutation();
  const [deleteAddress] = useDeleteAddressMutation();
  const [mode, setMode] = useState<
    { kind: "idle" } | { kind: "add" } | { kind: "edit"; address: Address }
  >({ kind: "idle" });

  const handleCreate = async (values: AddressBody) => {
    try {
      await createAddress(values).unwrap();
      setMode({ kind: "idle" });
    } catch {
      /* banner via AddressForm */
    }
  };

  const handleUpdate = async (id: string, values: AddressBody) => {
    try {
      await updateAddress({ id, patch: values }).unwrap();
      setMode({ kind: "idle" });
    } catch {
      /* banner via AddressForm */
    }
  };

  const handleSetDefault = async (address: Address) => {
    if (address.is_default) return;
    await updateAddress({
      id: address.id,
      patch: { is_default: true },
    }).unwrap();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this address?")) return;
    await deleteAddress(id).unwrap();
  };

  const list = addresses ?? [];

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Saved addresses</h2>
        {mode.kind === "idle" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setMode({ kind: "add" })}
          >
            Add address
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorBanner
            message={getErrorMessage(error)}
            onRetry={() => refetch()}
          />
        </div>
      ) : null}

      {mode.kind === "add" ? (
        <div className="mt-4 rounded-lg border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-medium text-slate-700">
            New address
          </h3>
          <AddressForm
            submitting={createState.isLoading}
            error={createState.error}
            onSubmit={handleCreate}
            onCancel={() => setMode({ kind: "idle" })}
          />
        </div>
      ) : null}

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-500">Loading addresses…</p>
      ) : list.length === 0 && mode.kind === "idle" ? (
        <p className="mt-4 text-sm text-slate-500">
          You haven't added any addresses yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {list.map((address) =>
            mode.kind === "edit" && mode.address.id === address.id ? (
              <li
                key={address.id}
                className="rounded-lg border border-slate-200 p-4"
              >
                <h3 className="mb-3 text-sm font-medium text-slate-700">
                  Edit address
                </h3>
                <AddressForm
                  initial={address}
                  submitting={updateState.isLoading}
                  error={updateState.error}
                  onSubmit={(values) => handleUpdate(address.id, values)}
                  onCancel={() => setMode({ kind: "idle" })}
                />
              </li>
            ) : (
              <li
                key={address.id}
                className="rounded-lg border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm text-slate-700">
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
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setMode({ kind: "edit", address })
                        }
                        className="text-sm font-medium text-brand-700 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(address.id)}
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                    {!address.is_default ? (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(address)}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        Set as default
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
