import "dotenv/config";

export const config = {
  appName: process.env.APP_NAME ?? "Soppiya Investor App",
  appBaseDomain: process.env.APP_BASE_DOMAIN ?? "",
  port: Number(process.env.PORT ?? 4000),
  soppiyaGraphUrl: process.env.SOPPIYA_GRAPH_URL ?? "https://graph.soppiya.com/",
  soppiyaStoreToken: process.env.SOPPIYA_STORE_TOKEN ?? "",
  soppiyaStoreDomain: process.env.SOPPIYA_STORE_DOMAIN ?? "",
  merchantApiKey: process.env.MERCHANT_API_KEY ?? "",
  investorSessionSecret: process.env.INVESTOR_SESSION_SECRET ?? "",
  investorSessionTtlSeconds: Number(
    process.env.INVESTOR_SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 14,
  ),
  corsOrigins: (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
