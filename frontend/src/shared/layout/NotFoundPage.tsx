import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="text-sm text-slate-600">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary">
        Back to shop
      </Link>
    </div>
  );
}
