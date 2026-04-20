import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { Mutex } from "./mutex";

import { loggedOut, tokensRefreshed } from "@/features/auth/authSlice";
import type { RootState } from "@/app/store";
import type { Token } from "./types";

// Empty base URL → requests go to same-origin, relying on the Vite dev proxy
// (see vite.config.ts) in development and on nginx in production.
const baseUrl = `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/v1`;

const rawBaseQuery = fetchBaseQuery({
  baseUrl,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) headers.set("authorization", `Bearer ${token}`);
    return headers;
  },
});

// Single-flight refresh: if several requests 401 at once, only one refresh fires.
const refreshMutex = new Mutex();

export const baseQueryWithRefresh: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, apiArg, extraOptions) => {
  let result = await rawBaseQuery(args, apiArg, extraOptions);

  if (result.error?.status !== 401) return result;

  const state = apiArg.getState() as RootState;
  const refreshToken = state.auth.refreshToken;
  if (!refreshToken) {
    apiArg.dispatch(loggedOut());
    return result;
  }

  const release = await refreshMutex.acquire();
  try {
    // Re-check after acquiring the lock — another caller may have refreshed.
    const tokenAfterWait = (apiArg.getState() as RootState).auth.accessToken;
    if (tokenAfterWait && tokenAfterWait !== state.auth.accessToken) {
      return rawBaseQuery(args, apiArg, extraOptions);
    }

    const refresh = await rawBaseQuery(
      {
        url: "/auth/refresh",
        method: "POST",
        body: { refresh_token: refreshToken },
      },
      apiArg,
      extraOptions,
    );

    if (refresh.data) {
      apiArg.dispatch(tokensRefreshed(refresh.data as Token));
      result = await rawBaseQuery(args, apiArg, extraOptions);
    } else {
      apiArg.dispatch(loggedOut());
    }
  } finally {
    release();
  }

  return result;
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithRefresh,
  tagTypes: [
    "Product",
    "Category",
    "Cart",
    "Order",
    "Me",
    "Address",
    "AdminUser",
    "AdminStats",
    "AdminOrder",
  ],
  endpoints: () => ({}),
});
