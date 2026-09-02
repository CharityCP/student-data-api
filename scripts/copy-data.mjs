import { cp, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(await readFile(resolve(root, "config/datasets.json"), "utf8"));

for (const [id, dataset] of Object.entries(registry)) {
  if (!dataset.file?.startsWith("data/") || dataset.file.includes("..")) {
    throw new Error(`Dataset \"${id}\" has an unsafe file path: ${dataset.file}`);
  }

  const source = resolve(root, dataset.file);
  const destination = resolve(root, "public", dataset.file);
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination);
  console.log(`Prepared ${id}: ${dataset.file}`);
}
