# Decap CMS OAuth Worker (GitHub)

This Cloudflare Worker provides the OAuth endpoints Decap CMS needs for the GitHub backend.

## What it does

- `GET /auth` starts the GitHub OAuth flow.
- `GET /callback` exchanges the code for a token and posts it back to Decap CMS.

## Setup steps (free)

1) Create a GitHub OAuth App
- Go to GitHub > Settings > Developer settings > OAuth Apps > New OAuth App.
- Homepage URL: your site URL (ex: https://YOUR-SITE-DOMAIN).
- Authorization callback URL: https://YOUR-OAUTH-DOMAIN/callback.
- Save and note the Client ID and Client Secret.

2) Create a Cloudflare Worker
- Install Wrangler (one-time): https://developers.cloudflare.com/workers/wrangler/
- From this folder, run:
  - `wrangler init oauth-worker`
  - Replace the generated `src/index.js` with `worker.js` content (or rename `worker.js` to `src/index.js`).
- Deploy:
  - `wrangler deploy`

3) Set Worker environment variables
- In Cloudflare dashboard > Workers & Pages > Your Worker > Settings > Variables:
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `ALLOWED_ORIGINS` (comma-separated list, ex: `https://YOUR-SITE-DOMAIN`)

4) Update Decap CMS config
- In `admin/config.yml`:
  - `base_url: https://YOUR-OAUTH-DOMAIN`
  - `auth_endpoint: auth`
  - Update `repo` and `branch`.

## Notes

- `ALLOWED_ORIGINS` must match the exact origin for your site (scheme + domain + optional port).
- GitHub OAuth App callback must be `https://YOUR-OAUTH-DOMAIN/callback`.

