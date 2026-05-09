# Database HTTP API (legacy and migration)

This document describes HTTP behavior implemented in the legacy **`server/db/*.coffee`** modules and the corresponding **`conaudio2/server/server/db/*.js`** migration targets. Use it when updating **`conaudio2/specs`** so OpenAPI matches what Express actually serves.

## Purpose

Use this page as the route-level contract reference for `/db/*` handlers.

## Who should read this

- Engineers adding or changing endpoints under `server/db` or `conaudio2/server/server/db`.
- Engineers writing or reviewing OpenAPI path definitions.
- Engineers building SDK/client calls against generated specs.

## How to read this page

Each operation includes:

- A plain-language behavior description.
- Permissions and validation expectations.
- An **Adding to OpenAPI** checklist with method, path, params, body, and response expectations.

## What these DB route files do

The `server/db/*.coffee` files are the legacy HTTP boundary for Conaudio business workflows. They do more than simple CRUD:

- enforce permission checks (`checkPermissions`, custom guards, and owner-or-admin rules),
- normalize and validate request payloads before writes,
- shape response payloads for user visibility (`toObjectForUser`, `toRestrictedObject`),
- trigger side effects (snapshots, file actions, storage updates, counters, and webhook audit rows).

When documenting routes, treat each module as a workflow boundary, not only a list of URLs.

**Authoritative behavior:** If CoffeeScript and JavaScript disagree, treat **`server/db/`** at the repo root as correct until you have proven parity in the migrated code.

::: warning Source of truth
Use repo-relative paths (for example `server/db/concerts.coffee`). Do not treat OpenAPI or the JS port as canonical without checking legacy handlers.
:::

## Working with OpenAPI

For each operation below, an **Adding to OpenAPI** subsection lists what to declare in a path item. In general:

- Use **`{handle}`** style path parameters in OpenAPI (Express uses `:handle`).
- Session authentication is cookie-based in this app; model **`security`** explicitly (for example a cookie named like `connect.sid`) or describe the requirement in the operation until the root spec defines `securitySchemes`.
- Reuse or add **component schemas** that align with Mongoose `jsonSchema` and with **redacted** shapes (`toObjectForUser`, `toRestrictedObject`).
- Include **422** where `tv4` / validation middleware rejects input, and **401** / **403** where `checkPermissions` or custom guards apply.

::: tip Drift
When the JS file is missing a route or returns a different status than Coffee, record that in the spec or in a ticket so generated clients stay honest.
:::

---

## Concert snapshots

**Legacy:** `server/db/concert-snapshots.coffee`  
**Migrated:** `conaudio2/server/server/db/concert-snapshots.js`

New snapshots are created from the **concerts** module when concerts change. This module **reads** `ConcertSnapshot` documents only.
In practice, this module is the historical view of concert edits and deletes. Product and admin tooling use it to audit what changed and when.

#### `GET /db/concert-snapshots`

Returns a paginated list of all concert snapshots, newest first by `_id`. Callers need **`get-restricted-concert-data`** (or **admin**, which satisfies `checkPermissions`). Optional query **`fields`** is a comma-separated list passed to Mongoose **`select`**. Pagination uses shared **`limit`** and **`offset`** query parameters; invalid pagination returns **422**. Response is **200** with a JSON **array** of snapshot objects from `toObject()` (full document shape).

**Adding to OpenAPI**

- **Path:** `/db/concert-snapshots`
- **Method:** `get`
- **Suggested `operationId`:** `listConcertSnapshots`
- **Query:** `fields` (string, optional), `limit` (integer, optional), `offset` (integer, optional)
- **Responses:** `200` (array of snapshot schema); `401`, `403`; `422` for bad `limit`/`offset`
- **Security:** session plus permission equivalent to `get-restricted-concert-data`

::: danger Mismatch (JS port)
The migrated `concert-snapshots.js` has sometimes included debug code. Remove stray `req.doc` assignments and logging before assuming parity.
:::

---

## File actions (global admin)

**Legacy:** `server/db/file-actions.coffee`  
**Migrated:** `conaudio2/server/server/db/file-actions.js`

Administrative listing and deletion of **`FileAction`** documents. Creating actions in normal flows is done with **`POST /db/concerts/{handle}/file-actions`** under the concerts router.
This module is mainly for operational oversight: admins inspect background work items and remove only actions that are still pending.

#### `GET /db/file-actions`

**Admin** only. Optional query filters: **`user`** and **`concert`** are applied only when the value passes a Mongo id check; they filter embedded **`user._id`** and **`concert._id`**. **`complete`** is treated as boolean `true` only when the query string is exactly `"true"`. Sorted by `_id` descending, paginated. **200** with an array of file actions.

**Adding to OpenAPI**

- **Path:** `/db/file-actions`
- **Method:** `get`
- **Query:** `user`, `concert` (ObjectId strings, optional), `complete` (string, optional), `limit`, `offset`
- **Responses:** `200` (array of `FileAction`); `401`, `403`
- **Security:** admin

#### `GET /db/file-actions/{handle}`

**Admin** only. **`handle`** must be a Mongo **ObjectId** for this model (invalid id **422**, missing **404**). **200** returns one document via `toObject()`.

**Adding to OpenAPI**

- **Path:** `/db/file-actions/{handle}`
- **Parameters:** `handle` (string, format `objectid` or description)
- **Responses:** `200` `FileAction`; `404`; `422`

#### `DELETE /db/file-actions/{handle}`

**Admin** only. If the action is **`complete`**, responds **403**. Otherwise deletes the document and responds **204** with no body.

**Adding to OpenAPI**

- **Path:** `/db/file-actions/{handle}`
- **Responses:** `204`; `403` when complete; `404`; `422` invalid id

::: tip Product note
Completed file actions are kept as history. Concert deletion does not obviously remove related file actions; confirm desired cascade behavior before changing the model.
:::

---

## Concerts

**Legacy:** `server/db/concerts.coffee`  
**Migrated:** `conaudio2/server/server/db/concerts.js`

**Concert** CRUD, nested resources, and **`ConcertSnapshot`** audit writes. Responses use `toObjectForUser(req.user)` when available. Snapshots omit `files` and `__v`, store a JSON diff against a pre-update copy on PUT, and record **`editor`**; delete snapshots use `deleted: true` and `concert: null`.
This is the central business router for the archive. Most client-facing concert workflows depend on these endpoints, including list/search behavior and side effects that keep history.

**Parameter `handle`:** Resolved with `getDocFromHandle({ Model: Concert, prop: 'archiveNumber' })`, so the value is either a Mongo **`_id`** or an **`archiveNumber`**. In OpenAPI, document both (parameter name `handle` or `concertHandle`, not “concertId only”).

::: danger Spec mismatch
Calling the path parameter `concertId` and implying ObjectId-only is **narrower** than the server.
:::

#### `GET /db/concerts/{handle}/snapshots`

Loads the concert, requires **`get-restricted-concert-data`**, returns snapshots for that concert’s id, optional `fields`, paginated. **200** array.

**Adding to OpenAPI:** path `handle`; query `fields`, `limit`, `offset`; `200` array of snapshots; `401`, `403`, `404`.

#### `POST /db/concerts/{handle}/file-actions`

Loads concert, creates **`FileAction`** with user and concert embedded, `complete: false`. **Admin**. Body whitelists `method`, `body`, `path`, `group`, `groupIndex`. **201** created action.

**Adding to OpenAPI:** path `handle`; request body partial `FileAction`; `201`; `401`, `403`, `422`.

#### `GET /db/concerts/{handle}/file-actions`

**get-restricted-concert-data**. Lists actions for the concert. **200** array.

**Adding to OpenAPI:** path `handle`; query `fields`, `limit`, `offset`; `200` array.

#### `GET /db/concerts/{handle}/download-jobs`

**Admin**. Lists **`DownloadJob`** rows whose embedded concert matches this concert. **200** array. (Bulk download **file** routes live under **`/db/download-jobs`**, not here.)

**Adding to OpenAPI:** path `handle`; query `fields`, `limit`, `offset`; `200` array of `DownloadJob`.

#### `GET /db/concerts/{handle}`

Fully restricted concerts return **403** without **`get-restricted-concert-data`**. Otherwise **200** permission-filtered concert.

**Adding to OpenAPI:** path `handle`; `200` concert (redacted); `403`, `404`.

#### `PUT /db/concerts/{handle}`

**edit-concerts**. Saves pre-image for diffing, merges `editableProperties`, optionally **`restricted`** with **`edit-concert-restrictions`**, validates, saves, writes snapshot. **200** updated concert.

**Adding to OpenAPI:** path `handle`; request body subset of `Concert`; `200`; `401`, `403`, `422`.

#### `DELETE /db/concerts/{handle}`

**delete-concerts**. Non-empty **`files`** gives **409**. Else snapshot plus delete. **204**.

**Adding to OpenAPI:** path `handle`; `204`; `409`; `401`, `403`.

#### `POST /db/concerts`

**create-concerts**. New concert with empty `files`, `editableProperties`, validate, snapshot. **201**.

**Adding to OpenAPI:** request body; `201` `Concert`; `401`, `403`, `422`.

#### `GET /db/concerts`

Search and list. Users without **`get-restricted-concert-data`** omit fully restricted concerts but may see `restricted: 'audio'`. Supports **`q`** with **`from:`** / **`to:`** date tokens, text index search when applicable, sort by relevance or `settings.time`, field selection excluding restricted paths for non-privileged users. Text search uses tighter pagination in legacy (`maxLimit` 1000, `maxOffset` 0). Additional filters: `type`, `venue`, date range, `restricted` for privileged users. **200** body: **`{ Concerts: [...], textSearch: boolean }`**.

**Adding to OpenAPI:** query parameters should mirror the Coffee handler (`q`, `fields`, `type`, `venue`, `date-from`, `date-to`, `restricted`, `limit`, `offset`, etc.); response schema with `Concerts` array and `textSearch` boolean.

---

## Download jobs (root router)

**Legacy:** `server/db/download-jobs.coffee`  
**Migrated:** `conaudio2/server/server/db/download-jobs.js`

Mounted at **`/db/download-jobs`**. **`handle`** on these routes is the **download job** Mongo id (`getDocFromHandle(DownloadJob)`). This is separate from **`GET /db/concerts/{handle}/download-jobs`**, which lists jobs for a concert and lives in **`concerts.coffee`**.
This module manages secure, expiring download bundles. It controls who can read/download job content and how single-file or zip downloads are generated.

**Access code:** If a job has a stored **`code`**, download-related **`GET`** handlers require matching query **`code`**; if the job has no code, downloads proceed without it. Document **`code`** as **conditionally required** in OpenAPI.

#### `GET /db/download-jobs/{handle}`

Loads the job, runs **`checkCode`**, returns the job. Non-admins receive a **picked** object: only `concert`, `expires`, `filenames`, `normalize`. Admins receive the full object. **200**.

**Adding to OpenAPI**

- **Path:** `/db/download-jobs/{handle}`
- **Query:** `code` (string, required only when the job document has a `code` field)
- **Responses:** `200` (full or reduced `DownloadJob` shape); `403` bad code; `404`
- **Security:** often public or session depending on deployment; align with `checkCode` behavior

#### `DELETE /db/download-jobs/{handle}`

**Admin** only. Deletes the job. **204**.

**Adding to OpenAPI:** path `handle`; `204`; `401`, `403`, `404`.

#### `GET /db/download-jobs/{handle}/download/{index}` (Express wildcard on `index`)

After load and **`checkCode`**, resolves **`filenames[index]`**, loads the concert and file metadata from GCS, downloads to a temp file, sends **`res.download`**. Optional query **`promptSaveAs`**. Errors include **422** invalid index, **404** missing file, **500** on storage errors.

**Adding to OpenAPI**

- **Path:** `/db/download-jobs/{handle}/download/{index}` (if `index` can be multi-segment in Express, use one path param and describe encoding)
- **Query:** `code` (conditional), `promptSaveAs` (optional)
- **Responses:** file download (`200` binary); `403`, `404`, `422`, `500`

#### `GET /db/download-jobs/{handle}/download` (Express `download*`)

Bulk zip path: **`checkCode`**, optional expiration check (**403** if expired), loads concert, increments **`uses`**, builds file list from job filenames, downloads to temp dir, zips, responds with **`{archiveNumber}.zip`**. Complex chain; verify parity in JS before locking the spec.

**Adding to OpenAPI**

- **Path:** `/db/download-jobs/{handle}/download` (and any trailing segment per Express)
- **Query:** `code` (conditional)
- **Responses:** file download zip; `403` expired or bad code; `404`; `204` no files (legacy `noContent` when list empty)

#### `POST /db/download-jobs`

**Admin** only. Creates **`DownloadJob`** with **`creator`** from session, **`uses: 0`**, generated **`code`**, body whitelisted to `concert`, `filenames`, `name`, `normalize`, `type`, `expires`, validated with **`DownloadJob.jsonSchema`**. **201** created job.

**Adding to OpenAPI**

- **Path:** `/db/download-jobs`
- **Method:** `post`
- **Request body:** subset of `DownloadJob` (see `postEditableProperties` in source)
- **Responses:** `201` `DownloadJob`; `401`, `403`, `422`

::: danger JS port
Compare `download-jobs.js` to Coffee for temp directories, zip pipeline, and `checkCode` before generating clients. Known past issues include commented `temp` imports and duplicated logic.
:::

---

## Concert files and GCS webhook

**Legacy:** `server/db/files.coffee`  
**Migrated:** `conaudio2/server/server/db/files.js`

**`handle`** matches concerts (Mongo id or **`archiveNumber`**). Webhook is **`POST /webhooks/google-cloud-storage`**.
This is the storage integration layer. It keeps Mongo file metadata and cloud object state in sync, and it powers file upload, conversion, metadata mutation, and download access patterns.

#### `POST /webhooks/google-cloud-storage`

Server-to-server GCS notifications. Persists **`WebhookRequest`**, handles **`sync`** state, production channel checks, ignores dev-tagged objects in production, requires **`metadata.concertID`**, updates or **`$pull`**s embedded **`files`**. **200** on success; **404** when no matching concert/file update.

**Adding to OpenAPI:** document payload and headers per Google’s notification format; mark security as internal or omit from public spec.

#### `POST /db/concerts/{handle}/files/{filename}/copy` (Express `:filename*`)

**copy-files**. GCS copy, file action, **201** concert with new file metadata.

**Adding to OpenAPI:** path `handle`, `filename` (multi-segment strategy); body `destination`, optional `bucket`, `fileActionID`; `201` concert.

#### `GET` and `POST /db/concerts/{handle}/files-lists`

**Admin**. **GET** returns concert `files` plus std and nearline bucket listings. **POST** replaces `files` from merged bucket metadata.

**Adding to OpenAPI:** path `handle`; **GET** `200` object with three list properties; **POST** concert response per `returnDoc`.

#### `POST .../convert-to-mp3`, `.../convert-to-flac`, `.../convert-to-wav`

**convert-files**. Audio conversion pipeline; **201** concert.

**Adding to OpenAPI:** three path items; document required source format per route.

#### `POST /db/concerts/{handle}/files/{filename}/identify`

**Admin**. SoX identify and metadata write. **200** analysis payload.

#### `POST /db/concerts/{handle}/files/{filename}/upsert-md5`

**Admin**. MD5 / FLAC pipeline (confirm route is enabled in JS).

#### `PUT /db/concerts/{handle}/files/{filename}/metadata`

**edit-file-restrictions**. Updates GCS metadata; **200** concert clone.

#### `POST`, `DELETE`, `GET` `/db/concerts/{handle}/files` (optional path suffix in Express)

**POST** multipart **upload-files**, **201**. **DELETE** **delete-files**, **200** clone. **GET** signed URL (**307** redirect or **200** base64) with referer and network rules.

**Adding to OpenAPI:** split path items if you model optional `filename`; **POST** `multipart/form-data`; **GET** query `redirect` if applicable.

::: tip Coverage
Most real upload/download contracts live under **`/db/concerts/{handle}/files/...`**, not generic “uploads” paths in older specs.
:::

::: danger JS port checklist
Verify `getConcertFromHandle`, webhook channel id **array membership**, `recordFileAction`, and that POST/DELETE/GET on `files` and PUT `metadata` exist in JS if clients are generated from OpenAPI.
:::

---

## Print jobs

**Legacy:** `server/db/print-jobs.coffee`  
**Migrated:** `conaudio2/server/server/db/print-jobs.js`

HTTP routes are **admin-only** under **`/db/print-jobs`**. A **WebSocket** on port **3012** (when not in tests) is **not** HTTP; document it outside OpenAPI if needed.
The purpose of this module is queue management for print processing. HTTP routes create and update queue items, while the WebSocket path is used for status fan-out to listeners.

#### `GET /db/print-jobs/{handle}`

Returns one print job by id for operational inspection. `handle` is ObjectId-only in this module. **200** includes full `PrintJob` via `toObject()`.

**Adding to OpenAPI:** path ObjectId; `200` `PrintJob`; `404`.

#### `PUT /db/print-jobs/{handle}`

Updates an existing print job state (effectively `status` in legacy flow), validates, saves, and may notify WebSocket listeners. Use this when a background processor advances queue state. **200** with updated job.

**Adding to OpenAPI:** path `handle`; small JSON body; `200`; `422`.

#### `POST /db/print-jobs`

Creates a new queue entry with initial **`status: 'queued'`** and source-defined editable fields. This is the enqueue endpoint for new print work. **201** created job.

**Adding to OpenAPI:** request body subset; `201`.

#### `GET /db/print-jobs`

Lists print jobs for queue monitoring. Supports optional **`status`** filter, sorts newest first, and paginates with shared limit/offset middleware. **200** array.

**Adding to OpenAPI:** query `status`, `limit`, `offset`; `200` array.

::: tip Parity
Confirm **`utils`** in JS matches Coffee for **`PrintJob`** saves.
:::

---

## Users

**Legacy:** `server/db/users.coffee`  
**Migrated:** `conaudio2/server/server/db/users.js`

This module manages account profile reads/updates, password changes for password-auth users, and admin user creation/listing. Response shapes are restricted by default to avoid leaking sensitive fields.

#### `PUT /db/users/{handle}/set-password`

Used for password resets and self-service password changes. Allowed for self or **admin**, but only when `authWith` is `password`. Body **`password`** is hashed and persisted as **`passwordHash`**. **200** restricted user object.

**Adding to OpenAPI:** path `handle`; body `{ password: string }`; `200`, `401`, `403`, `422`.

#### `GET /db/users/{handle}`

Returns one restricted user profile for the requested handle. This endpoint is used by account pages and admin detail flows. **200** restricted user.

**Adding to OpenAPI:** path `handle`; `200` restricted `User`.

#### `PUT /db/users/{handle}`

Updates mutable profile fields. Self or **admin** can update basic profile values; **`permissions`** updates are admin-only. `email` is normalized to lowercase before persistence. **200** restricted user.

**Adding to OpenAPI:** path `handle`; body `email`, optional `permissions`; `200`.

#### `POST /db/users`

Creates a new local-auth user for administrative onboarding. Sets default `permissions: []` and `authWith: 'password'` unless overridden by allowed fields. Legacy responds **200** (not **201**); preserve that in OpenAPI unless code is intentionally changed.

**Adding to OpenAPI:** request body; `200` (or `201` if you change the handler).

#### `GET /db/users`

Administrative user directory endpoint. Supports:
- `q` for case-insensitive name filtering,
- `sort=permissions` for permission-bearing users,
- default sort by `lastLogin` descending.
Returns restricted user objects only. **200** array.

**Adding to OpenAPI:** query `q`, `sort`, `limit`, `offset`; `200` array.

---

## Not yet covered in this page

- **`request-logs`** and any other `server/db/*.coffee` not listed above
- Mapping every Mongoose `jsonSchema` to **`components/schemas`** in OpenAPI
- A single **`securitySchemes`** entry for the session cookie in `specs/openapi.yaml`
