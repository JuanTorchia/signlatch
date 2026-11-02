# Security policy

SignLatch is an early public hackathon project and is not ready for production
documents or credentials.

Report security issues privately to the repository owner through GitHub. Do not
open a public issue containing credentials, documents, signatures, personal data
or exploit details that could place another system at risk.

The current test harness is intentionally local and uses synthetic fixtures. No
Foxit credential is required or accepted by the harness.

## Runtime dependency refresh — 2026-11-02

Keep the application and pinned Foxit source unchanged. Refresh Debian errata
(including Brotli), pin body-parser2.4.0 and @hono/node-server2.1.3, and update
Foxit dnspython to2.9.0 and opentelemetry-api to1.45.1. The Foxit lock now lives
in `security/foxit-uv.lock`, derived from the currently deployed resolved graph;
only those two Python distributions change. The image uses `uv sync --locked`
instead of selecting unrelated package upgrades during every build.

Validate the frozen Node lock, existing checks and disposable PostgreSQL
integration suite, plus the final image scan and synthetic HTTP/Python imports.
Use the previous image for rollback; there is no SQL migration or signing,
email, publication or provider operation in this change.
