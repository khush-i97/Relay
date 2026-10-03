// Builds the Moss semantic index from the restaurants table so document IDs match restaurant IDs.
// Usage: npm run moss:seed  (reads .env.local; replaces the index if it already exists)
import { MossClient } from "@moss-js/moss";
import { createClient } from "@supabase/supabase-js";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "MOSS_PROJECT_ID", "MOSS_PROJECT_KEY"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing environment values: ${missing.join(", ")}`);
  process.exit(1);
}
const indexName = process.env.MOSS_INDEX_NAME || "bitequest-restaurants";

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: rows, error } = await db.from("restaurants").select("id,name,cuisine,description,tags,rarity");
if (error) throw error;
if (!rows?.length) {
  console.error("No restaurants found; run the Supabase migrations and seed first.");
  process.exit(1);
}

const docs = rows.map((row) => ({
  id: row.id,
  text: `${row.name}. ${row.cuisine} cuisine. ${row.description} Tags: ${(row.tags ?? []).join(", ")}. Rarity: ${row.rarity}.`,
}));

const moss = new MossClient(process.env.MOSS_PROJECT_ID, process.env.MOSS_PROJECT_KEY);
try {
  const existing = await moss.listIndexes();
  if (existing.some((index) => index.name === indexName)) {
    console.log(`Replacing existing index ${indexName}`);
    await moss.deleteIndex(indexName);
  }
  await moss.createIndex(indexName, docs);
  console.log(`Indexed ${docs.length} restaurants into ${indexName}`);
} finally {
  await moss.close();
}
