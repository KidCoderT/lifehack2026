/**
 * Apply supabase/schema.sql to the project database.
 *
 * Replaces the old `bunx supabase db query -f` one-liner in package.json, which broke twice
 * on Windows:
 *   1. `--db-url "$SUPABASE_DB_URL"` expanded to an empty string. Bun loads .env.local for its
 *      runtime, but not into the shell that runs package.json scripts, so the flag arrived bare.
 *   2. Once the URL was passed, the CLI sent the whole file as ONE prepared statement and
 *      Postgres rejected it: "cannot insert multiple commands into a prepared statement".
 *
 * Bun's built-in SQL client uses the simple query protocol for a parameterless `unsafe()` call,
 * which is exactly what a multi-statement DDL file needs.
 *
 * Not wrapped in a transaction on purpose: schema.sql is idempotent, so a partial apply is fixed
 * by running this again, and a failed BEGIN block would hide which statement actually broke.
 */
import { readFile } from "node:fs/promises";
// @ts-expect-error - Bun's built-in SQL client. This script is run by Bun, never bundled by
// Next, and @types/bun would be a dependency added for exactly one file.
import { SQL } from "bun";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set. Copy .env.local.example to .env.local and fill it in.");
  console.error("Use the pooler on port 6543 — 5432 is firewalled on the NUS network.");
  process.exit(1);
}

const ddl = await readFile("supabase/schema.sql", "utf8");
const sql = new SQL(url);

try {
  await sql.unsafe(ddl);
  console.log("schema.sql applied.");
} catch (err) {
  console.error("Failed to apply schema.sql:\n", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await sql.end();
}
