# SDK Client Testing

This page documents how to test `conaudio2/clients/conaudio-sdk/client.ts` for conaudio's usage.

## Purpose

Describe the expected behavior of the shared SDK client so request hooks and frontend code can rely on one stable contract.

## Who should read this

- Engineers changing `conaudio2/clients/conaudio-sdk/client.ts`.
- Engineers debugging request failures in SDK hooks.
- Engineers writing test coverage for client-level error handling.

## What success looks like

After following this page, tests should prove that client creation, auth headers, credentials, and error mapping work exactly as expected.

The file follows the same idea as Saflib SDK clients: keep a reusable typed API client in one place, then let request hooks call that client through shared helpers. In conaudio, the important behavior is not the Saflib package itself; it is the local contract around `getClient()`, `createConaudioClient<paths>()`, `handleClientMethod()`, and TanStack Query errors.

## What the client does

`conaudio-sdk/client.ts` owns the SDK-level singleton:

- `getClient()` lazily creates one `openapi-fetch` client.
- The client is typed with `paths` from `@conaudio2/specs-apis`.
- The React Query default error type is registered as `TanstackError`.

The lower-level implementation lives in `conaudio2/clients/client.ts`:

- `createConaudioClient()` creates the `openapi-fetch` client.
- It sets `baseUrl` to `http://localhost:3050`.
- It sends browser credentials with requests.
- It reads `_csrf_token` from `document.cookie` and adds `X-CSRF-Token`.
- `handleClientMethod()` converts API errors, missing data, and network failures into `TanstackError`.
- `createTanstackQueryClient()` defines default retry behavior.

## Test goals

Client tests should prove conaudio behavior, not Saflib behavior.

Focus on:

- `getClient()` returns the same client instance after the first call.
- requests use the OpenAPI paths generated from `@conaudio2/specs-apis`.
- CSRF tokens from `document.cookie` are copied to `X-CSRF-Token`.
- `credentials: "include"` is preserved for cookie-based auth.
- `handleClientMethod()` returns response data for successful API calls.
- `handleClientMethod()` allows `204` responses with no data.
- `handleClientMethod()` throws `TanstackError` for API errors, network errors, and unexpected missing data.
- React Query hooks receive `TanstackError` as their default error shape.

## What to mock

Prefer mocking the network boundary, not the hook logic.

Use a fake `fetch` or MSW-style request handler to assert:

- request URL
- HTTP method
- headers
- credentials behavior
- response body
- response status

Do not mock `handleClientMethod()` in tests that are meant to verify error behavior. Mocking it hides the main contract this client file provides.

## Suggested test files

Place client-focused tests near the SDK:

```txt
conaudio2/clients/conaudio-sdk/
├── client.ts
└── __tests__/
    └── client.test.ts
```

Hook tests can keep using:

```txt
conaudio2/clients/conaudio-sdk/requests/__tests__/testUtils.ts
```

That helper already creates a `QueryClient` with retries disabled, which is useful because retry behavior can make hook tests slower and harder to reason about.

## Test command

From `conaudio2/clients/conaudio-sdk`:

```bash
npm test
```

From the repo root, run the workspace/package command that targets the SDK if available. If not, use the SDK folder directly.

## Useful references

- [openapi-fetch](https://openapi-ts.dev/openapi-fetch/)
- [TanStack Query Testing](https://tanstack.com/query/latest/docs/framework/react/guides/testing)
- [TanStack Query TypeScript Register](https://tanstack.com/query/latest/docs/framework/react/typescript#registering-a-global-error)
- [MSW](https://mswjs.io/docs/)
