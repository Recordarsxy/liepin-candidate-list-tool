import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "vite";

await rm("dist", { recursive: true, force: true });

async function bundle(entry, fileName, format, name) {
  await build({
    configFile: false,
    publicDir: false,
    root: process.cwd(),
    build: {
      target: "chrome120",
      outDir: "dist",
      emptyOutDir: false,
      minify: false,
      sourcemap: false,
      lib: {
        entry: resolve(process.cwd(), entry),
        formats: [format],
        name,
        fileName: () => fileName,
      },
    },
  });
}

await bundle("src/background.ts", "background.js", "es", "CandidateCollectorBackground");
await bundle("src/content/liepin.ts", "content/liepin.js", "iife", "LiepinCollector");
await bundle("src/content/maimai.ts", "content/maimai.js", "iife", "MaimaiCollector");
await bundle("src/sidepanel/app.ts", "sidepanel/app.js", "es", "CandidateCollectorPanel");
