import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Bundle server-only TypeScript in a temporary directory, never in public/dist.
const directory = await mkdtemp(join(tmpdir(), "siagaapi-sync-"));
try {
  const outfile = join(directory, "sync.mjs");
  await build({
    entryPoints: ["scripts/sync-firms.ts"],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    logLevel: "silent",
  });
  const { main } = await import(pathToFileURL(outfile).href);
  await main();
} catch {
  // Upstream URLs contain the secret. Never print raw exceptions or response bodies.
  console.error(
    "Sinkronisasi gagal. Periksa key, akses jaringan, kuota, dan ketersediaan produk FIRMS. Cache sebelumnya tidak diubah.",
  );
  process.exitCode = 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
