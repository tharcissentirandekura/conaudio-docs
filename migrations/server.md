# Server Root Files Reference

This page explains the purpose of the root server files in `conaudio2/server/server` and how they work together at runtime.

## Purpose

Use this document to understand the server entry flow, auth/session behavior, shared middleware/utilities, and the migration rules that protect legacy behavior.

## Who should read this

- Engineers modifying files under `conaudio2/server/server`.
- Engineers mapping runtime behavior to `conaudio2/specs`.
- Engineers debugging auth, request lifecycle, or response semantics.

## What this page does not cover

Detailed `/db/*` endpoint contracts are documented in [Database HTTP API](/migrations/db/).  
This page focuses on root server files and cross-cutting behavior.

---

## Runtime flow at a glance

For DB/API requests, the high-level flow is:

1. Global setup initializes `rootRequire`, globals, and schema registration.
2. Express middleware stack applies request logging and session/passport handling.
3. `routes.js` mounts auth and DB route modules.
4. Route modules use `utils.js` middleware helpers and `respond.js` response helpers.
5. Unknown `/db/*` paths return the standard not-found payload.

---

## Root files and their purpose

### `server/server/globals.js`

Defines process-wide helpers and globals used across legacy-style modules.

- Sets `global.rootDir` and `global.rootRequire(...)`.
- Exposes global libraries (`_`, `tv4`, `log`).
- Registers root schema with `tv4` using `app/schemas/root.schema`.

Why it matters:

- Many server files depend on `rootRequire` and global `tv4`.
- Breaking this setup causes module resolution and validation failures.

Migration guardrail:

- Keep behavior stable until all files are migrated away from global patterns.

### `server/server/server-config.js`

Builds runtime configuration from environment variables.

- Defines production/test flags, ports, cookie secret, salt.
- Defines Mongo settings and encoder service endpoints.
- Defines Okta SAML and LDAP auth configuration.

Why it matters:

- Auth and DB connectivity behavior depends directly on this file.
- Changing defaults can silently alter local, test, or production behavior.

Migration guardrail:

- Treat values and defaults as runtime contract unless config changes are intentional and documented.

### `server/server/routes.js`

Main route registrar for auth and DB modules.

- Mounts `auth` and each `db/*` route module.
- Installs `/db/*` fallback not-found handler.
- Enables import routes outside tests/production.

Why it matters:

- This file defines what HTTP routes are actually live.
- OpenAPI paths must be validated against these mounts.

Migration guardrail:

- Do not rename/remove mounts without versioning or explicit migration plan.

### `server/server/auth.js`

Authentication and session integration with Passport.

- Configures serialize/deserialize user behavior.
- Registers local strategy and SAML strategy.
- Exposes login/logout/me endpoints and SAML callback routes.

Primary API surface:

- `POST /auth/login`
- `GET /auth/okta/login`
- `POST /saml/callback`
- `POST /auth/logout`
- `GET /auth/me`

Why it matters:

- Auth decisions affect every protected DB route.
- Session-backed user loading drives `checkPermissions` behavior in route modules.

Migration guardrail:

- Preserve restricted user response shape and session semantics unless auth migration is explicitly planned.

### `server/server/utils.js`

Shared middleware and helper library used by nearly all DB modules.

Core responsibilities:

- ID/handle resolution (`isMongoDBID`, `getDocFromHandle`).
- Permission and auth guards (`checkPermissions`, `checkLoggedIn`).
- Body shaping and validation (`pickBody`, `validateBody`).
- Query pagination and response helpers (`paginateDBQuery`, `returnDBQuery`).
- Standard document helpers (`saveBodyToDoc`, `deleteDoc`, `returnDoc`).

Why it matters:

- Most route behavior consistency comes from this file.
- Status code behavior (`401`, `403`, `404`, `409`, `422`) is heavily influenced here.

Migration guardrail:

- Treat middleware outputs and error behavior as API contract, not internal implementation detail.

### `server/server/respond.js`

Centralized HTTP response helpers.

- Standard methods for `ok`, `created`, `noContent`, and common error responses.
- Adds `error` and `code` fields for error payloads.

Why it matters:

- API clients and tests rely on consistent status and error body shape.
- Route modules assume these helpers are the canonical response format.

Migration guardrail:

- Keep response shape stable unless specs and clients are updated together.

### `server/server/monger.js`

Request logging middleware for per-request telemetry.

- Creates a `RequestLog` row for each request.
- Captures host, ip, user, path, method, user-agent, status, response size, response time.
- Stores log object on `req.log` for route-level log enrichment.

Why it matters:

- Supports operational troubleshooting and admin log views.
- Affects observability expectations during migration.

Migration guardrail:

- Preserve stored log shape if existing tooling reads these fields.

### `server/server/import.js`

Legacy data import and seeding endpoints for migration operations.

- Provides import endpoints such as `/import-concerts`, `/import-settings`, `/import-services`, `/seed-settings`.
- Migrates old records into current models with validation.

Why it matters:

- Operational migration scripts can depend on these endpoints in non-production flows.

Migration guardrail:

- Keep this isolated from public API docs.
- Treat as operational tooling, not stable product API surface.

---

## DB route modules in this folder

The following files are mounted by `routes.js` and documented in detail in [Database HTTP API](/migrations/db/):

- `server/server/db/concerts.js`
- `server/server/db/concert-snapshots.js`
- `server/server/db/files.js`
- `server/server/db/file-actions.js`
- `server/server/db/print-jobs.js`
- `server/server/db/request-logs.js`
- `server/server/db/users.js`
- `server/server/db/download-jobs.js`

For each module, keep two things aligned:

- Route behavior in JS/Coffee parity.
- OpenAPI path/method/schema declarations.

---

## OpenAPI alignment checklist for server root files

Before updating `conaudio2/specs`, verify:

- Mounted paths in `routes.js` match documented route namespaces.
- Auth endpoints in `auth.js` have accurate request/response shapes in specs if public.
- Status and error body semantics in `respond.js` are reflected in responses.
- Permission and validation outcomes from `utils.js` are represented (`401`, `403`, `404`, `409`, `422`).
- Operational-only routes (`import.js`) are excluded from public API specs unless intentionally published.

---

## Common migration mistakes

- Treating OpenAPI as source of truth when runtime routes differ.
- Narrowing `handle` behavior to ObjectId-only when route logic accepts other handles.
- Changing response helper behavior in `respond.js` without updating specs and clients.
- Refactoring `utils.js` middleware flow and unintentionally changing status codes.
- Mixing operational import endpoints into public API contract docs.

---

## Recommended next step

After any server-root change:

1. Re-check this file’s affected section.
2. Re-check [Database HTTP API](/migrations/db/) for impacted route modules.
3. Update OpenAPI only after runtime behavior is confirmed.

