#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const esmOutDir = path.join(projectRoot, "dist", "esm");
const candidateExtensions = [".js"];

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...(await walk(fullPath)));
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith(".js"))) {
      results.push(fullPath);
    }
  }

  return results;
}

function splitSpecifier(specifier) {
  const match = specifier.match(/^([^?#]+)([?#].*)?$/);
  if (!match) {
    return { bare: specifier, suffix: "" };
  }

  return {
    bare: match[1],
    suffix: match[2] ?? "",
  };
}

async function resolveRelativeSpecifier(sourceFilePath, specifier) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return null;
  }

  const { bare, suffix } = splitSpecifier(specifier);

  if (path.extname(bare)) {
    return null;
  }

  const basePath = path.resolve(path.dirname(sourceFilePath), bare);

  for (const ext of candidateExtensions) {
    if (await pathExists(`${basePath}${ext}`)) {
      return `${bare}${ext}${suffix}`;
    }
  }

  for (const ext of candidateExtensions) {
    const indexFile = path.join(basePath, `index${ext}`);
    if (await pathExists(indexFile)) {
      return `${bare}/index${ext}${suffix}`;
    }
  }

  return null;
}

async function rewriteFile(filePath) {
  const original = await fs.readFile(filePath, "utf8");
  let updated = original;

  const rewrites = [];
  const patterns = [
    /(from\s*["'])(\.{1,2}\/[^"']+)(["'])/g,
    /(import\s*["'])(\.{1,2}\/[^"']+)(["'])/g,
    /(import\s*\(\s*["'])(\.{1,2}\/[^"']+)(["']\s*\))/g,
  ];

  for (const pattern of patterns) {
    let match;
    // Collect matches first because we need async resolution.
    while ((match = pattern.exec(updated)) !== null) {
      rewrites.push({
        fullMatch: match[0],
        prefix: match[1],
        specifier: match[2],
        suffix: match[3],
      });
    }
  }

  for (const rewrite of rewrites) {
    const resolvedSpecifier = await resolveRelativeSpecifier(filePath, rewrite.specifier);
    if (!resolvedSpecifier) {
      continue;
    }

    const before = `${rewrite.prefix}${rewrite.specifier}${rewrite.suffix}`;
    const after = `${rewrite.prefix}${resolvedSpecifier}${rewrite.suffix}`;

    updated = updated.replace(before, after);
  }

  if (updated !== original) {
    await fs.writeFile(filePath, updated, "utf8");
    return true;
  }

  return false;
}

async function main() {
  if (!(await pathExists(esmOutDir))) {
    console.warn(`Skipping ESM import rewrite: output directory not found at ${esmOutDir}`);
    return;
  }

  const files = await walk(esmOutDir);
  let changed = 0;

  for (const file of files) {
    if (await rewriteFile(file)) {
      changed += 1;
    }
  }

//   console.log(`Rewrote ESM import specifiers in ${changed} file(s).`);
}

main().catch((error) => {
  console.error("Failed to rewrite ESM import specifiers.");
  console.error(error);
  process.exitCode = 1;
});
