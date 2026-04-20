import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import clsx from "clsx";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  loggedOut,
  selectCurrentUser,
  selectIsAdmin,
  selectIsAuthenticated,
} from "@/features/auth/authSlice";
import { useGetCartQuery } from "@/features/cart/cartApi";
import { api } from "@/shared/api/api";
import type { User } from "@/shared/api/types";

function cartBadgeCount(items: { quantity: number }[] | undefined): number {
  if (!items) return 0;
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

function initials(user: User | null): string {
  if (!user) return "?";
  const source = user.full_name?.trim() || user.email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return source[0]?.toUpperCase() ?? "?";
  const first = parts[0][0] ?? "";
  const second = parts.length > 1 ? parts[1][0] ?? "" : "";
  return (first + second).toUpperCase();
}

export function Navbar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isAdmin = useAppSelector(selectIsAdmin);
  const user = useAppSelector(selectCurrentUser);

  const { data: cart } = useGetCartQuery(undefined, { skip: !isAuthenticated });
  const itemCount = cartBadgeCount(cart?.items);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    dispatch(loggedOut());
    dispatch(api.util.resetApiState());
    navigate("/login");
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      "text-sm font-medium",
      isActive ? "text-brand-700" : "text-slate-600 hover:text-slate-900",
    );

  const ordersPath = isAdmin ? "/admin/orders" : "/orders";

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="text-lg font-semibold text-brand-700">
          Rep Store
        </Link>
        <nav className="flex flex-1 items-center gap-4">
          <NavLink to="/" end className={linkClass}>
            Shop
          </NavLink>
          {isAuthenticated ? (
            <NavLink to={ordersPath} className={linkClass}>
              Orders
            </NavLink>
          ) : null}
          {isAdmin ? (
            <NavLink to="/admin" className={linkClass}>
              Admin
            </NavLink>
          ) : null}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/cart"
            className="relative text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            Cart
            {itemCount > 0 ? (
              <span className="absolute -right-3 -top-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-semibold text-white">
                {itemCount}
              </span>
            ) : null}
          </Link>
          {isAuthenticated ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-brand-600 text-sm font-semibold text-white ring-offset-2 transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                title={user?.email ?? "Account"}
              >
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials(user)
                )}
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
                >
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {user?.full_name || user?.email}
                    </p>
                    {user?.full_name ? (
                      <p className="truncate text-xs text-slate-500">
                        {user.email}
                      </p>
                    ) : null}
                  </div>
                  <MenuLink to="/profile" onClick={() => setMenuOpen(false)}>
                    Profile
                  </MenuLink>
                  <MenuLink to="/orders" onClick={() => setMenuOpen(false)}>
                    My Orders
                  </MenuLink>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="block w-full border-t border-slate-100 px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-50"
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <NavLink to="/login" className={linkClass}>
                Sign in
              </NavLink>
              <Link to="/register" className="btn-primary">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuLink({
  to,
  onClick,
  children,
}: {
  to: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onClick}
      className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
    >
      {children}
    </Link>
  );
}
