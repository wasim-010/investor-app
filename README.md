# Soppiya Investor App

Installable investor tracking app for Soppiya merchants. The app has three parts:

- `apps/api`: backend API that talks to Soppiya Graph and stores investors/assignments.
- `apps/merchant-app`: merchant dashboard for managing investors and assigned products.
- `apps/investor-portal`: investor dashboard for assigned product sales.

## Required Environment

API:

```env
PORT=4000
APP_NAME=Soppiya Investor App
APP_BASE_DOMAIN=example.com
SOPPIYA_GRAPH_URL=https://graph.soppiya.com/
SOPPIYA_STORE_DOMAIN=store.example.com
MERCHANT_API_KEY=long_random_value
SOPPIYA_INSTALL_SECRET=long_random_value_for_install_callback
INVESTOR_SESSION_SECRET=long_random_value_at_least_32_bytes
INVESTOR_SESSION_TTL_SECONDS=1209600
CORS_ORIGINS=https://merchant.example.com,https://investor.store.example.com
CORS_ORIGIN_SUFFIXES=example.com

# Optional local/demo fallback only. Production installs should write store
# tokens through /api/soppiya/install, keyed by storeDomain.
SOPPIYA_STORE_TOKEN=store_user_token_from_soppiya
```

Merchant app:

```env
PUBLIC_APP_API_URL=https://api.example.com
PUBLIC_MERCHANT_API_KEY=same_value_as_merchant_api_key_for_demo_only
PUBLIC_STORE_DOMAIN=store.example.com
```

Investor portal:

```env
PUBLIC_APP_API_URL=https://api.example.com
PUBLIC_STORE_DOMAIN=store.example.com
```

## Domain Model

For a merchant store domain such as `store.com`, the investor portal should be
hosted at:

```txt
investor.store.com
```

The frontends resolve the store domain from the host by default:

- `merchant.store.com` resolves to `store.com`.
- `investor.store.com` resolves to `store.com`.

For local development or fixed demo domains, set `PUBLIC_STORE_DOMAIN`.
For dynamic subdomains, set `CORS_ORIGIN_SUFFIXES` on the API so browser
requests from each merchant/investor host are accepted.

## Soppiya Install Flow

Production should not require a merchant to paste tokens. When a merchant
installs the app, Soppiya should call the backend install endpoint with the
store identity and a store-scoped access token:

```http
POST /api/soppiya/install
x-soppiya-install-secret: <SOPPIYA_INSTALL_SECRET>
content-type: application/json

{
  "storeDomain": "store.example.com",
  "storeId": "store_id_from_soppiya",
  "storeName": "Store name",
  "accessToken": "store_user_token_from_soppiya"
}
```

The API stores that token server-side and later resolves Soppiya Graph
credentials from `storeDomain`. Merchant and investor data is also scoped by
`storeDomain`, so the same backend can support multiple installed stores once
JSON persistence is replaced with a real database.

## Security Notes

- Soppiya store access tokens must stay server-side in `apps/api`.
- `SOPPIYA_STORE_TOKEN` is only a local/demo fallback.
- Investor login returns a signed session token. Dashboard restore requires that token.
- Merchant endpoints require `MERCHANT_API_KEY`. This is acceptable for private demos,
  but production Soppiya installation should replace it with Soppiya signed
  installation/session verification because browser-exposed keys are not secret.
- Local JSON data storage is suitable for demos only. Use PostgreSQL/MySQL/Supabase
  for production persistence.
