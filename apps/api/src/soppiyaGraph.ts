import { config } from "./config.js";

type GraphResponse<T> = {
  data?: T;
  errors?: Array<{
    message: string;
    path?: string[];
    extensions?: Record<string, unknown>;
  }>;
};

export class SoppiyaGraphError extends Error {
  constructor(public readonly errors: NonNullable<GraphResponse<unknown>["errors"]>) {
    super(errors.map((error) => error.message).join("; "));
  }
}

export async function soppiyaGraph<TData>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  if (!config.soppiyaStoreToken) {
    throw new Error("SOPPIYA_STORE_TOKEN is not configured");
  }

  const response = await fetch(config.soppiyaGraphUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: config.soppiyaStoreToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = (await response.json()) as GraphResponse<TData>;

  if (body.errors?.length) {
    throw new SoppiyaGraphError(body.errors);
  }

  if (!body.data) {
    throw new Error("Soppiya Graph returned no data");
  }

  return body.data;
}

export async function getStoreProducts(first = 20) {
  return soppiyaGraph<{
    products: {
      totalCount: number;
      edges: Array<{
        node: {
          _id: string;
          title: string;
          status: string;
          vendor?: string | null;
          type?: string | null;
          variants: {
            edges: Array<{
              node: {
                _id: string;
                option1?: string | null;
                option2?: string | null;
                option3?: string | null;
              };
            }>;
          };
        };
      }>;
    };
  }>(
    `
      query MerchantProducts($first: Int) {
        products(first: $first) {
          totalCount
          edges {
            node {
              _id
              title
              status
              vendor
              type
              variants(first: 20) {
                edges {
                  node {
                    _id
                    option1
                    option2
                    option3
                  }
                }
              }
            }
          }
        }
      }
    `,
    { first },
  );
}

export type AnalyticsOrder = {
  _id: string;
  serial_id: string;
  status: string;
  payment_status?: string | null;
  fulfillment_status?: string | null;
  total?: number | null;
  line_items: Array<{
    _id: string;
    quantity?: number | null;
    line_total?: number | null;
    product_title?: string | null;
    variant_title?: string | null;
    variant?: {
      _id: string;
      product?: {
        _id: string;
        title: string;
      } | null;
    } | null;
  }>;
};

export async function getStoreOrders(first = 100) {
  return soppiyaGraph<{
    orders: {
      totalCount: number;
      edges: Array<{ node: AnalyticsOrder }>;
    };
  }>(
    `
      query OrdersForAnalytics($first: Int) {
        orders(first: $first) {
          totalCount
          edges {
            node {
              _id
              serial_id
              status
              payment_status
              fulfillment_status
              total
              line_items {
                _id
                quantity
                line_total
                product_title
                variant_title
                variant {
                  _id
                  product {
                    _id
                    title
                  }
                }
              }
            }
          }
        }
      }
    `,
    { first },
  );
}
