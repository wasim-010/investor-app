import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  soppiyaGraphUrl: process.env.SOPPIYA_GRAPH_URL ?? "https://graph.soppiya.com/",
  soppiyaStoreToken: process.env.SOPPIYA_STORE_TOKEN ?? "",
  corsOrigins: (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
