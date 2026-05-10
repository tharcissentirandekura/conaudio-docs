# CI / CD — this docs repo

Two layers:

1. **GitHub Actions** — every push/PR runs **`npm ci`** + **`npm run docs:build`** and keeps a downloadable **`dist`** artifact.
2. **Netlify** — hosts the built site (Git integration or CLI). Config lives in **`netlify.toml`**.

## GitHub Actions

Workflow: **`.github/workflows/docs.yml`**

| Piece | Detail |
| ----- | ------ |
| Triggers | **`push`** / **`pull_request`** to **`main`** or **`master`**, plus **`workflow_dispatch`** (manual run from the Actions tab) |
| Concurrency | One run per branch/PR; newer runs **cancel** older ones on the same ref |
| Node | Version from **`.nvmrc`** (currently **22**), npm cache enabled |
| Artifact | **`vitepress-dist`** — contents of **`.vitepress/dist`** after a successful build |

Permissions are **`contents: read`** only.

## Netlify (delivery)

**`netlify.toml`**

| Setting | Value |
| ------- | ----- |
| Build command | `npm run docs:build` |
| Publish directory | `.vitepress/dist` |

Typical setup: in the Netlify UI, connect this GitHub repo and point the site at **`main`** (or your production branch). Netlify runs the same **`docs:build`** as CI. You usually **do not** need a deploy job inside Actions unless you want deploys gated entirely on Actions.

Alternative: **`npm run deploy:preview`** / **`deploy:prod`** with **`npx netlify deploy`** after **`netlify login`** / **`netlify link`**.

### Optional: deploy from Actions

If you eventually want **`push` → Actions → Netlify** without Git integration, add secrets **`NETLIFY_AUTH_TOKEN`** and **`NETLIFY_SITE_ID`**, download the **`vitepress-dist`** artifact in a **`deploy`** job, and run:

```bash
npx netlify-cli deploy --prod --dir=. --site="$NETLIFY_SITE_ID"
```

(from the unpacked artifact directory).

## npm scripts

| Script | Use |
| ------ | --- |
| `npm run docs:dev` | Local VitePress dev |
| `npm run docs:build` | Same as CI / Netlify build |
| `npm run docs:preview` | Serve **`dist`** locally after a build |

## Local parity

```bash
npm ci && npm run docs:build
```

Application CI/CD for **`conaudio2`** belongs in that repo, not here.
