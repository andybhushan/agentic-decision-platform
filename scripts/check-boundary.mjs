#!/usr/bin/env node
// Boundary check: nothing under platform/ may import from usecases/.
// Run from repo root: node scripts/check-boundary.mjs
// Exits non-zero on violation. Designed for CI (GitHub Actions).

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const platformDir = join(repoRoot, "platform");

const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".cs", ".csproj", ".fs"]);
const skipDirs = new Set(["node_modules", "dist", ".vite", "bin", "obj"]);

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (skipDirs.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
    } else if (entry.isFile()) {
      yield path;
    }
  }
}

const importPatterns = [
  /\bimport\s+[^"';]*from\s+["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
];

// Also catch C#-side imports via .csproj ProjectReference + C# `using` statements.
const csprojRefPattern = /<ProjectReference\s+Include\s*=\s*["']([^"']+)["']/g;
const csUsingPattern = /\busing\s+(Adp\.UseCases\.[^\s;]+)\s*;/g;

// Whitelist: intentional ADR-0001 v0.6 exceptions for usecase tool kits referenced from platform.
// Format: { fromGlob, intoPath } where fromGlob matches the importing file and intoPath substring
// matches the imported path. Only ProjectReferences into usecases/*/tools/* are allowed, and only
// from TracesApi + PackageCompiler + the solution file.
const csprojAllowlist = [
  { fromMatches: (f) => /TracesApi[\\/]TracesApi\.csproj$/.test(f) || /PackageCompiler[\\/]PackageCompiler\.csproj$/.test(f),
    intoMatches: (p) => /usecases[\\/][^\\/]+[\\/]tools[\\/][^\\/]+\.csproj$/.test(p) },
];
const usingAllowlist = [
  // Same exception for the DI registrations that name the relocated tool kits.
  { fromMatches: (f) => /TracesApi[\\/]Program\.cs$/.test(f) || /PackageCompiler[\\/]Program\.cs$/.test(f),
    intoMatches: (ns) => /^Adp\.UseCases\.[A-Za-z]+\.Tools/.test(ns) },
];

const violations = [];

for await (const file of walk(platformDir)) {
  const lastDot = file.lastIndexOf(".");
  const ext = lastDot >= 0 ? file.slice(lastDot) : "";
  if (!codeExtensions.has(ext)) continue;
  const src = await readFile(file, "utf8");

  // JS/TS-style imports (console + scripts)
  for (const pat of importPatterns) {
    pat.lastIndex = 0;
    for (const m of src.matchAll(pat)) {
      const imp = m[1];
      if (/(^|\/)usecases\//.test(imp) || imp.includes("../usecases")) {
        violations.push({ file: relative(repoRoot, file), import: imp, kind: "js-import" });
      }
    }
  }

  // C# .csproj ProjectReference imports
  if (file.endsWith(".csproj")) {
    csprojRefPattern.lastIndex = 0;
    for (const m of src.matchAll(csprojRefPattern)) {
      const imp = m[1];
      if (/usecases[\\/]/i.test(imp)) {
        const allowed = csprojAllowlist.some((rule) => rule.fromMatches(file) && rule.intoMatches(imp));
        if (!allowed) violations.push({ file: relative(repoRoot, file), import: imp, kind: "csproj-projectref" });
      }
    }
  }

  // C# `using` statements referencing usecase namespaces
  if (file.endsWith(".cs")) {
    csUsingPattern.lastIndex = 0;
    for (const m of src.matchAll(csUsingPattern)) {
      const ns = m[1];
      const allowed = usingAllowlist.some((rule) => rule.fromMatches(file) && rule.intoMatches(ns));
      if (!allowed) violations.push({ file: relative(repoRoot, file), import: ns, kind: "cs-using" });
    }
  }
}

if (violations.length > 0) {
  console.error("✗ Boundary violation: platform/ must not import from usecases/ (except per ADR-0001 v0.6 tool-kit exception).");
  for (const v of violations) {
    console.error(`  [${v.kind}] ${v.file}  →  ${v.import}`);
  }
  process.exit(1);
}

console.log(`✓ Boundary OK: no unauthorized platform/ → usecases/ imports.`);
