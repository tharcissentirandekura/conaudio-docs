# Testing

Use this section to validate API parity, generated clients, and route behavior during migration.

## Start here

- [Request operation testing](./request-operations) for endpoint-level checks.
- [SDK client testing](./client) for generated client and hook integration checks.
- [Testing todos](./todos) for active verification tasks.

## Scope

Testing docs should focus on:

- HTTP contract verification against legacy behavior.
- OpenAPI-to-runtime parity checks.
- Auth and permission behavior for admin and restricted routes.
- Regression checks when migrating schemas, models, and route handlers.