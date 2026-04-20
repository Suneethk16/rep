import { api } from "@/shared/api/api";
import type {
  AdminStats,
  AdminUser,
  Order,
  OrderStatus,
  UserRole,
} from "@/shared/api/types";

interface AdminUserUpdate {
  is_active?: boolean;
  role?: UserRole;
}

interface UploadOut {
  url: string;
}

export const adminApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAdminStats: build.query<AdminStats, void>({
      query: () => "/admin/stats",
      providesTags: ["AdminStats"],
    }),

    listAdminUsers: build.query<AdminUser[], { page?: number; size?: number } | void>({
      query: (args) => {
        const params: Record<string, string> = {};
        const a = args ?? {};
        if (a.page) params.page = String(a.page);
        if (a.size) params.size = String(a.size);
        return { url: "/admin/users", params };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map((u) => ({ type: "AdminUser" as const, id: u.id })),
              { type: "AdminUser" as const, id: "LIST" },
            ]
          : [{ type: "AdminUser" as const, id: "LIST" }],
    }),

    updateAdminUser: build.mutation<
      AdminUser,
      { id: string; patch: AdminUserUpdate }
    >({
      query: ({ id, patch }) => ({
        url: `/admin/users/${id}`,
        method: "PATCH",
        body: patch,
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "AdminUser", id: arg.id },
        { type: "AdminUser", id: "LIST" },
        "AdminStats",
      ],
    }),

    listAdminOrders: build.query<Order[], { page?: number; size?: number } | void>({
      query: (args) => {
        const params: Record<string, string> = {};
        const a = args ?? {};
        if (a.page) params.page = String(a.page);
        if (a.size) params.size = String(a.size);
        return { url: "/orders/admin/all", params };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map((o) => ({ type: "AdminOrder" as const, id: o.id })),
              { type: "AdminOrder" as const, id: "LIST" },
            ]
          : [{ type: "AdminOrder" as const, id: "LIST" }],
    }),

    updateAdminOrderStatus: build.mutation<
      Order,
      { id: string; status: OrderStatus }
    >({
      query: ({ id, status }) => ({
        url: `/orders/admin/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "AdminOrder", id: arg.id },
        { type: "AdminOrder", id: "LIST" },
        "AdminStats",
      ],
    }),

    uploadProductImage: build.mutation<UploadOut, File>({
      query: (file) => {
        const form = new FormData();
        form.append("file", file);
        return {
          url: "/admin/uploads/product-image",
          method: "POST",
          body: form,
        };
      },
    }),
  }),
});

export const {
  useGetAdminStatsQuery,
  useListAdminUsersQuery,
  useUpdateAdminUserMutation,
  useListAdminOrdersQuery,
  useUpdateAdminOrderStatusMutation,
  useUploadProductImageMutation,
} = adminApi;
