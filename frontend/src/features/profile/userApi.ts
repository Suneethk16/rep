import { api } from "@/shared/api/api";
import { userLoaded } from "@/features/auth/authSlice";
import type { Address, User } from "@/shared/api/types";

export interface UpdateProfileBody {
  full_name?: string | null;
  email?: string;
  password?: string;
  current_password?: string;
}

export interface ChangePasswordBody {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface AvatarUploadResponse {
  avatar_url: string;
}

export interface AddressBody {
  full_name: string;
  phone_number: string;
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default?: boolean;
}

export type AddressPatch = Partial<AddressBody>;

export const userApi = api.injectEndpoints({
  endpoints: (build) => ({
    getUserProfile: build.query<User, void>({
      query: () => "/user/profile",
      providesTags: ["Me"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(userLoaded(data));
        } catch {
          /* handled upstream */
        }
      },
    }),
    updateUserProfile: build.mutation<User, UpdateProfileBody>({
      query: (body) => ({ url: "/user/profile", method: "PUT", body }),
      invalidatesTags: ["Me"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(userLoaded(data));
      },
    }),
    changePassword: build.mutation<void, ChangePasswordBody>({
      query: (body) => ({
        url: "/user/change-password",
        method: "PUT",
        body,
      }),
    }),
    uploadAvatar: build.mutation<AvatarUploadResponse, File>({
      query: (file) => {
        const form = new FormData();
        form.append("file", file);
        return {
          url: "/user/upload-profile-picture",
          method: "POST",
          body: form,
        };
      },
      invalidatesTags: ["Me"],
    }),
    listAddresses: build.query<Address[], void>({
      query: () => "/user/addresses",
      providesTags: (result) =>
        result
          ? [
              ...result.map((a) => ({ type: "Address" as const, id: a.id })),
              { type: "Address" as const, id: "LIST" },
            ]
          : [{ type: "Address" as const, id: "LIST" }],
    }),
    createAddress: build.mutation<Address, AddressBody>({
      query: (body) => ({ url: "/user/addresses", method: "POST", body }),
      invalidatesTags: [{ type: "Address", id: "LIST" }],
    }),
    updateAddress: build.mutation<
      Address,
      { id: string; patch: AddressPatch }
    >({
      query: ({ id, patch }) => ({
        url: `/user/addresses/${id}`,
        method: "PUT",
        body: patch,
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "Address", id: arg.id },
        { type: "Address", id: "LIST" },
      ],
    }),
    deleteAddress: build.mutation<void, string>({
      query: (id) => ({ url: `/user/addresses/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Address", id },
        { type: "Address", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetUserProfileQuery,
  useUpdateUserProfileMutation,
  useChangePasswordMutation,
  useUploadAvatarMutation,
  useListAddressesQuery,
  useCreateAddressMutation,
  useUpdateAddressMutation,
  useDeleteAddressMutation,
} = userApi;
