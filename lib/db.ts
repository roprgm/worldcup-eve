// The one place the app touches a database driver (Neon serverless Postgres).
// With no DATABASE_URL (plain local dev) `sql` is null and callers no-op, so
// the app runs without a database. Each domain owns its tables and schema —
// see lib/arena/db.ts and lib/history/db.ts.

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export const sql = url ? neon(url) : null;
