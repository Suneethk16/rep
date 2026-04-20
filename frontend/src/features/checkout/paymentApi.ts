import { api } from "@/shared/api/api";
import type { Order } from "@/shared/api/types";

export interface PaymentIntentResponse {
  client_secret: string;
  payment_intent_id: string;
  amount: string;
  currency: string;
}

export const paymentApi = api.injectEndpoints({
  endpoints: (build) => ({
    createPaymentIntent: build.mutation<
      PaymentIntentResponse,
      { address_id: string }
    >({
      query: (body) => ({
        url: "/payment/create-intent",
        method: "POST",
        body,
      }),
    }),
    getOrderByPaymentIntent: build.query<Order, string>({
      query: (piId) => `/payment/order/${piId}`,
      providesTags: (result) =>
        result
          ? [
              { type: "Order" as const, id: result.id },
              { type: "Order" as const, id: "LIST" },
            ]
          : [],
    }),
  }),
});

export const {
  useCreatePaymentIntentMutation,
  useGetOrderByPaymentIntentQuery,
} = paymentApi;
