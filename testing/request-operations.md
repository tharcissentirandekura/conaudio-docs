# Request SDK Operations

The request SDK is easier to manage and test when each API operation has its own file or test area instead of grouping every resource behavior into one large hook test.

## Purpose

Define how request-layer code and tests should be organized so each operation is easy to reason about and maintain.

## Who should read this

- Engineers adding or updating request hooks.
- Engineers splitting large test files into operation-focused tests.
- Engineers maintaining the shared MSW fake API test setup.

## What this page enforces

- One clear responsibility per operation test.
- Shared fake API handlers instead of ad hoc mocks.
- Stable, repeatable request-hook testing patterns.

## Goal

Keep request code organized by resource and operation:

```txt
conaudio-sdk/
├── requests/
│   ├── useFileActions.ts
│   ├── file-actions-test/
│   │   ├── list.test.ts
│   │   ├── get.test.ts
│   │   ├── create.test.ts
│   │   └── delete.test.ts
│   └── file-action-queue/
│       └── list.test.ts
└── testing/
    ├── mock.api.ts
    ├── reactQuery.ts
    ├── async.ts
    └── globals.ts
```

The source hook file can still export related hooks from one resource module, but the tests should be split by operation. This keeps each test focused on one contract.

## Why split by operation

Operation files make the request SDK easier to maintain because each test answers one question:

- `list.test.ts`: does the list hook fetch and normalize the collection?
- `get.test.ts`: does the detail hook fetch one record and stay idle without an id?
- `create.test.ts`: does the create mutation send the correct body and return the created record?
- `delete.test.ts`: does the delete mutation remove the server-backed record?

This avoids one large test file where setup, fake data, and assertions for unrelated operations compete with each other.

## Saflib-style testing

Request tests should follow the Saflib SDK pattern:

```txt
hook -> real conaudio SDK client -> fetch -> MSW fake API handler
```

Use:

- `setupMockServer` from `@saflib/sdk/testing/mock`
- `typedCreateHandler<paths>()` through `testing/mock.api.ts`
- `renderTestHook` from `testing/reactQuery.ts`
- shared fake state such as `fileActionStubs`
- reset helpers such as `resetFileActionStubs()`

Avoid inline `vi.mock()` client mocks for request hooks unless the test specifically needs to isolate the client call arguments. The default should be MSW-backed tests that exercise the real client path.

## Shared fake API

`testing/mock.api.ts` owns fake server state and handlers:

```ts
export const fileActionStubs: FileAction[] = [];

export const resetFileActionStubs = () => {
  fileActionStubs.length = 0;
  fileActionStubs.push(/* default fake action */);
};

export const fileActionHandlers = [
  createHandler(/* list */),
  createHandler(/* get */),
  createHandler(/* create */),
  createHandler(/* delete */),
];
```

The handlers mutate `fileActionStubs` to behave like a tiny fake database. Tests call `resetFileActionStubs()` after each test so one test's create/delete behavior does not leak into the next test.

## Operation test pattern

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { setupMockServer } from '@saflib/sdk/testing/mock';
import { useFileActions } from '../useFileActions';
import { renderTestHook, waitFor } from '../../testing/reactQuery';
import {
  fileActionHandlers,
  fileActionStubs,
  resetFileActionStubs,
} from '../../testing';

describe('list file actions', () => {
  setupMockServer(fileActionHandlers);

  afterEach(() => {
    resetFileActionStubs();
  });

  it('returns file actions', async () => {
    const { result } = renderTestHook({
      hook: () => useFileActions({ concertId: 'concert-1', complete: false }),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(fileActionStubs);
    });
  });
});
```

## Rule of thumb

Use operation folders for request behavior. Keep pure utility tests under `utils/__tests__` because they do not need MSW or React Query.
