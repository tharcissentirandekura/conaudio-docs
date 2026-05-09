# Saflib dev-tools and Docker

Conaudio pulls **`saflib/`** as workspace code. SAF products normally wire Docker through **`@saflib/dev-tools`** CLI commands plus **generated `Dockerfile`s** from **`Dockerfile.template`** files. This page summarizes how Saflib expects that flow to work, so you can compare it to **`conaudio2`’s** hand-written **`compose.yaml`** and **`docker/Dockerfile.*`** (documented beside the monorepo in **`README.Docker.md`**).

Paths below are rooted at **`conaudio2/`** (the workspace that contains **`saflib/`**).

## `@saflib/dev-tools`: what it does

**`saflib/dev-tools/`** is the “kitchen sink” tooling package. For Docker-related work there are two important pieces:

### Workspace context

**`buildMonorepoContext()`** (`saflib/dev-tools/src/workspace.ts`) discovers the NPM workspace starting from **`package-lock.json`**, walks **workspaces** in the root **`package.json`**, and builds:

| Field | Meaning |
| ----- | ------- |
| `packages` | All workspace package names |
| `workspaceDependencyGraph` | Directed deps between workspace packages |
| `monorepoPackageDirectories` | Absolute path per package |
| `packagesWithDockerfileTemplates` | Packages that contain a **`Dockerfile.template`** beside **`package.json`** |

Dockerfile generation only runs for **`packagesWithDockerfileTemplates`** (anything with **`Dockerfile.template`** in its package folder).

### `saf-docker generate`

Implementations:

- **CLI** — `saflib/dev-tools/src/saf-docker-cli.ts` parses **`saf-docker`** and invokes **`generateDockerfiles(monorepoContext, true)`**.
- **`generateDockerfiles`** — `saflib/dev-tools/src/docker.ts` — for each package with **`Dockerfile.template`**:

  1. Collects **transitive workspace dependencies** of that package (**`getAllPackageWorkspaceDependencies`**), plus the package itself.
  2. Reads the template (`readDockerfileTemplate`).
  3. Replaces placeholders:
     - **`#{ copy_packages }#`** → **`COPY --parents`** of root **`package.json`**, **`package-lock.json`**, and every depended-on package’s **`package.json`** (**and**, if the template base image is Bun, **all** monorepo **`package.json`** files — Bun needs the full workspace tree to install cleanly; see comments in **`docker.ts`**).
     - **`#{ copy_src }#`** → **`COPY --parents`** of entire dependency package directories **(source)**.
  4. Writes a concrete **`Dockerfile`** next to the template (same directory).

Templates use Dockerfile syntax **`COPY --parents`** (see **`syntax=docker/dockerfile:labs`** in examples). Typical service template pattern is **`npm install --omit=dev`** after copying manifests, then copy sources, **`WORKDIR`** into runnable package, **`CMD ["npm","start"]`**.

Vue **clients/build** templates may use a **`builder`** stage; the product **monolith** template follows the **`WORKDIR /app/…/service/monolith`** pattern (see **`saflib/product/workflows/templates/__product-name__/service/monolith/Dockerfile.template`**).

### `saf-git-hashes`

Runs before many dev scripts. Writes env/hash files used by SPA and Node builds (`saflib/dev-tools/src/git-hashes-cli.ts`). Product **`dev`** scripts chain it ahead of **`saf-docker generate`** so image builds get stable git metadata.

---

## Typical SAF **`{product}/dev/`** Docker Compose flow

The **recommended** SAF layout puts local Docker in **`{product-name}/dev/`**. The workflow template **`saflib/product/workflows/templates/__product-name__/dev/package.json`** illustrates the intended sequence:

```text
saf-git-hashes
  → saf-docker generate
  → docker build … clients/root Dockerfile (static landing / root asset image)
  → docker compose --env-file env.dev --env-file .env -f docker-compose.yaml up --build
```

So in a vanilla SAF repo you **do not** hand-edit **`Dockerfiles`** as often: you **`saf-docker generate`** from **`Dockerfile.template`** files whenever dependency layout changes.

The template **`saflib/product/workflows/templates/__product-name__/dev/docker-compose.yaml`** sketches these services:

| Service | Role |
| ------- | ---- |
| **`caddy`** | Reverse proxy (port 80), custom **`Dockerfile`** in **`dev/`**, mounts **`./caddy-config`**, persists Caddy volumes |
| **`clients`** | Vite aggregate image built from **`{product}/clients/build/Dockerfile`** (generated from template); **`command: npm run dev`**; volumes mount **`{product}/clients/`**, **`saflib/`**, **`{product}/service/sdk/`** for HMR |
| **`{product}-monolith`** | Backend/monolith image from **`service/monolith/Dockerfile`** (generated); persists db/cron data under **`service/*/data`**; **`env_file`** **`env.dev`** + **`.env`** |
| **`kratos-migrate`** / **`kratos`** | Ory Kratos identity (**SQLite** dev), migrate then serve with watch |

Conaudio today does **not** use this stack end-to-end (no Kratos/Caddy/monolith templates in **`conaudio2`**); reading that template clarifies **where** SAF expects auth, SPA, and API to live **when you adopt full Saflib product workflows.**

---

## How this differs from **`conaudio2`**

| Aspect | SAF template pattern | **`conaudio2` (today)** |
| ------ | -------------------- | ------------------------ |
| Dockerfiles | Generated from **`Dockerfile.template`** via **`saf-docker generate`** | Hand-maintained **`docker/Dockerfile.*`** |
| Compose | **`{product}/dev/docker-compose.yaml`** + **env.dev** | Root **`compose.yaml`** (Mongo, server, client, docs) |
| Identity / proxy | **Kratos** + **Caddy** | Express sessions + vanilla ports |
| Client | **`clients`** service with FS bind-mounts into **`/app/...`** | **`npm ci`** in image, **`vite`**, **`ROLLUP_DISABLE_NATIVE`** workaround |

Either approach is valid. Saflib’s flow optimizes **multi-SPA Vue** products and shared **templates** across repos; **`conaudio2`** is a slimmer Compose until you align layouts with SAF product scaffolding.

---

## Further reading inside **`saflib/`**

| Path | Topic |
| ---- | ----- |
| `saflib/dev-tools/docs/cli/saf-docker.md` | **`saf-docker`** command help |
| `saflib/dev-tools/docs/overview.md` | **`@saflib/dev-tools`** scope |
| `saflib/monorepo/docs/01-overview.md` | **`{product}/dev/`** role, deployment models (standalone vs hub) |

Use those files in the repo while editing **`Dockerfile.template`** or adding a **`dev/`** tree to **`conaudio2`** if you want closer parity with SAF conventions.
