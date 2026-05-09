## Developer Notes
February 13, 2026
Debug Notes

Concert snapshots endpoint (`GET /db/concert-snapshots`) had two server-side issues in `server/server/db/concert-snapshots.js`:

1) `req.dbq` was never set before pagination middleware
- Symptom: `TypeError: Cannot read properties of undefined (reading 'limit')`
- Cause: route created `dbq` locally and executed it early instead of assigning `req.dbq` for `utils.paginateDBQuery(...)` and `utils.returnDBQuery`.
- Fix: build query as `req.dbq = ConcertSnapshot.find(q).sort('-_id')`, keep pagination/return middleware chain unchanged.

2) Mongoose `ObjectId` constructor usage
- Symptom: `TypeError: Class constructor ObjectId cannot be invoked without 'new'`
- Cause: `mongoose.Types.ObjectId(req.query.concertId)` called without `new` in this runtime.
- Fix: `q['concert._id'] = new mongoose.Types.ObjectId(req.query.concertId)`.

Current route behavior
- Supports `concertId` filter when the value is a valid Mongo ID.

## April 18, 2026

### Legacy schema/model parity audit: `conaudio` vs `conaudio2`

`conaudio2` does not currently match the legacy `conaudio` schema/model layer closely enough to be treated as a faithful port. Some JSON-schema files preserve most legacy fields, but there are still direct compatibility breaks and several rewritten models with changed behavior.

### Findings

1. User schema enum drift
- Legacy allows `authWith: 'cit-okta'` in `app/schemas/models/user.schema.coffee`.
- `conaudio2/server/app/schemas/models/user.schema.js` only allows `['password', 'cit-ldap']`.
- This is a direct schema compatibility break for migrated or existing users using the old auth mode.

2. User password field semantics changed
- Legacy server model hashes and stores `passwordHash`, and `toRestrictedObject` omits `passwordHash`.
- `conaudio2/server/server/models/User.js` hashes `password`, writes back to `user.password`, and omits `password` instead.
- That no longer matches the legacy schema shape, because `conaudio2/server/app/schemas/models/user.schema.js` still defines `passwordHash`.

3. `DownloadJob.generateCode` is broken in the `conaudio2` server model
- Legacy implementation uses a bound model method and `@set('code', code)`.
- `conaudio2/server/server/models/DownloadJob.js` rewrites `generateCode` as an arrow function and calls `this.set('code', code)`.
- In that form, `this` is not the mongoose document instance, so the generated code will not be set correctly.

4. `Concert` client model is not a faithful behavioral port
- Legacy model listens for `sync` and resets the nested files collection from the fetched payload.
- `conaudio2/server/app/models/Concert.js` listens for `'synch'` instead of `'sync'`.
- The file also changes the model construction/export pattern enough that it no longer cleanly mirrors the Backbone-style legacy model.

5. `RequestLog` server model behavior changed
- Legacy `_log` handles exception logging by separating the error object from the remaining args and pushing into `requestLog.get('entries')`.
- `conaudio2/server/server/models/RequestLog.js` rewrites `_log` with different argument handling and writes to `requestLog.entries`.
- This changes model behavior and may diverge from how entries are actually stored and serialized in mongoose documents.

6. Root schema registration/validation plumbing diverged
- Legacy `app/schemas/root.schema.coffee` exports `definitions` for the tv4 registry flow.
- `conaudio2/server/app/schemas/root.schema.js` switches to `$defs` and manually registers schemas.
- That file uses `tv4` without importing it and only partially mirrors the old validation setup, so even where field sets are similar the runtime validation flow is not a clean legacy match.

7. Some schema files are only superficially aligned
- Example: `file-action` in `conaudio2/server/app/schemas/models/file-action.schema.js` preserves most field names from the legacy schema.
- However, it still uses legacy nonstandard constructs like `$or` instead of being normalized into a valid JSON Schema shape.
- So the file is not yet a clean compatibility-preserving modernization.

### Overall assessment

- `conaudio2/server/app/schemas/*` often keeps the legacy field inventory reasonably close.
- `conaudio2/server/server/models/*` and `conaudio2/server/app/models/*` contain multiple behavior changes and regressions.
- `conaudio2` should not be considered schema-compatible with legacy `conaudio` until the user schema, password handling, validation registration, and broken model rewrites are corrected.
- Supports optional `fields` projection.
- Uses `utils.paginateDBQuery(null)` + `utils.returnDBQuery`.

Quick revert options
- Full revert of this file only: `git checkout -- server/server/db/concert-snapshots.js`
- Partial revert: remove `concertId` filter block, or switch `new mongoose.Types.ObjectId(...)` back only if runtime changes.

Debug checklist for this endpoint
- Verify logged-in user has `get-restricted-concert-data` (or `admin`) permission, else expect `401/403`.
- If `limit` errors appear, confirm `req.dbq` exists before `.get(utils.paginateDBQuery(null))`.
- If `ObjectId` errors appear, check constructor style for the current mongoose version.

OpenAPI + single-item route alignment (2026-02-13)

Issue observed in docs UI
- Endpoint: `GET /db/concert-snapshots/{id}`
- Error: `For 'id': Required field is not provided.`

Root causes fixed
1) Missing server implementation for single snapshot route
- Added in `server/server/db/concert-snapshots.js`:
  - `router.route('/:handle')`
  - `.get(utils.checkPermissions('get-restricted-concert-data'))`
  - `.get(utils.getDocFromHandle(ConcertSnapshot))`
  - `.get(utils.returnDoc)`

2) Path parameter schema accepted `object` type
- Updated `specs/schemas/objectId.yaml` from:
  - `type: [string, object]`
  - to `type: string`
- Path params in OpenAPI should be primitive string, not object.

After changing specs
- Regenerate docs/artifacts so UI validator uses updated schema:
  - `npm run generate -w @conaudio2/specs-apis`

Quick revert (docs/spec only)
- `git checkout -- specs/schemas/objectId.yaml`
- If needed, also revert route: `git checkout -- server/server/db/concert-snapshots.js`

Download Jobs route fix (2026-02-13)

Issue
- `GET /db/download-jobs` returned:
  - `404 { "message": "This db path does not exist" }`

Cause
- `server/server/db/download-jobs.js` mounted `/db/download-jobs`, but root route `/` only had `POST` and no `GET`.
- Requests to `GET /db/download-jobs` fell through to global fallback `app.all('/db/*')`.

Fix
- Added a minimal GET list handler on `router.route('/')` in `server/server/db/download-jobs.js`:
  - `.get(utils.checkPermissions('admin'))`
  - `.get((req, res, next) => { req.dbq = DownloadJob.find().sort('-_id'); next(); })`
  - `.get(utils.paginateDBQuery(null))`
  - `.get(utils.returnDBQuery)`

Current behavior
- Authenticated admin: `GET /db/download-jobs` returns paginated list (default order newest first).
- Unauthenticated or insufficient permission: `401/403`.


Feb 23, 2026
- I managed to fix everything and added specs swagger testing
- I run code and it was nice


Feb 25, 2026

Fileaction and file action queue

The difference is in the lvel of abstraction

file action is for single data record model. represents one operaton
  - upload, convert, deletem lock and unlock


file action queue is a controller of many file action items
it manages behavior accross actions
  seria; save of new actions
    serial execution 
      queue lifecycle
      group cancellation/removal
  So file action que is like a scheduler/runner for jibs



March 14, 2026


Migrate the application.coffee

- This files seem to track uploads available, and the actions queue tasks
user select file
  - useFileUpload: whch is a local upload tracking
  - uploadprovider: updates local upload states
  - post to db
    - if waw tye is success:
      - enqueue the file actions
      - use fileactions queuee to process the job

uploadprivider
  - check the background running tasks
  - check if user is trying to load page/tabs with running jobs
  - show backround progress alerting


Before in legacy and becomes :

UploadFile and  UploadFiles = for  local react upload store
setupDropzone / addUploadFile / updateUploadFile =  upload UI + useFileUpload
processFile -> useFileActionQueue

UploadTrackerProvider: what uploads are happening in this browser right now?
useFileUpload: send file to server
useFileActionQueue: run post-upload jobs
useBackgroundStatus: checks status activity and summarize runtime activity
useBeforeUnloadWarning: warn if user leaves mid-process




## reviewing the file action queue again 

- holds file action models
- persist new ones in order (one save after another)
- runds incomplete actions one  at a time by issuing a reall http requests to each action's path


Fileactions: file actions for one concert
FileActionQueue = global queue + executor for those actions


onAdd and saveNewActions: when a new file action is added (is new), it is pushed onto "tosave". Only one save runs at a time "savingNewAction". After each successful sync, the next is saved, then "go" is called to run execute

go()
if not already running and not saving, 
- find teh first model with complete:false and a real id
- mark it running, clear errorMessage
- ajax to path with method and data from body plus fileactionid: action.id so the server can tie the request back to teh queue row
  - if success: complete = true, running = false then go() again or removes the bad action
  - error: sets errorMessage, clears running, doesn't call go again, the queue stops until something else (UI) calls go again or remove bad action

clear complete
  - replaces the collection with only models where complete is false
  - drops finished iterms from in memory queue (UI cleanup)
removeAndDestrigAllRelated:
  - if action has a group, remove and destroy() every action in that group
  - otherwise, remove and destroy one model


FileAction model:
  - describes one action queued operation: method, path, optional body, concert, complete, group
  - urlroot: new model save under /db.concerts..../file-actions
  - existing ones use /db/file-actions
  - which mathces create per concert: list/update globally

  - actionstring/namestring: human readable labels for the UI: Mp3,...

FileActions collection:
  -  it is for fetching or scoping actions to one concert.


Application:
  - create action queue initialization
  - for admins start(), fetches incomplete actions
    - with user, complete = false: queueu rehydrate after reload
  - backgroupstatus = uses app.actionqueue.groupby(complete) to count how many tasts are still incomplete
  - processFile:
    - after successfully WAV upload:
      - adds three queue actions with the same group: 
        - convert to mp3, flac, 
        - then delete teh original file url: same shape as the queue's add API in fileaction queue

        

