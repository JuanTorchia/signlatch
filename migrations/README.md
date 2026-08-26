# Database migrations

Migration files use an immutable four-digit numeric prefix and a descriptive suffix,
for example `0002_secure_foundation.sql`. Apply them exactly once in ascending order.

- Never edit a migration after it has reached a shared database.
- Add a new migration to correct or extend historical schema.
- Migrations must be transactional unless the file documents why PostgreSQL forbids it.
- Production migration credentials must not be available to the web or worker runtime.
- Integration tests must use an isolated disposable database and may never target
  development or production data.
- Authority-state migrations require backup and restore-probe evidence before deployment.
