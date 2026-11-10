# Bhaswara API

The API is an Express/TypeScript service backed by PostgreSQL through Prisma ORM 7 and
the `pg` driver adapter.

## Local setup

From the repository's `app` directory:

```powershell
Copy-Item apps\api\.env.example apps\api\.env
npm install
npm --workspace @bhaswara/api run db:generate
npm --workspace @bhaswara/api run db:migrate:dev
npm --workspace @bhaswara/api run dev
```

Set `DATABASE_URL` to a reachable PostgreSQL database and replace `JWT_SECRET` with at
least 32 random bytes. The sample values are placeholders. Never commit `.env`.

## Database workflow

- `db:generate` generates the Prisma client from `prisma/schema.prisma`.
- `db:migrate:dev` creates and applies a migration for local development.
- `db:migrate` applies committed migrations to a deployment database.
- `db:status` reports migration state.

Use reviewed, committed migrations for deployment. Take and verify backups before schema
changes that may affect existing data.

## Authentication and progress

- `POST /auth/register` accepts `username`, `email`, and a password of at least 12
  characters; new accounts always receive the learner role.
- `POST /auth/login` accepts `username` and `password`.
- `POST /auth/refresh` rotates a refresh token and issues a new access token.
- Authenticated routes require `Authorization: Bearer <access-token>`.
- Access tokens expire after 30 minutes. Refresh tokens are opaque, stored only as
  SHA-256 hashes, expire after 30 days, and rotate on each refresh. Reuse revokes the
  token family. `POST /auth/logout` increments the account's token version and revokes
  all refresh tokens for that account.
- `POST /xp` accepts a lesson ID and answer. The server checks the answer against the
  catalog, awards a fixed amount, and enforces one completion reward per user and lesson
  in a database transaction.
- `GET /user/:username` only returns the authenticated user's own profile.
- `GET /leaderboard` requires authentication and exposes usernames, not email addresses.
- The dashboard summary is limited to teacher and admin roles.

`POST /score` remains a text-comparison demo, not speech recognition. It is disabled by
default and production configuration rejects enabling it. Real audio capture, consent,
model integration, and evaluation are still required before shipping pronunciation scoring.

## Operational behavior

- `/health` is a liveness check; `/ready` checks PostgreSQL connectivity.
- The service validates required environment variables at startup and does not provide
  production fallback secrets.
- Mobile access and refresh tokens are stored with Expo SecureStore on iOS/Android.
  Web sessions remain memory-only.
- JSON request bodies are capped at 32 KB. Helmet headers, an explicit CORS allow-list,
  request IDs, and in-process rate limits are enabled.
- Rate limiting currently uses process memory; use a shared store and configure trusted
  proxy handling before running multiple API instances.
- Use HTTPS at the public edge. Do not expose PostgreSQL directly to the public internet.
- The Compose `migrate` one-shot service applies migrations before the API starts.
- The Compose setup is for local deployment, not a high-availability production topology.

The current implementation is a stronger production foundation, not a production launch
certification. See the repository's production-readiness checklist for outstanding work.
