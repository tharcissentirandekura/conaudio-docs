## 1. OpenAPI Schemas

Following the docs in `conaudio2/conaudio-docs/migrations/db/index.md`, add the routes to the OpenAPI:

- Update existing ones before moving on
- Follow the guide and routes should be respected

## 2. Add DiskObjectStore

With the help of `saflib/sdk` DiskObjectStore, we are able to create both disk and cloud store to test the application. In my case beause I want to test the upoad concert file feature, I want to:
1. Add `STORAGE_TYPE` environment variable to .env and when uploading and it is in `dev` mode, the app will automatically use diskstore, otherwise use other stores.


## 3. Add async/await to most code in the server and db
## 4. Docker setup
Because I have two apps, I want to add docker to be able to run both at a time.

1. Create Dockerfile and copy necessary file to the docker container
2. Create docker compose, add mongo db,...



