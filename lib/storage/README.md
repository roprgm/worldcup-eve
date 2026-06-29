# Storage

Generic, domain-free persistence primitives. Nothing here knows about
predictions or the tournament — keep domain shapes in the modules that own them
(e.g. `lib/predictions/epoch.ts`).

## `blob.ts`

A two-function wrapper over [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
for **private** JSON objects:

```ts
import { readJson, writeJson } from "@/lib/storage/blob";

await writeJson("predictions/latest.json", snapshot); // overwrites
const snapshot = await readJson<Snapshot>("predictions/latest.json"); // or null
```

- **Private access only.** Blobs are written with `access: "private"` and read
  back through the SDK's authenticated `get` — they are never exposed by URL.
- **Degrades without credentials.** When neither a `BLOB_READ_WRITE_TOKEN` nor
  OIDC (`VERCEL_OIDC_TOKEN` + `BLOB_STORE_ID`) is configured — plain local dev
  before `vercel env pull`, or the first deploy before any write — `readJson`
  returns `null` and `writeJson` is a no-op. Callers must treat `null` as "not
  stored yet" and carry on, so the app works with no blob configured.
- **Never throws into a request.** A missing key, malformed body, or transient
  error surfaces as `null` (reads) or a logged warning (writes).

Credentials come from the environment — a static read/write token, or (as this
project is set up) Vercel's OIDC token plus the connected store id, both injected
automatically in deployments and fetched locally by `vercel env pull`. No token
is referenced in code; the SDK resolves it.
