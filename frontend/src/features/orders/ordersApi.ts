import { api } from "@/shared/api/api";
import type { Order } from "@/shared/api/types";

interface CreateOrderBody {
  address_id?: string;
  shipping_address?: string;
}

export const ordersApi = api.injectEndpoints({
  endpoints: (build) => ({
    listOrders: build.query<Order[], void>({
      query: () => "/orders",
      providesTags: (result) =>
        result
          ? [
              ...result.map((o) => ({ type: "Order" as const, id: o.id })),
              { type: "Order" as const, id: "LIST" },
            ]
          : [{ type: "Order" as const, id: "LIST" }],
    }),
    getOrder: build.query<Order, string>({
      query: (id) => `/orders/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Order", id }],
    }),
    createOrder: build.mutation<Order, CreateOrderBody>({
      query: (body) => ({ url: "/orders", method: "POST", body }),
      invalidatesTags: [{ type: "Order", id: "LIST" }, "Cart", "Product"],
    }),
  }),
});

export const { useListOrdersQuery, useGetOrderQuery, useCreateOrderMutation } =
  ordersApi;
