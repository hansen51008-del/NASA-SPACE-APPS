import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const directory = await mkdtemp(join(tmpdir(), "siagaapi-news-"));
try {
  const outfile = join(directory, "sync.mjs");
  await build({
    entryPoints: ["scripts/sync-news.ts"],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    logLevel: "silent",
  });
  const { main } = await import(pathToFileURL(outfile).href);
  await main();
} catch {
  console.error(
    "Sinkronisasi berita gagal. Periksa konfigurasi sumber dan jaringan. Cache sebelumnya dipertahankan.",
  );
  process.exitCode = 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
