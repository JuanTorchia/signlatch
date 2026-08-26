# Test fixture policy

Fixtures are deterministic, synthetic, and safe to publish. They must not contain
credentials, cookies, real webhook bodies, customer PDF text, or unnecessary personal
data. Provider fixtures record the source contract version and capture date.

Malformed PDF corpus cases belong under `tests/fixtures/pdf-malformed/` and include a
metadata sidecar containing the expected failure category. Keep corpus files minimal;
do not add weaponized payloads or samples with unclear redistribution rights.

Foxit response and webhook fixtures belong under `tests/fixtures/foxit/`. Sanitize
account, folder, document, party, email, and token values while preserving structure.
Every fixture must have a SHA-256 entry in its owning test or evidence manifest.
