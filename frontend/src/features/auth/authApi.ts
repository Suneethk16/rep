import { api } from "@/shared/api/api";
import type { Token, User } from "@/shared/api/types";
import { tokensReceived, userLoaded } from "./authSlice";

interface LoginBody {
  email: string;
  password: string;
}

interface RegisterBody {
  email: string;
  password: string;
  full_name?: string;
}

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<Token, LoginBody>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(tokensReceived(data));
      },
      invalidatesTags: ["Me", "Cart"],
    }),
    register: build.mutation<Token, RegisterBody>({
      query: (body) => ({ url: "/auth/register", method: "POST", body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(tokensReceived(data));
      },
      invalidatesTags: ["Me", "Cart"],
    }),
    me: build.query<User, void>({
      query: () => "/auth/me",
      providesTags: ["Me"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(userLoaded(data));
        } catch {
          /* 401 handled by baseQueryWithRefresh */
        }
      },
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation, useMeQuery } = authApi;
