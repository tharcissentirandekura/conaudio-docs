# Data Layer Migration

## Scope

This document is client-focused.

For this phase, the migration target is:

- `conaudio2/specs`
- generated client/types that come from `conaudio2/specs`
- client-side data contracts used by the frontend and SDK

This document is not a backend migration plan.

Defer these areas for later:

- `conaudio2/server/server/models/*`
- server-side mongoose behavior changes
- backend validation wiring
- persistence-layer refactors

## Goal

Migrate the client-facing data contract into the `conaudio2` specs package without changing the legacy `conaudio` model shape.

The hard rule for this phase is:

- Preserve the legacy request and response shapes used by the existing client.
- Do not rename fields, tighten enums, normalize nested objects, or otherwise "clean up" the contract in specs.
- The specs package should describe legacy behavior well enough that generated types and client code can replace the old client data layer without changing the data model.

## Source Of Truth For This Phase

Use these legacy paths as the contract source of truth:

- `app/schemas/**/*.coffee`
- `app/models/*.coffee`
- client-facing route behavior in `server/db/*.coffee`

Use these `conaudio2` paths as migration targets:

- `conaudio2/specs/openapi.yaml`
- `conaudio2/specs/routes/**/*.yaml`
- `conaudio2/specs/schemas/**/*.yaml`
- generated client/types that depend on those specs

These files can be useful as temporary references, but they are not the source of truth:

- `conaudio2/server/app/schemas/**/*.js`
- `conaudio2/server/app/models/*.js`

## What "Client-Focused" Means Here

In this phase, care about the contract the frontend sees:

- route paths
- path params and query params
- response envelopes
- nested object shapes
- field names
- enum values
- nullable behavior
- arrays vs objects
- denormalized references returned by the API

Do not block this phase on backend implementation cleanup.

If a backend file is wrong but the legacy client contract is already known, document the issue and keep the specs aligned to legacy client behavior first.

## Migration Rule Set

1. Legacy field names are fixed.
- Example: `passwordHash` stays `passwordHash` in schemas and generated types if it is part of the client-facing contract.

2. Legacy enum values are fixed.
- Example: if legacy client data accepted `cit-okta`, specs must still allow `cit-okta`.

3. Legacy response shape is fixed.
- Preserve wrappers, denormalized objects, and mixed historical shapes if the old client depended on them.

4. Compatibility beats cleanup.
- If the old client consumed an awkward shape, model that awkward shape in specs instead of silently redesigning it.

5. Specs are descriptive, not aspirational.
- Do not write the schema you wish the API had.
- Write the schema the legacy client actually used.

6. Backend cleanup is explicitly deferred.
- Do not rewrite this phase into a mongoose/model refactor plan.

## Current Assessment

`conaudio2/specs` is not yet a reliable description of the legacy client-facing data model.

The main risk is not only missing fields. It is contract drift during translation:

- enum narrowing
- field renaming
- loss of response envelopes
- silent changes in nested shapes
- replacing accepted legacy variants with cleaner but narrower schemas

## Confirmed Client-Facing Parity Gaps

### 1. User enum drift must be reflected in specs

Legacy source:

- `app/schemas/models/user.schema.coffee`

Confirmed gap:

- Legacy allows `authWith: 'cit-okta'`.
- Current migrated schema work in `conaudio2` has already narrowed this in at least one place.

Spec migration requirement:

- Every user schema in `conaudio2/specs/schemas` must preserve:
  - `password`
  - `cit-ldap`
  - `cit-okta`

Why this matters:

- Generated client types will otherwise reject or erase a legacy-valid value.

### 2. Do not let backend implementation drift rewrite the client schema

Observed issue:

- Some `conaudio2` server-side files drifted from legacy naming and behavior.

Rule for this phase:

- Do not copy backend drift into `conaudio2/specs`.
- If backend migration files disagree with the legacy client contract, the specs package should still match the legacy contract for now.

Why this matters:

- The specs package is the client contract source for the new frontend.
- If it inherits backend drift, client migration will codify the wrong shape.

### 3. Response envelopes must be preserved

Legacy client behavior:

- Some list endpoints do not behave like plain arrays.
- Old collection parse logic relies on wrapped payloads and side metadata.

Spec migration requirement:

- Preserve actual route response envelopes in `conaudio2/specs/routes/**/*.yaml` and referenced schemas.
- Do not flatten wrapped responses into plain arrays unless the legacy route already returned a plain array.

Why this matters:

- Flattening responses forces frontend hook code to invent transforms that were not part of the original contract.

### 4. Denormalized objects must remain denormalized in specs

Legacy pattern:

- The old client consumes denormalized nested objects such as `concert`, `user`, and file metadata objects in several places.

Spec migration requirement:

- Preserve denormalized object shapes in specs when the old client received them.
- Do not replace them with just IDs because it seems cleaner.

Why this matters:

- Generated types and frontend code will be built against the wrong shape otherwise.

### 5. Validation cleanup must not narrow accepted legacy variants

Observed pattern:

- Some migrated schema files try to modernize old schema syntax.

Spec migration requirement:

- When converting old CoffeeScript schema definitions into OpenAPI/YAML, preserve acceptance semantics.
- If legacy allowed more than one shape, encode that in specs.

Examples of drift to watch for:

- missing enum values
- object replaced by string ID
- array replaced by object or vice versa
- nullable values removed
- required fields added without legacy proof

## Specs Package Priorities

### Priority 0: lock the client contract before implementation work

Audit and correct these first:

- `conaudio2/specs/schemas/user.yaml`
- `conaudio2/specs/schemas/concert.yaml`
- `conaudio2/specs/schemas/concert-snapshot.yaml`
- `conaudio2/specs/schemas/download-job.yaml`
- `conaudio2/specs/schemas/file-action.yaml`
- `conaudio2/specs/schemas/request-log.yaml`
- `conaudio2/specs/routes/*.yaml`

Also review nested concert-related schemas:

- `conaudio2/specs/schemas/concert/*.yaml`

### Priority 1: preserve route behavior in route specs

For each route in `conaudio2/specs/routes/**/*.yaml`, verify:

- path matches legacy
- path params match legacy
- query params match legacy
- response status codes match what client code expects
- response body shape matches the old client parse logic

### Priority 2: preserve client-generated type shape

After route and schema parity is corrected:

- regenerate the types/client
- verify the generated types still reflect legacy fields and values
- do not let generated output become a new source of truth

## Agent Execution Checklist

Use this sequence.

1. Read the legacy client contract first.
- Start from:
  - `app/schemas/**/*.coffee`
  - `app/models/*.coffee`
  - `server/db/*.coffee` for route payload shape

2. Document the exact route-facing shape before editing specs.
- field names
- enum values
- required vs optional
- nullable behavior
- nested object structure
- response envelope shape
- list wrapper shape

3. Update `conaudio2/specs` to match legacy, not migrated backend files.

4. Regenerate client/types only after the spec contract is corrected.

5. Verify frontend-facing parity explicitly.
- compare old collection/model parse expectations
- compare generated type fields to legacy schema fields
- compare list response wrappers
- compare nested denormalized objects
- compare accepted enum values

## Definition Of Done For This Phase

This phase is complete only when all of the following are true:

- `conaudio2/specs` accurately describes the legacy client-facing contract.
- Generated types/client from the specs preserve legacy field names and enum values.
- No route spec has been simplified in a way that changes the data shape consumed by the frontend.
- Denormalized legacy response objects are still represented accurately in specs.
- Backend refactor concerns have not been mixed into the client/spec migration plan.

## Non-Goals For This Phase

Do not do these as part of this document's scope:

- mongoose model rewrites
- backend validation rewiring
- persistence cleanup
- backend field renames
- replacing denormalized API payloads with normalized IDs
- "fixing" awkward legacy shapes in the specs package

## Backend Follow-Up

Backend model parity work is real, but it is for a later phase.

Examples to defer:

- `conaudio2/server/server/models/User.js`
- `conaudio2/server/server/models/DownloadJob.js`
- `conaudio2/server/server/models/RequestLog.js`
- `conaudio2/server/app/models/Concert.js`
- `conaudio2/server/app/schemas/root.schema.js`

Those should be handled after the specs package and client-facing contract are stabilized.

## Recommended Next Step

Do a spec-first parity pass in this order:

1. Audit `conaudio2/specs/routes/*.yaml` against `server/db/*.coffee`.
2. Audit `conaudio2/specs/schemas/*.yaml` against `app/schemas/**/*.coffee`.
3. Check old client model/collection expectations in `app/models/*.coffee` and `app/collections/*.coffee` for envelope and nested-object requirements.
4. Update specs to preserve legacy client behavior exactly.
5. Regenerate client/types and verify that the generated output matches the old client contract.
