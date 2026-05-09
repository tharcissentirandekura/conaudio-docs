# Documentation Writing Style

Use this guide when writing or updating docs in `conaudio-docs`.

## Purpose-first structure

Every page should begin with these sections before deep technical details:

1. `## Purpose`
2. `## Who should read this`
3. `## When to use this page` (or `## What this page covers`)

This helps a new engineer understand the file before reading implementation detail.

## Writing rules

- Use plain language before internal jargon.
- Prefer short paragraphs and focused bullet lists.
- Avoid symbolic flow notation and arrow-heavy wording.
- Do not assume prior context. Name paths and modules explicitly.
- Keep one idea per section.

## Endpoint documentation rules

When documenting HTTP endpoints, include enough detail to draft OpenAPI paths:

- Method and path.
- Auth and permission requirement.
- Path, query, and body parameters.
- Response status codes and payload shape.
- Validation and edge-case behavior (`401`, `403`, `404`, `409`, `422`).
- Notes on legacy versus migrated behavior when they differ.

## Good page outcomes

A page is complete when a new engineer can answer:

- What this file is for.
- Whether this is the right file for their task.
- Which source files are authoritative.
- What they must preserve when making changes.
