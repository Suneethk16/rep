import { PageSpinner } from "@/shared/ui/Spinner";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { formatPrice } from "@/shared/format";
import { getErrorMessage } from "@/shared/api/errors";
import { useGetAdminStatsQuery } from "./adminApi";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
}

function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function AdminOverviewPage() {
  const { data, isLoading, error, refetch } = useGetAdminStatsQuery();

  if (isLoading) return <PageSpinner />;
  if (error) return <ErrorBanner message={getErrorMessage(error)} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-600">Store health at a glance.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={data.total_users} />
        <StatCard label="Total products" value={data.total_products} />
        <StatCard label="Total orders" value={data.total_orders} />
        <StatCard
          label="Total revenue"
          value={formatPrice(data.total_revenue)}
          hint="Paid, shipped, or delivered orders"
        />
      </div>
    </div>
  );
}
