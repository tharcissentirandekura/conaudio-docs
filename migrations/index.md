# Migrations

Use this section as the canonical migration map before changing implementation code.

## What belongs here

Migration docs in this folder should describe:

- Legacy behavior in concrete terms (request/response shapes, persisted fields, validation rules).
- Target implementation locations in `conaudio2`.
- Parity risks that can break compatibility.
- OpenAPI implications for any HTTP behavior.

## Core references

- [Database HTTP API](/migrations/db/) for route-level behavior and OpenAPI mapping.
- [Server migration](/migrations/server) for model and contract parity rules.
- [Data layer migration](/migrations/data-layer) for schema and persistence migration strategy.
- [Models notes](/migrations/models/)
- [Collections notes](/migrations/collections/)

## Legacy to target map

- `server/app/schemas` migrates to `specs/schemas` (OpenAPI-aligned schemas).
- `server/app/models` migrates to `server/server/models` and generated spec types.
- `server/app/collections` migrates to request utilities, hooks, and route-level query logic.
- `server/app/lib` migrates to `server/server/lib` or shared utilities when reuse is proven.

## Recommended migration order

1. Lock API and schema contracts first.
2. Preserve persisted model shape and redaction behavior.
3. Preserve collection behavior while moving to modern query patterns.
4. Refactor route internals only after parity is validated.
5. Update OpenAPI and generated clients after runtime parity is confirmed.

## Archive

Older root-level notes are kept for historical context:

- [Original migration notes](/migrate)
- [Original Saflib notes](/saf-migrate)
