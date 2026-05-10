# Home page view migration

Legacy **`/`** is `HomeView` plus the **`BackgroundProgressAlert`** it wires in. Same split in **`conaudio2`**: **`Home`** and the SDK **`BackgroundProgressAlert`**. This note is only that slice; other pages get their own writeups later.

---

## Purpose

Map legacy Home behavior to **`conaudio2`** and spell out what you cannot regress.

## Who should read this

Anyone touching **`/`**, **`Home`**, or **`BackgroundProgressAlert`** (including reviewers).

## When to use this page

Router changes, alert wiring, regression triage (“header looks fine, ops panel is gone”), or parity review before merge.

Edge cases elsewhere: [Database HTTP API](/migrations/db/), [Server migration](/migrations/server), [Data layer migration](/migrations/data-layer), [Collections](/migrations/collections/).

---

## Legacy

`/` goes to **`HomeView`**. On insert it attaches **`BackgroundProgressAlert`** so uploads, actions, and print noise stay visible. The Jade template itself is boring: fixed title; one line naming the logged-in user when they are not flagged as “new”. The interesting bits are inside the alert and its recovery flows.

Legacy tree (paths relative to old client repo):

- `app/Router.coffee`
- `app/views/HomeView.coffee`
- `app/views/RootView.coffee`
- `app/views/BackgroundProgressAlert.coffee`
- `app/templates/home-view.jade`
- `app/templates/background-progress-alert.jade`

---

## conaudio2

React router → **`Home`**. **`Home`** should still render title + conditional user line, and **`BackgroundProgressAlert`** still needs to show up wherever staff expect background work surfaced. Stub UI is fine in dev; parity means real counts, errors, and actions (`retry`, `skip`, `clear`) matching legacy behavior—not a styled empty box.

Targets under **`conaudio2/`**:

- `clients/src/routes/router.tsx`
- `clients/src/components/Home.tsx`
- `clients/conaudio-sdk/components/BackgroundProgressAlert.tsx`

Today **`Home.tsx`** is still placeholder copy (not wired to **`/auth/me`** or the alert). **`BackgroundProgressAlert.tsx`** is a stub. Treat the port as “replace both while keeping router path **`/`**”.

---

## Fast migration cheat sheet

Read this once, then work top-down: header → mount alert → wire each strip to the same gates as **`background-progress-alert.jade`**.

### Legacy behavior (exactly what you are mirroring)

**`HomeView.coffee`** — On insert, calls `BackgroundProgressAlert.universal().attach()`. The singleton `universal()` renders once; **`attach`** replaces the empty `#background-progress-alert` node from **`app/templates/common/base.jade`** with the alert’s element.

**`home-view.jade`** — Static H1. User line: **`if !user.isNew()`** then “You are logged in as:” + **`user.displayName()`** (legacy user is a Backbone model: **`displayName`** is `name || email`; **`isNew()`** is Backbone’s “no id”, i.e. session not bound to a persisted user—mirror whatever **`GET /auth/me`** exposes as “we have a real user” via **`clients/conaudio-sdk/auth/request/auth.ts`** **`useUserProfile`**).

**`BackgroundProgressAlert.coffee`** — Throttled re-render (**100 ms**) on **`app.uploads`**, **`app.actionQueue`**, **`app.printJobs`** **`all`** events. **`getContext`** builds three bundles (done / errored / current / totals / **`todo`** for actions and jobs). Jade only draws the banner when **`uploads.total || actions.total || printJobs.total`**.

Buttons and links (parity checklist): **`resume-actions-btn`** / **`skip-erroneous-action-btn`**; **`upload-error-ok-btn`**; **`retry-print-job-btn`** / **`skip-erroneous-print-job-btn`** (skip sets **`canceled`**; retry sets **`queued`**); **`href="/tasks"`** where Jade shows **See Details** or **View all tasks** footer.

### Where conaudio2 already has the puzzle pieces

Runtime shell is in **`clients/src/App.tsx`**: **`QueryClientProvider`** → **`useUserProfile`** → **`AppProvider`** (user in context) → **`UploadProvider`**. **`Home`** renders under **`RouterProvider`**, so **`useUploadContext`**, **`useFileActionQueue`**, and auth hooks already have their providers—as long as the alert stays under that tree (it does if you mount it from **`Home`** or the router layout).

| Legacy source | Role | conaudio2 starting point |
|---------------|------|---------------------------|
| `app.uploads` | In-memory upload models + status | **`FileUploadContext`** (`useUploadContext`), list/update APIs under **`clients/conaudio-sdk/requests/uploads/`** |
| `app.actionQueue` | File actions + queue driving | **`useFileActionQueue`** (`GET /db/file-actions` incomplete, save mutations, **`go`**, remove/skip) |
| `app.printJobs` | Print job list + status | **`usePrintJobs`** / **`listPrintJobsQuery`** (`GET /db/print-jobs`), **`useUpdatePrintJob`** for status changes |
| Labels | “to MP3”, job status text | **`getFileActionString`**, **`getFileActionName`** / **`getPrintJobAction`**, **`getPrintJobName`** in **`clients/conaudio-sdk/utils/`** |

**`useBackgroundStatus`** already combines **uploads + actions** for counts/errors; it does **not** include print jobs yet—either extend it or query print jobs inside the alert the same way as legacy **`getContext`**.

### Order that saves the most time

1. **`Home`**: read **`useUserProfile`** (or **`useConaudioApp`** if you use `user` from context). Title + “logged in as” only when the API says you have a full session user (same intent as **`!user.isNew()`**).
2. **`BackgroundProgressAlert`**: wrap body in the same outer condition as Jade (`any totals > 0`). Map each Jade branch (upload in progress, upload error, upload success row, …) to a small subcomponent so you can diff against the template line by line.
3. Wire buttons to the same server effects as Coffee: file-action queue **`go`**, **`removeAndDestroyAllRelated`**-equivalent, upload remove/clear, print job **`PUT`** status **`queued` / `canceled`**.
4. Point every **See Details** / footer link at whatever route replaces **`/tasks`** in the React router (keep path aligned with legacy until tasks UI migrates).

### Quick greps on the legacy repo

- `getContext` and `events:` in **`BackgroundProgressAlert.coffee`** — full behavior list.
- `if uploads.total` / `if actions.total` / `if printJobs.total` in **`background-progress-alert.jade`** — render tree.
- **`#background-progress-alert`** in **`base.jade`** — why **`attach`** used **`replaceWith`**.

---

## Suggested workflow

Rough order:

1. Router still maps **`/`** to **`Home`**.
2. Title and user-line condition first—easy smoke test.
3. Alert mount point and layout (incl. tasks link visibility).
4. Data (hooks/SDK/React Query—or whatever you use); invalidate when users act.
5. Error rows: buttons actually touch the server and refresh state.
6. Re-read tasks-link rules with the alert open.

Stuff that tends to drift in the same PR: `router.tsx`, `Home.tsx`, `BackgroundProgressAlert.tsx`.

---

## Sanity checks before merge

- Title visible on **`/`**.
- User line only when legacy would show it (not-new user gate unchanged).
- Alert mounted when Home is; reacts when uploads/actions/jobs move.
- Error rows still have recovery that does something useful.
- Tasks link agrees with legacy when the banner is visible.

---

## Sketch of component split

If **`Home.tsx` grows**, split mirrors the old templates: page shell (`Home`), header copy, conditional user snippet, **`BackgroundProgressAlert`** as the container, then thin pieces for uploads / actions / print and a **`TasksLink`** row.

---

## Regressions we have seen

- **`Home`** ships without mounting the alert; page looks finished, ops silently lose the panel.
- Counts stale because query keys or invalidation wandered.
- Happy-path styling hides missing `retry` / `skip` / `clear`.
- “New user” flips upstream and nobody updates the JSX condition.
- Tasks link tied to the wrong visibility flag.

---

## File wiring

**conaudio2.** `clients/src/routes/router.tsx` maps **`/`** to **`Home`**. **`Home`** composes **`BackgroundProgressAlert`** from `clients/conaudio-sdk/components/BackgroundProgressAlert.tsx`.

**Legacy.** `app/Router.coffee` maps **`/`** to **`HomeView`**. **`HomeView`** renders `app/templates/home-view.jade` and pulls in **`BackgroundProgressAlert`**, which uses `app/templates/background-progress-alert.jade`.

---

## See also

[Migrations overview](/migrations/), [Server migration](/migrations/server), [Collections](/migrations/collections/).
