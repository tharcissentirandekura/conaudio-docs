# Server Migration Plan With Saflib

This page is a legacy planning reference.

For current migration contract work, start with [Migrations](/migrations/), [Database HTTP API](/migrations/db/), and [Server migration](/migrations/server).

## Goal

Use saflib to standardize the server migration without replacing the existing MongoDB/Mongoose data layer.

The current server should keep:

- MongoDB as the application database.
- Existing Mongoose models such as `Concert`, `User`, `DownloadJob`, `FileAction`, and related model methods.
- Current document shapes and existing Mongo collections.

Saflib should be used around the edges of the server: HTTP routing, error handling, request validation, and object/file storage.

## What To Use

### `@saflib/express`

Use this for the Express route layer.

Recommended uses:

- Wrap async route handlers with `createHandler`.
- Add `createErrorMiddleware()` after all routes.
- Use `createGlobalMiddleware()` where it fits the server startup flow.
- Later, use `createScopedMiddleware({ apiSpec })` once OpenAPI specs exist.

This can replace much of the current route-level boilerplate:

- Manual `try/catch` blocks in route handlers.
- `co-express`.
- Repeated `next(error)` plumbing.
- Some `respond.*` helpers.
- Some custom request parsing and validation middleware.

Example route shape:

```js
const express = require("express");
const createError = require("http-errors");
const { createHandler } = require("@saflib/express");

const Concert = rootRequire("server/models/Concert");
const utils = rootRequire("server/utils");

const getConcert = async (handle) => {
  if (utils.isMongoDBID(handle)) {
    return Concert.findById(handle).exec();
  }

  return Concert.findOne({ archiveNumber: handle }).exec();
};

module.exports = (app) => {
  const router = express.Router();
  app.use("/db/concerts", router);

  router.get(
    "/:handle",
    createHandler(async (req, res) => {
      const concert = await getConcert(req.params.handle);

      if (!concert) {
        throw createError(404, "Concert not found", {
          code: "CONCERT_NOT_FOUND",
        });
      }

      if (
        concert.get("restricted") === true &&
        !req.user?.hasPermission("get-restricted-concert-data")
      ) {
        throw createError(403, "Access to this concert is restricted.", {
          code: "CONCERT_RESTRICTED",
        });
      }

      res.status(200).json(
        concert.toObjectForUser
          ? concert.toObjectForUser(req.user)
          : concert.toObject(),
      );
    }),
  );
};
```

Server-level error middleware:

```js
const { createErrorMiddleware } = require("@saflib/express");

routes(app);

app.use(...createErrorMiddleware());
```

### `@saflib/object-store`

Use this for file storage. It lets the same route logic write to disk during migration and later switch to Google Cloud Storage if needed.

This should not replace Mongo file metadata. Mongo can continue to store entries in `concert.files`; the object store only handles the binary file content.

Disk storage example:

```js
const fs = require("fs");
const path = require("path");
const createError = require("http-errors");
const { createObjectStore } = require("@saflib/object-store");

const fileStore = createObjectStore({
  type: "disk",
  rootPath: path.join(process.cwd(), "data/uploads"),
});

const uploadToDisk = async ({ destination, tempPath, metadata }) => {
  const upload = await fileStore.uploadFile(
    destination,
    fs.createReadStream(tempPath),
    metadata,
  );

  if (upload.error) {
    throw createError(500, "Failed to save file to disk", {
      code: "FILE_SAVE_FAILED",
    });
  }

  return upload.result;
};
```

Upload route pattern:

```js
const destination = `concerts/${concert.id}/${req.file.originalname}`;

await uploadToDisk({
  destination,
  tempPath: req.file.path,
  metadata: {
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
  },
});

const files = concert.get("files") || [];
files.push({
  name: destination,
  bucket: "disk",
  contentType: req.file.mimetype,
  metadata: {
    filename: req.file.originalname,
  },
});

concert.set("files", files);
await concert.save();

res.status(201).json(concert.toObject());
```

Download route pattern:

```js
const read = await fileStore.readFile(req.filedata.name);

if (read.error) {
  throw createError(404, "File not found", {
    code: "FILE_NOT_FOUND",
  });
}

res.contentType(req.filedata.contentType || "application/octet-stream");
read.result.pipe(res);
```

Google Cloud Storage can use the same abstraction:

```js
const store = createObjectStore({
  type: "gcs",
  options: { bucketName },
});
```

### `@saflib/openapi`

Use this after the first route refactors are stable.

Recommended uses:

- Define API contracts for `/db/concerts`, `/db/files`, `/db/users`, and related routes.
- Generate shared TypeScript types.
- Pass the generated `jsonSpec` into `createScopedMiddleware({ apiSpec })`.
- Replace ad hoc body validation and `tv4` usage over time.

This does not require changing MongoDB or Mongoose.

### `@saflib/env`

Use this to document and validate required runtime configuration.

Important constraint: do not read `.env` files or expose secret values while doing this migration work. The goal is to define expected variables and validation schemas, not inspect secret contents.

## What Not To Use For This Migration

### Do not use `@saflib/drizzle`

`@saflib/drizzle` is for SQLite-oriented database packages with Drizzle schemas, migrations, query files, and typed database errors. It is not a drop-in replacement for Mongoose.

Since this migration should keep MongoDB, skip drizzle.

### Do not replace auth with Ory/Kratos right now

The current server uses Passport with local login and SAML/Okta. Saflib has Ory/Kratos packages, but adopting them would be an authentication architecture migration.

Keep Passport unless there is a separate goal to replace auth.

## Recommended Migration Order

1. Add `createErrorMiddleware()` after the existing routes.
2. Pick one small route file, preferably not `files.js`, and wrap async handlers with `createHandler`.
3. Replace `respond.*` in that route with direct `res.status(...).json(...)` or `throw createError(...)`.
4. Keep all Mongoose queries as-is.
5. Extract shared route helpers only after two or three routes use the same pattern.
6. Move file upload/download code behind `@saflib/object-store`.
7. Use the disk object store first for local migration work.
8. Add OpenAPI specs route by route.
9. Enable `createScopedMiddleware({ apiSpec })` for routes with complete specs.

## Practical Rule

Use saflib to clean up the HTTP and file-storage boundaries. Do not use it to replace the database during this migration.
