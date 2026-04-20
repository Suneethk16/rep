import clsx from "clsx";

import { PageSpinner } from "@/shared/ui/Spinner";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { formatDate } from "@/shared/format";
import { getErrorMessage } from "@/shared/api/errors";
import { useAppSelector } from "@/app/hooks";
import { selectCurrentUser } from "@/features/auth/authSlice";
import {
  useListAdminUsersQuery,
  useUpdateAdminUserMutation,
} from "./adminApi";

export function AdminUsersPage() {
  const currentUser = useAppSelector(selectCurrentUser);
  const { data: users, isLoading, error, refetch } = useListAdminUsersQuery();
  const [updateUser, { isLoading: updating, error: updateError }] =
    useUpdateAdminUserMutation();

  if (isLoading) return <PageSpinner />;
  if (error) return <ErrorBanner message={getErrorMessage(error)} onRetry={refetch} />;

  const toggle = async (id: string, isActive: boolean) => {
    const verb = isActive ? "block" : "unblock";
    if (!window.confirm(`Are you sure you want to ${verb} this user?`)) return;
    try {
      await updateUser({ id, patch: { is_active: !isActive } }).unwrap();
    } catch (e) {
      window.alert(getErrorMessage(e as never));
    }
  };

  const rows = users ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-slate-600">
          {rows.length} user{rows.length === 1 ? "" : "s"}
        </p>
      </header>

      {updateError ? <ErrorBanner message={getErrorMessage(updateError)} /> : null}

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((u) => {
              const isSelf = currentUser?.id === u.id;
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3">{u.full_name ?? "—"}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        u.role === "admin"
                          ? "bg-brand-100 text-brand-800"
                          : "bg-slate-100 text-slate-700",
                      )}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        u.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800",
                      )}
                    >
                      {u.is_active ? "Active" : "Blocked"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={updating || isSelf}
                      onClick={() => toggle(u.id, u.is_active)}
                      className={clsx(
                        "text-sm hover:underline disabled:opacity-40",
                        u.is_active ? "text-red-600" : "text-emerald-700",
                      )}
                      title={isSelf ? "You cannot block yourself" : undefined}
                    >
                      {u.is_active ? "Block" : "Unblock"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  No users yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
