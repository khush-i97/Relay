// Regenerates supabase/seed.sql from shared/fixtures.json so the catalog has one source of truth.
// Usage: npm run seed:build
import { readFileSync, writeFileSync } from "node:fs";

const fixtures = JSON.parse(readFileSync(new URL("../shared/fixtures.json", import.meta.url), "utf8"));
const text = (value) => (value === null ? "null" : `'${String(value).replace(/'/g, "''")}'`);
const tags = (list) => `array[${list.map(text).join(",")}]`;
const values = fixtures.map((r) =>
  `(${[text(r.id), text(r.name), text(r.cuisine), r.latitude.toFixed(4), r.longitude.toFixed(4), text(r.rarity), r.discoveryXp, r.rewardCents, r.estimatedMealCents, tags(r.tags), text(r.description), text(r.imageUrl), text(r.availability), r.isSynthetic].join(",")})`,
);

const sql = `insert into public.restaurants (id, name, cuisine, latitude, longitude, rarity, discovery_xp, reward_cents, estimated_meal_cents, tags, description, image_url, availability, is_synthetic) values
${values.join(",\n")}
on conflict (id) do update set
name = excluded.name, cuisine = excluded.cuisine, latitude = excluded.latitude, longitude = excluded.longitude,
rarity = excluded.rarity, discovery_xp = excluded.discovery_xp, reward_cents = excluded.reward_cents,
estimated_meal_cents = excluded.estimated_meal_cents, tags = excluded.tags, description = excluded.description,
image_url = excluded.image_url, availability = excluded.availability, is_synthetic = excluded.is_synthetic;
`;
writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log(`Wrote supabase/seed.sql with ${fixtures.length} restaurants`);
