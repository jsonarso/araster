#!/usr/bin/env node
// One-time migration: pushes the products in src/content/products/* into the live
// site's KV/R2 store via the real /admin API, so they show up without a rebuild.
//
// Usage:
//   node scripts/migrate-to-kv.mjs --url https://your-site.example --password your-admin-password
//
// Safe to run multiple times — products that already exist (same slug) are skipped,
// not duplicated or overwritten.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { parse as parseYaml } from "yaml";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, arr) => {
    if (arg.startsWith("--")) pairs.push([arg.slice(2), arr[i + 1]]);
    return pairs;
  }, [])
);

const SITE_URL = args.url?.replace(/\/$/, "");
const PASSWORD = args.password;

if (!SITE_URL || !PASSWORD) {
  console.error("Usage: node scripts/migrate-to-kv.mjs --url https://your-site.example --password your-admin-password");
  process.exit(1);
}

const PRODUCTS_DIR = join(import.meta.dirname, "..", "src", "content", "products");

// Mirrors src/lib/products.ts's slugify() so the pre-check matches the slug the
// create endpoint will actually compute from the product name.
function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseMarkdownFile(path) {
  const raw = readFileSync(path, "utf8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`No frontmatter found in ${path}`);
  const frontmatter = parseYaml(match[1]);
  const description = match[2].trim();
  return { frontmatter, description };
}

async function login(cookieJar) {
  const res = await fetch(`${SITE_URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: SITE_URL },
    body: new URLSearchParams({ password: PASSWORD }),
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie || res.status !== 302) {
    throw new Error(`Login failed (status ${res.status}). Check --url and --password.`);
  }
  cookieJar.cookie = setCookie.split(";")[0];
}

async function productExists(cookieJar, slug) {
  const res = await fetch(`${SITE_URL}/catalogo/${slug}`);
  return res.status === 200;
}

async function createProduct(cookieJar, dir, { frontmatter, description }) {
  const form = new FormData();
  form.set("name", frontmatter.name);
  form.set("category", frontmatter.category);
  form.set("tagsJson", JSON.stringify(frontmatter.tags ?? []));
  form.set("shortDescription", frontmatter.shortDescription);
  form.set("description", description);
  form.set("material", frontmatter.material ?? "");
  form.set("size", frontmatter.size ?? "");
  form.set("printTime", frontmatter.printTime ?? "");
  form.set("featured", frontmatter.featured ? "true" : "false");

  const alts = [];
  for (const photo of frontmatter.photos) {
    const photoPath = join(dir, photo.src.replace(/^\.\//, ""));
    const bytes = readFileSync(photoPath);
    const ext = extname(photoPath).slice(1);
    const mime = ext === "svg" ? "image/svg+xml" : `image/${ext}`;
    form.append("photo", new Blob([bytes], { type: mime }), `photo.${ext}`);
    alts.push(photo.alt);
  }
  form.set("altsJson", JSON.stringify(alts));

  const res = await fetch(`${SITE_URL}/api/admin/products`, {
    method: "POST",
    headers: { Cookie: cookieJar.cookie, Origin: SITE_URL },
    body: form,
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? `Failed with status ${res.status}`);
  }
  return data.slug;
}

async function main() {
  const cookieJar = {};
  console.log(`Logging into ${SITE_URL}...`);
  await login(cookieJar);
  console.log("Logged in.\n");

  const productDirs = readdirSync(PRODUCTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  let created = 0;
  let skipped = 0;

  for (const dirName of productDirs) {
    const dir = join(PRODUCTS_DIR, dirName);
    const indexPath = join(dir, "index.md");
    if (!existsSync(indexPath)) continue;

    const parsed = parseMarkdownFile(indexPath);
    const slug = slugify(parsed.frontmatter.name);

    if (await productExists(cookieJar, slug)) {
      console.log(`⏭  ${dirName} — already exists, skipping`);
      skipped++;
      continue;
    }

    try {
      const slug = await createProduct(cookieJar, dir, parsed);
      console.log(`✓  ${dirName} -> ${slug}`);
      created++;
    } catch (err) {
      console.error(`✗  ${dirName} — ${err.message}`);
    }
  }

  console.log(`\nDone. Created ${created}, skipped ${skipped} (already existed).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
