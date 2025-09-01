// scripts/summarize.mjs
import { globby } from "globby";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

function hasJSX(text) {
  return /<[A-Za-z][\w:-]*\s|<\/[A-Za-z]/.test(text) || /<>\s*<\/>/.test(text);
}

function importModules(text) {
  const mods = [];
  const re1 = /from\s+["']([^"']+)["']/g;
  const re2 = /import\s+["']([^"']+)["']/g; // bare import
  let m;
  while ((m = re1.exec(text))) mods.push(m[1]);
  while ((m = re2.exec(text))) mods.push(m[1]);
  return mods;
}

function readPkg() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const libs = Object.keys(all);
    return {
      react: all.react || null,
      next: all.next || null,
      typescript: all.typescript || null,
      libs,
      tailwind: !!(all["tailwindcss"] || fs.existsSync(path.join(root, "tailwind.config.js")) || fs.existsSync(path.join(root, "tailwind.config.ts"))),
      mui: libs.some(n => n.startsWith("@mui/")),
      antd: libs.includes("antd"),
    };
  } catch { return {}; }
}

const patterns = ["app/**/*.{ts,tsx,js,jsx}", "src/**/*.{ts,tsx,js,jsx}"];
const files = await globby(patterns, { gitignore: true });

const summary = {
  tech: readPkg(),
  metrics: { files: files.length, loc: 0 },
  routing: [],
  components: [],
  stateLibs: new Set(),
  dataAccess: [],
  styling: {},
};

for (const file of files) {
  const abspath = path.join(root, file);
  const text = await fsp.readFile(abspath, "utf8");
  summary.metrics.loc += text.split("\n").length;

  // Next App Router routing
  if (file.includes("/app/")) {
    if (/\/page\.(t|j)sx?$/.test(file)) summary.routing.push({ type: "page", file });
    if (/\/layout\.(t|j)sx?$/.test(file)) summary.routing.push({ type: "layout", file });
    if (/\/route\.(t|j)s$/.test(file)) summary.routing.push({ type: "api-route", file });
  }

  const mods = importModules(text);

  // State libs detection
  ["zustand","@reduxjs/toolkit","redux","jotai","recoil","@tanstack/react-query","swr"].forEach(lib=>{
    if (mods.includes(lib)) summary.stateLibs.add(lib);
  });

  // Data access detection
  const usesAxios = mods.includes("axios");
  const hasFetch = /\bfetch\(/.test(text);
  if (usesAxios || hasFetch) {
    summary.dataAccess.push({ file, axios: usesAxios, fetch: hasFetch });
  }

  // Components (rough JSX check)
  if (hasJSX(text)) {
    const hasHooks = /\buse(State|Effect|Memo|Callback|Reducer|Ref|Context)\b/.test(text);
    const isServer = /["']use server["']/.test(text);
    summary.components.push({ file, hasHooks, isServer });
  }
}

const out = {
  tech: summary.tech,
  styling: {
    tailwind: !!summary.tech.tailwind,
    mui: !!summary.tech.mui,
    antd: !!summary.tech.antd,
    cssModules: files.some(f => /\.module\.(css|scss)$/.test(f)),
  },
  metrics: summary.metrics,
  routing: summary.routing.sort((a,b)=>a.file.localeCompare(b.file)),
  componentsSample: summary.components.slice(0, 50),
  stateLibs: Array.from(summary.stateLibs),
  dataAccess: summary.dataAccess.slice(0, 50),
};

await fsp.writeFile("frontend_summary.json", JSON.stringify(out, null, 2), "utf8");

const md = `# Frontend Summary

**Tech:** ${JSON.stringify(out.tech)}
**Styling:** ${JSON.stringify(out.styling)}
**Metrics:** files=${out.metrics.files}, loc≈${out.metrics.loc}

## Routing
${out.routing.map(r=>`- ${r.type}: ${r.file}`).join("\n")}

## State libs
${out.stateLibs.join(", ") || "none detected"}

## Sample components (first 50)
${out.componentsSample.map(c=>`- ${c.file}${c.hasHooks?" (hooks)":""}${c.isServer?" [server]":""}`).join("\n")}

## Data access (sample)
${out.dataAccess.map(d=>`- ${d.file}${d.axios?" axios":""}${d.fetch?" fetch()":""}`).join("\n")}
`;
await fsp.writeFile("frontend_summary.md", md, "utf8");

console.log("Wrote frontend_summary.json and frontend_summary.md");