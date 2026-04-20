import { api } from "@/shared/api/api";
import type { Category, Product, ProductPage } from "@/shared/api/types";

export interface ProductListArgs {
  page?: number;
  size?: number;
  q?: string;
  category_id?: string;
}

export interface ProductInput {
  sku: string;
  name: string;
  description?: string;
  price: string;
  stock: number;
  stock_unit?: string;
  image_url?: string | null;
  category_id?: string | null;
}

export interface CategoryInput {
  name: string;
  slug: string;
}

export const productsApi = api.injectEndpoints({
  endpoints: (build) => ({
    listProducts: build.query<ProductPage, ProductListArgs | void>({
      query: (args) => {
        const params: Record<string, string> = {};
        const a = args ?? {};
        if (a.page) params.page = String(a.page);
        if (a.size) params.size = String(a.size);
        if (a.q) params.q = a.q;
        if (a.category_id) params.category_id = a.category_id;
        return { url: "/products", params };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((p) => ({ type: "Product" as const, id: p.id })),
              { type: "Product" as const, id: "LIST" },
            ]
          : [{ type: "Product" as const, id: "LIST" }],
    }),
    getProduct: build.query<Product, string>({
      query: (id) => `/products/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Product", id }],
    }),
    createProduct: build.mutation<Product, ProductInput>({
      query: (body) => ({ url: "/products", method: "POST", body }),
      invalidatesTags: [{ type: "Product", id: "LIST" }],
    }),
    updateProduct: build.mutation<Product, { id: string; patch: Partial<ProductInput> }>({
      query: ({ id, patch }) => ({
        url: `/products/${id}`,
        method: "PATCH",
        body: patch,
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "Product", id: arg.id },
        { type: "Product", id: "LIST" },
      ],
    }),
    deleteProduct: build.mutation<void, string>({
      query: (id) => ({ url: `/products/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Product", id },
        { type: "Product", id: "LIST" },
      ],
    }),
    listCategories: build.query<Category[], void>({
      query: () => "/categories",
      providesTags: ["Category"],
    }),
    createCategory: build.mutation<Category, CategoryInput>({
      query: (body) => ({ url: "/categories", method: "POST", body }),
      invalidatesTags: ["Category"],
    }),
    deleteCategory: build.mutation<void, string>({
      query: (id) => ({ url: `/categories/${id}`, method: "DELETE" }),
      invalidatesTags: ["Category"],
    }),
  }),
});

export const {
  useListProductsQuery,
  useGetProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useListCategoriesQuery,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
} = productsApi;
