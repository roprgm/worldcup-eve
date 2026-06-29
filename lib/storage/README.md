# Storage

Generic, domain-free persistence. `blob.ts` reads and writes **private** JSON
objects on [Vercel Blob](https://vercel.com/docs/storage/vercel-blob):

```ts
await writeJson("predictions/latest.json", snapshot);
const snapshot = await readJson<Snapshot>("predictions/latest.json"); // or null
```

With no blob credentials configured (plain local dev, first deploy) reads return
`null` and writes no-op, so the app runs without storage. Credentials come from
the environment — a static token or Vercel's OIDC; no token is referenced in code.
