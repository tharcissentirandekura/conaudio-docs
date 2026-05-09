# Node and TypeScript Server Refactoring Notes

Use this page as a learning checklist before rewriting legacy CoffeeScript and callback-heavy Express routes into modern TypeScript.

## What to Learn First

1. JavaScript async model
   - Promises
   - `async` and `await`
   - `try`, `catch`, and `finally`
   - How errors move through async code

2. Express fundamentals
   - `req`, `res`, and `next`
   - Middleware chains
   - Error middleware
   - Route handlers
   - `next(error)` versus throwing inside async handlers

3. TypeScript basics
   - Function parameter types
   - Interfaces and type aliases
   - Optional request properties like `req.filedata?`
   - Union result types
   - Error narrowing with `instanceof`

4. Node file and stream APIs
   - `fs/promises`
   - `createReadStream`
   - `createWriteStream`
   - `pipeline`
   - Temporary files
   - Cleanup with `finally`

5. Multer and file uploads
   - `multipart/form-data`
   - Disk storage versus memory storage
   - `req.file` and `req.files`
   - Temporary upload paths

6. Service layer pattern
   - Keep Express routes thin
   - Move business logic into plain async functions
   - Return structured results
   - Test logic without HTTP

7. Mongoose basics
   - Documents
   - `.findById()`
   - `.save()`
   - `.set()`
   - `.toObject()`
   - Model typing in TypeScript

8. Child processes
   - `child_process.spawn`
   - Wrapping tools like `flac`, `lame`, and `sox` in promises
   - Handling exit codes and stderr

## Callback Middleware to Async Code

Legacy middleware often looks like this:

```js
doThing(input, (err, result) => {
  if (err) return next(err);
  req.result = result;
  next();
});
```

The modern shape is:

```ts
const result = await doThing(input);
req.result = result;
```

Use an async route wrapper so thrown errors and rejected promises go through Express error handling:

```ts
import type { NextFunction, Request, Response } from "express";

function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}
```

## Route Refactoring Target

The old `upsert-md5` route is a long middleware pipeline:

```coffee
router.route '/:handle/files/:filename*/upsert-md5'
.post(fileErrorHandler)
.post(getConcertFromHandle)
.post(utils.checkPermissions('admin'))
.post(getFiledataFromURL)
.post(upsertMD5Middleware.checkIfMD5AlreadyUpserted)
.post(upsertMD5Middleware.initUpsertMD5)
.post(upsertMD5Middleware.downloadFlacFile)
.post(upsertMD5Middleware.convertFlacFileToWav)
.post(upsertMD5Middleware.getWavMD5)
.post(upsertMD5Middleware.setMD5AndStopIfFlacIsFine)
.post(upsertMD5Middleware.convertBackToWAV)
.post(upsertMD5Middleware.identifyFLACFile)
.post(upsertMD5Middleware.uploadFLACFile)
.post(recordFileAction)
.post (req, res) -> respond.ok(res, req.upsertMD5Results)
```

A better modern route keeps validation and permissions in Express, then delegates the workflow:

```ts
router.post(
  "/:handle/files/:filename*/upsert-md5",
  fileErrorHandler,
  getConcertFromHandle,
  utils.checkPermissions("admin"),
  getFiledataFromURL,
  asyncHandler(async (req, res) => {
    const results = await upsertMd5ForFile({
      concert: req.doc,
      filedata: req.filedata,
      user: req.user,
      log: req.log,
    });

    req.upsertMD5Results = results;

    await recordFileAction(req);

    respond.ok(res, results);
  }),
);
```

The workflow becomes a testable service:

```ts
async function upsertMd5ForFile({
  concert,
  filedata,
  log,
}: {
  concert: ConcertDocument;
  filedata: ConcertFile;
  user: UserDocument;
  log: Logger;
}) {
  if (hasWavMd5(filedata)) {
    return {
      skipped: true,
      reason: "MD5 already exists",
      file: filedata.name,
    };
  }

  const temp = await initUpsertMd5(filedata);

  try {
    await downloadFlacFile(filedata, temp.flacPath);

    const wavMd5 = await getWavMd5FromFlac(temp.flacPath, temp.wavPath);

    if (isFlacFine(filedata, wavMd5)) {
      await setMd5OnExistingFile(concert, filedata, wavMd5);

      return {
        updated: true,
        repaired: false,
        wavMd5,
      };
    }

    await convertBackToFlac(temp.wavPath, temp.repairedFlacPath);

    const metadata = await identifyFlacFile(temp.repairedFlacPath);

    await uploadRepairedFlac({
      filedata,
      path: temp.repairedFlacPath,
      metadata: {
        ...filedata.metadata,
        ...metadata,
        wavMD5: wavMd5,
      },
    });

    return {
      updated: true,
      repaired: true,
      wavMd5,
    };
  } finally {
    await cleanupTempFiles(temp);
  }
}
```

## File Uploads and DiskObjectStore

`multer` disk storage and `DiskObjectStore` solve different problems.

`multer` disk storage receives incoming multipart uploads and writes them to temporary local files:

```ts
const upload = multer({ dest: "/tmp/conaudio-uploads" });
```

`DiskObjectStore` is the durable local object storage backend:

```ts
const source = createReadStream(req.file.path);
const uploaded = await diskObjectStore.uploadFile(
  req.body.destination,
  source,
  req.body.metadata,
);
```

For large audio files, prefer disk-backed uploads over memory storage. Memory storage keeps the whole file in RAM, which is risky for long recordings.

## Refactoring Order

Start with small callback helpers before rewriting whole routes:

1. `downloadFlacFile`
2. `getWavMD5`
3. `identifyFLACFile`
4. `uploadFLACFile`
5. The full `upsertMd5ForFile` service

When each helper is a plain async function, the Express route can become a short orchestration layer.
