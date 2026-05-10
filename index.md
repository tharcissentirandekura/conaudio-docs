---
layout: home

hero:
  name: 
  text: A living grimoire of my work (coding, math,...)
  tagline: Guides for building, testing, and migrating projects with confidence.
  actions:
    - theme: brand
      text: Get Started
      link: /migrations/
    - theme: alt
      text: Testing Workflow
      link: /testing/

features:
  - title: Migration Guides
    details: Server, database, model, and data-layer notes for the Saflib migration.
  - title: Testing Workflow
    details: Client testing, request operation testing, and validation checklists.
  - title: Developer Notes
    details: Docker, Saflib tooling, implementation plans, and active todos.
---
# Conaudio documentions

This site is the working documentation for Conaudio migration, API parity, and testing and more

## Quick Start

- [CI / CD (GitHub Actions + Netlify)](/ci-cd)
- Read the [Writing Style Guide](/docs-style) before creating new docs pages.
- Read [Migrations](/migrations/) for the source-of-truth migration map.
- Use [Database HTTP API](/migrations/db/) when adding or updating OpenAPI paths.
- Use [Server Migration](/migrations/server) for route parity and model-contract rules.
- Use [Testing](/testing/) for request and client verification workflows.

## Documentation Map

### Migration References

- [Migration overview](/migrations/)
- [Data layer migration](/migrations/data-layer)
- [Server migration](/migrations/server)
- [Models migration notes](/migrations/models/)
- [Collections migration notes](/migrations/collections/)
- [Database HTTP API](/migrations/db/)

### Development Notes

- [CI / CD (GitHub Actions + Netlify)](/ci-cd)
- [Development notes](/dev-plan/dev-docs)
- [Node and TypeScript server refactoring](/dev-plan/node-typescript-server)
- [Active todos](/dev-plan/todos)
- [Saflib dev-tools and Docker](/dev-tools/) — how SAF generates Dockerfiles and runs **`docker compose`** in **`{product}/dev/`**

### Testing

- [Testing index](/testing/)
- [SDK client testing](/testing/client)
- [Request operation testing](/testing/request-operations)
- [Testing todos](/testing/todos)

### Legacy Notes Archive

- [Original migration notes](/migrate)
- [Original Saflib migration notes](/saf-migrate)
