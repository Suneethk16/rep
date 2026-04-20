import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";
import type { Token, User } from "@/shared/api/types";

const STORAGE_KEY = "rep.auth";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
}

interface PersistedAuth {
  accessToken: string | null;
  refreshToken: string | null;
}

function loadPersisted(): PersistedAuth {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { accessToken: null, refreshToken: null };
    const parsed = JSON.parse(raw) as PersistedAuth;
    return {
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

function persist(state: AuthState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    );
  } catch {
    // localStorage unavailable (private mode etc) — silent fallback to in-memory only
  }
}

const persisted = loadPersisted();
const initialState: AuthState = {
  accessToken: persisted.accessToken,
  refreshToken: persisted.refreshToken,
  user: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    tokensReceived(state, action: PayloadAction<Token>) {
      state.accessToken = action.payload.access_token;
      state.refreshToken = action.payload.refresh_token;
      persist(state);
    },
    tokensRefreshed(state, action: PayloadAction<Token>) {
      state.accessToken = action.payload.access_token;
      state.refreshToken = action.payload.refresh_token;
      persist(state);
    },
    userLoaded(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    loggedOut(state) {
      state.accessToken = null;
      state.refreshToken = null;
      state.user = null;
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    },
  },
});

export const { tokensReceived, tokensRefreshed, userLoaded, loggedOut } =
  authSlice.actions;

export default authSlice.reducer;

export const selectAccessToken = (s: RootState) => s.auth.accessToken;
export const selectRefreshToken = (s: RootState) => s.auth.refreshToken;
export const selectIsAuthenticated = (s: RootState) => Boolean(s.auth.accessToken);
export const selectCurrentUser = (s: RootState) => s.auth.user;
export const selectIsAdmin = (s: RootState) => s.auth.user?.role === "admin";
