# Pelu Pageviews Worker

First-party anonymous page-view counter for `pelu.wutoby.com`.

It stores only:

- `day`
- `path`
- aggregate `views`

It does not store IP addresses, user agents, cookies, referrers, or visitor IDs.

## Setup

1. Create a Cloudflare D1 database named `pelu_pageviews`.
2. Copy `wrangler.pageviews.toml.example` to `wrangler.pageviews.toml`.
3. Replace `database_id` with the D1 database id.
4. Apply the schema:

```sh
npx wrangler d1 execute pelu_pageviews --file workers/pageviews-schema.sql
```

5. Set an admin token:

```sh
npx wrangler secret put ADMIN_TOKEN --config wrangler.pageviews.toml
```

6. Deploy:

```sh
npx wrangler deploy --config wrangler.pageviews.toml
```

7. Add GitHub repository settings:

- Repository variable `WEB_STATS_ENDPOINT`: `https://pelu-pageviews.xhdwrjf72c.workers.dev/api/pageview/stats`
- Repository secret `WEB_STATS_TOKEN`: same value as the Worker `ADMIN_TOKEN`
