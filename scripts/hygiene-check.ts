/**
 * Repo hygiene checks for go-live — no network, no secrets printed.
 *
 *   npm run hygiene
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const failures: string[] = [];
const warnings: string[] = [];

function fail(msg: string) {
  failures.push(msg);
}
function warn(msg: string) {
  warnings.push(msg);
}

function walk(dir: string, out: string[] = [], depth = 0): string[] {
  if (depth > 8) return out;
  for (const name of readdirSync(dir)) {
    if (
      name === "node_modules" ||
      name === ".git" ||
      name === ".next" ||
      name === ".vercel"
    ) {
      continue;
    }
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out, depth + 1);
    else out.push(full);
  }
  return out;
}

// 1) Proxy vs middleware
if (!existsSync(join(ROOT, "src/proxy.ts"))) {
  fail("src/proxy.ts missing — session gating must live in proxy.ts");
}
if (existsSync(join(ROOT, "src/middleware.ts"))) {
  fail("src/middleware.ts must not exist alongside src/proxy.ts (Next.js 16)");
}

// 2) .gitignore must cover env files
const gi = readFileSync(join(ROOT, ".gitignore"), "utf8");
if (!/^\.env\*/m.test(gi) && !/^\.env$/m.test(gi)) {
  fail(".gitignore must ignore .env files");
}
if (!gi.includes("!.env.example")) {
  warn(".gitignore should keep !.env.example tracked");
}

// 3) No NEXT_PUBLIC Geoapify / secret-shaped public env in example
const example = readFileSync(join(ROOT, ".env.example"), "utf8");
if (/NEXT_PUBLIC_.*GEOAPIFY/i.test(example)) {
  fail(".env.example must not expose GEOAPIFY via NEXT_PUBLIC_*");
}
if (/GEOAPIFY_API_KEY\s*=\s*"[^"]{8,}"/.test(example)) {
  fail(".env.example contains a non-empty GEOAPIFY_API_KEY value");
}

// 4) Tracked-file secret scan (high-confidence patterns only)
const secretRes = [
  { name: "Stripe live secret", re: /\bsk_live_[A-Za-z0-9]{16,}\b/ },
  {
    name: "Stripe test secret",
    re: /\bsk_test_(?!placeholder)[A-Za-z0-9]{20,}\b/,
  },
  {
    name: "Webhook secret",
    re: /\bwhsec_(?!placeholder)[A-Za-z0-9_]{16,}\b/,
  },
  { name: "Resend key", re: /\bre_[A-Za-z0-9]{20,}\b/ },
  {
    name: "Geoapify hex key",
    re: /\bGEOAPIFY_API_KEY\s*=\s*["']?[a-f0-9]{32}["']?/i,
  },
];

const trackedHint = walk(join(ROOT, "src"))
  .concat(walk(join(ROOT, "scripts")))
  .concat(walk(join(ROOT, "docs")))
  .concat([
    join(ROOT, ".env.example"),
    join(ROOT, "README.md"),
    join(ROOT, "package.json"),
  ])
  .filter((f) => /\.(ts|tsx|md|example|json|mjs|js)$/.test(f));

for (const file of trackedHint) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, "utf8");
  // Allow intentional placeholders in tests / examples
  if (file.endsWith(".test.ts") || file.endsWith(".example")) continue;
  for (const { name, re } of secretRes) {
    if (re.test(text)) {
      fail(`${name} pattern found in ${relative(ROOT, file)}`);
    }
  }
  // Flag live env wiring, not docs/scripts that forbid NEXT_PUBLIC_GEOAPIFY.
  if (
    /process\.env\.NEXT_PUBLIC_GEOAPIFY/i.test(text) ||
    /NEXT_PUBLIC_GEOAPIFY_API_KEY\s*=/i.test(text)
  ) {
    fail(`NEXT_PUBLIC_GEOAPIFY wiring in ${relative(ROOT, file)}`);
  }
}

// 5) Local .env must not hold a real Geoapify key in the agent workspace
for (const envName of [".env", ".env.local"]) {
  const p = join(ROOT, envName);
  if (!existsSync(p)) continue;
  const text = readFileSync(p, "utf8");
  const m = text.match(/^\s*GEOAPIFY_API_KEY\s*=\s*["']?([^"'\s#]+)/m);
  if (m?.[1] && m[1].length >= 20 && !m[1].includes("placeholder")) {
    fail(
      `${envName} still has a GEOAPIFY_API_KEY — scrub it; use Vercel Secret only (rotate if previously pasted)`,
    );
  }
}

console.log("hygiene check");
if (warnings.length) {
  for (const w of warnings) console.log("  warn:", w);
}
if (failures.length) {
  for (const f of failures) console.log("  FAIL:", f);
  console.log(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log(
  "  ok — proxy present, no middleware.ts, no committed secret patterns",
);
