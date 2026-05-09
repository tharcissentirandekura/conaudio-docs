# Testing Todos

- [ ] Add focused tests for `conaudio2/clients/conaudio-sdk/client.ts`.
- [ ] Verify `getClient()` returns the same SDK client instance after initialization.
- [ ] Verify CSRF cookie handling adds the `X-CSRF-Token` request header.
- [ ] Verify `handleClientMethod()` maps API and network failures to `TanstackError`.
- [ ] Add hook tests that use `requests/__tests__/testUtils.ts`.


# In progress: migrate to vitest

I have realized that saflib has vitest configured and I want to take advantage of this by integrating it into conaudio

- I need tp import `@saflib/vitest` into `conaudio2` project and then use it. But we also need to add `vite.config.ts` to be able to start using vitest.

- Let's also reuse `@saflib/sdk/testing` especially `mocking` and `msw` to avoid writting the code myself.




## Testing layout

Request tests should follow the Saflib SDK testing pattern:

```txt
hook -> real conaudio SDK client -> fetch -> MSW fake API handler
```

Avoid inline `vi.mock()` client mocks for request hooks unless a test specifically needs to isolate client-call arguments. Prefer the shared MSW-backed test helpers in `../testing`.

Current shared testing files:

- `../testing/mock.api.ts` defines typed MSW handlers with `typedCreateHandler<paths>()` from `@saflib/sdk/testing`.
- `../testing/reactQuery.ts` provides the React Query test wrapper and `renderTestHook`.
- `../testing/async.ts` provides shared wait timing.
- `../testing/globals.ts` provides reusable browser/global stubs.

Operation tests should live in operation folders, not in a broad `__tests__` folder:

```txt
requests/
├── file-actions-test/
│   ├── list.test.ts
│   ├── get.test.ts
│   ├── create.test.ts
│   └── delete.test.ts
└── file-action-queue/
    └── list.test.ts
```

Each operation test should set up the fake API once:

```ts
import { setupMockServer } from '@saflib/sdk/testing/mock';
import {
  fileActionHandlers,
  resetFileActionStubs,
} from '../../testing';

describe('list file actions', () => {
  setupMockServer(fileActionHandlers);

  afterEach(() => {
    resetFileActionStubs();
  });
});
```

`resetFileActionStubs()` clears the in-memory fake table and restores one default file action. This keeps tests isolated because create/delete handlers mutate the shared fake data during a test.

