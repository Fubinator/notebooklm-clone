import { readdir } from "node:fs/promises";

const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
const migrationNames = (await readdir(migrationDirectory))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const namesByVersion = new Map();

for (const name of migrationNames) {
  const version = name.split("_", 1)[0];
  const names = namesByVersion.get(version) ?? [];
  names.push(name);
  namesByVersion.set(version, names);
}

const duplicates = [...namesByVersion.entries()].filter(
  ([, names]) => names.length > 1,
);

if (duplicates.length) {
  for (const [version, names] of duplicates) {
    console.error(`Duplicate Supabase migration version ${version}:`);
    for (const name of names) console.error(`- ${name}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Checked ${migrationNames.length} unique migration versions.`);
}
