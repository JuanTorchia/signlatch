# Foxit MCP developer setup

This guide configures the official Foxit PDF API MCP server for reversible PDF
preparation. It does not configure or authorize eSign dispatch.

## What you need

- A Foxit API Developer account.
- Foxit PDF Services credentials: API host, client ID and client secret.
- Python 3.11 or newer and `uv`.
- The official Python MCP server from
  [`foxitsoftware/foxit-pdf-api-mcp-server`](https://github.com/foxitsoftware/foxit-pdf-api-mcp-server).

Foxit's public pricing page was checked on 2026-08-25. It currently advertises
a free Developer plan with 500 shared credits per year. Upload-only requests do
not consume credits; most PDF operations consume one credit. Treat those values
as current portal information, not permanent product guarantees.

## Obtain credentials

1. Open the [Foxit API Developer Portal](https://developer-api.foxit.com/).
2. Choose **Sign Up / Login**. Foxit redirects to its account service.
3. Sign in with an existing Foxit account or choose **Create One**.
4. Complete any account verification and accept Foxit's terms yourself.
5. Return to the API dashboard and activate the free Developer plan if the
   account does not already have an active API plan.
6. In the dashboard, locate the PDF Services API credentials and copy the API
   host, client ID and client secret.

The public portal confirms that API keys are generated in the developer
account. Dashboard labels after authentication can change; do not guess a
credential value or copy eSign credentials into the PDF Services variables.

## Store credentials locally

Copy `.env.example` to `.env.local` and set:

```dotenv
FOXIT_CLOUD_API_HOST=https://na1.fusion.foxit.com/pdf-services
FOXIT_CLOUD_API_CLIENT_ID=replace-with-client-id
FOXIT_CLOUD_API_CLIENT_SECRET=replace-with-client-secret
FOXIT_MCP_COMMAND=uv
FOXIT_MCP_CWD=/absolute/path/to/python/foxit-pdf-api-mcp-server
SIGNLATCH_DEMO_ENABLED=true
```

Never commit `.env.local`, screenshots containing secrets, terminal output that
prints secrets, or a credential-bearing MCP configuration. Production secrets
must live in the deployment platform's encrypted secret store.

## Install and verify the official server

Clone the official repository outside this application, then install its Python
package exactly as described in its README:

```bash
git clone https://github.com/foxitsoftware/foxit-pdf-api-mcp-server.git
cd foxit-pdf-api-mcp-server/python/foxit-pdf-api-mcp-server
uv sync
```

SignLatch launches the server over `stdio`, the official server's default and
most mature transport. The repository exposes an HTTP option, but its entrypoint
still carries a warning that HTTP mode is being implemented. M3 therefore does
not depend on HTTP transport.

At official repository revision `db16f9d0f18b878a07f41621e708dbb78bc13e4c`,
package version `0.2.3`, the installed console script points to the obsolete
module `foxit_pdf_api_mcp` and exits with `ModuleNotFoundError`. SignLatch uses
the package's real module entrypoint internally. Remove this workaround only
after verifying a newer official release.

## M3 authority boundary

The application uses a fixed allowlist:

1. `upload_document`
2. `pdf_from_text`
3. `download_document`

User text is data, never a tool-selection instruction. The MCP catalog is not
exposed to a language model, `delete_document` is excluded, output must begin
with a PDF signature, and the final bytes are stored by SHA-256 in an immutable
artifact store. Foxit eSign remains a separate future adapter behind the human
approval latch.

## Troubleshooting

- `Missing required Foxit configuration`: one of the three PDF Services values
  is absent from the server environment.
- MCP process exits immediately: verify `uv`, `FOXIT_MCP_CWD`, Python 3.11+ and
  run `uv sync` in the official package directory.
- Authentication failure: confirm the credentials belong to PDF Services and
  that the API host matches the account region.
- No credits: inspect usage in the Foxit dashboard. Do not retry paid operations
  blindly.

## Evidence policy

A mocked test proves the orchestration contract, not Foxit integration. The
first credentialed run is recorded in `evidence/m3/foxit-text-to-pdf-2026-08-25.json`.
The authenticated dashboard later confirmed one credit used and 499 remaining;
that observation is recorded separately from the successful API response.
