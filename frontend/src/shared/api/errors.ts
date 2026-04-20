import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { SerializedError } from "@reduxjs/toolkit";

import type { ApiErrorBody } from "./types";

export function getErrorMessage(
  err: FetchBaseQueryError | SerializedError | undefined,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!err) return fallback;
  if ("status" in err) {
    const data = err.data as ApiErrorBody | { detail?: string } | undefined;
    if (data && typeof data === "object") {
      if ("error" in data && data.error?.message) return data.error.message;
      if ("detail" in data && typeof data.detail === "string") return data.detail;
    }
    if (err.status === "FETCH_ERROR") return "Network error — is the API reachable?";
  }
  return (err as SerializedError).message ?? fallback;
}
