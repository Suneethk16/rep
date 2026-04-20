import { Outlet } from "react-router-dom";

import { useAppSelector } from "@/app/hooks";
import { selectIsAuthenticated } from "@/features/auth/authSlice";
import { useMeQuery } from "@/features/auth/authApi";
import { Navbar } from "./Navbar";

export function Layout() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  // Rehydrate the current user from the persisted token on cold start.
  // Result flows into authSlice.user via authApi.onQueryStarted.
  useMeQuery(undefined, { skip: !isAuthenticated });

  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        Rep Store — demo e-commerce, built with React + FastAPI.
      </footer>
    </div>
  );
}
