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
SOPPIYA_STORE_TOKEN=store_user_token_from_soppiya
MERCHANT_API_KEY=long_random_value
INVESTOR_SESSION_SECRET=long_random_value_at_least_32_bytes
INVESTOR_SESSION_TTL_SECONDS=1209600
CORS_ORIGINS=https://merchant.example.com,https://investor.store.example.com
```

Merchant app:

```env
PUBLIC_APP_API_URL=https://api.example.com
PUBLIC_MERCHANT_API_KEY=same_value_as_merchant_api_key_for_demo_only
```

Investor portal:

```env
PUBLIC_APP_API_URL=https://api.example.com
```

## Domain Model

For a merchant store domain such as `store.com`, the investor portal should be
hosted at:

```txt
investor.store.com
```

The current app is single-store per API deployment. For a marketplace-scale
installable app, move store config and Soppiya store tokens into a database
keyed by store id/domain, then resolve the tenant from the request host.

## Security Notes

- `SOPPIYA_STORE_TOKEN` must stay server-side in `apps/api`.
- Investor login returns a signed session token. Dashboard restore requires that token.
- Merchant endpoints require `MERCHANT_API_KEY`. This is acceptable for private demos,
  but production Soppiya installation should replace it with Soppiya signed
  installation/session verification because browser-exposed keys are not secret.
- Local JSON data storage is suitable for demos only. Use PostgreSQL/MySQL/Supabase
  for production persistence.
