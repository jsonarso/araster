# Araster

Informational website for Araster, a 3D printing workshop. Showcases a catalog of
printed pieces (functional, decorative, toys, and organization) with direct WhatsApp
contact. No cart, no payments — just showcase the work and make it easy to reach out.

The page content itself (products, copy, nav labels, etc.) is in Spanish, since that's
the site's audience. Everything else — code, comments, and this README — is in English.

The catalog is managed through a password-protected `/admin` panel, backed by Cloudflare
R2 (photos) and Cloudflare KV (product data). Adding, editing, or deleting a product takes
effect immediately on the live site — **no rebuild or redeploy needed.**

## Stack

- [Astro](https://astro.build) + TypeScript, server-rendered via `@astrojs/cloudflare`
- Tailwind CSS v4 (CSS-first config in `src/styles/global.css`)
- React only for the handful of interactive pieces (mobile menu, photo gallery, admin
  product form), as Astro islands
- **Cloudflare R2** — product photos (bucket: `araster-product-photos`)
- **Cloudflare KV** — product metadata (namespace: `araster-products`) and admin sessions
  (namespace: `araster-sessions`, used by Astro's built-in session API)
- Deployed as a Cloudflare Worker (not classic Pages)

## Project structure

```
src/
  config/site.ts            # WhatsApp number, prefilled messages, categories, tags, socials
  lib/products.ts           # KV/R2 data layer: list/get/save/delete products, image uploads
  lib/auth.ts                # Password comparison helper for admin login
  middleware.ts               # Guards /admin and /api/admin behind the session
  components/                  # Header, Footer, ProductCard, WhatsAppButton, Gallery,
                                # MobileNav, AdminProductForm...
  layouts/Layout.astro         # Base layout with SEO/Open Graph meta tags
  pages/
    index.astro                # Home (reads featured products from KV)
    catalogo/index.astro       # Catalog with category + tag filters
    catalogo/[slug].astro      # Product detail
    sobre-nosotros.astro       # About / Contact (statically prerendered)
    sitemap.xml.ts              # Dynamic sitemap (static pages + live product URLs)
    img/[...path].ts            # Streams product photos from the R2 bucket
    admin/
      login.astro                # Password form
      index.astro                 # Product list, links to edit/delete
      productos/nuevo.astro        # Create product form
      productos/[slug]/editar.astro # Edit product form
    api/admin/
      login.ts, logout.ts          # Session endpoints
      products.ts                   # POST: create a product
      products/[slug].ts            # PUT: update, DELETE: remove
public/                         # favicon, og-image, robots.txt
wrangler.jsonc                   # R2/KV bindings (main/assets paths are adapter-generated)
```

## Editing the WhatsApp number and messages

Everything lives in one file: **`src/config/site.ts`**.

```ts
export const WHATSAPP_NUMBER = "000000000"; // <- replace with the real number
```

Format: country code + number, no `+`, no spaces or dashes (e.g. `5491122334455` for
Argentina). The prefilled button text and the Instagram link / contact email are edited
in that same file.

## Managing products — the `/admin` panel

Go to `/admin/login` on the deployed site, enter the admin password (see **Required
Cloudflare secrets** below), and you can:

- **Add a product**: name, category, collections (tags), descriptions, optional
  material/size/print time, and photos. Photos are resized client-side (max ~1600px
  wide) before upload to keep storage and bandwidth small — there's no server-side image
  optimization step since photos aren't known at build time anymore.
- **Edit a product**: same form, pre-filled. You can remove individual existing photos
  and add new ones in the same save.
- **Delete a product**: removes its KV record and all of its R2 photos.

Every change is live on `/catalogo` immediately — Cloudflare KV is eventually consistent,
so in rare cases a change can take up to ~60 seconds to show up everywhere, but there is
no build or deploy involved.

### Categories vs. tags

`category` is one required value per product (Funcional, Decorativo, Juguetes, Hogar y
Organización) — the main way the catalog is organized — curated in `CATEGORIES` in
`src/config/site.ts`. `tags` is a separate, optional array for cross-cutting collections a
product can belong to alongside its category — seasonal drops (Halloween, Navidad) or
brand fits (Owala, Yeti), for example. A product can have zero, one, or several tags.
To add a new tag or category, add it to `TAGS` or `CATEGORIES` in `src/config/site.ts` —
the admin form and the catalog filters pick it up automatically.

## Local development

Requires Node 18.20.8+, 20.3.0+, or 22.0.0+.

```bash
npm install
npm run dev       # http://localhost:4321 (astro dev — no R2/KV bindings available here)
npm run build     # production build into dist/
```

To test the full app with working R2/KV bindings locally (needed for the catalog and
admin panel to actually work), use Wrangler's local emulation instead of `astro dev`:

```bash
npm run build
npx wrangler dev --config dist/server/wrangler.json --local
```

Create a `.dev.vars` file (already gitignored) with a local admin password so you can log
into `/admin` locally:

```
ADMIN_PASSWORD="whatever-you-want-locally"
```

`npm run build` runs `astro check` before compiling, so type errors are caught early.

## Deploying to Cloudflare

This deploys as a **Cloudflare Worker** (the modern replacement for Pages for this kind
of app), not classic Cloudflare Pages.

### One-time setup (already done for this project, listed for reference)

1. Enable R2 for the account (Cloudflare dashboard → R2 → accept terms).
2. Create the R2 bucket and KV namespaces (`araster-product-photos`, `araster-products`,
   `araster-sessions`) and wire them into `wrangler.jsonc`.

### Required Cloudflare secrets (must be set manually — not in the repo)

In the Cloudflare dashboard → Workers & Pages → the `araster` Worker → Settings →
Variables and Secrets, add:

- `ADMIN_PASSWORD` (encrypted) — the password for `/admin`.

There's no way to set this from a wrangler-less tool or an interactive-login-free session,
so it has to be done once by hand in the dashboard (or via `wrangler secret put
ADMIN_PASSWORD` if you have `wrangler login`'d locally).

### Build & deploy

- **Build command:** `npm run build`
- **Deploy config:** `dist/server/wrangler.json` (generated by the Astro Cloudflare
  adapter on every build — it merges the bindings from the root `wrangler.jsonc` with the
  correct `main`/`assets` paths for that build). If your Cloudflare project is set up via
  git integration ("Workers Builds"), point its Wrangler config path setting at
  `dist/server/wrangler.json`.
- **Manual deploy:**
  ```bash
  npm run deploy   # runs the build, then `wrangler deploy --config dist/server/wrangler.json`
  ```

## SEO

- Meta tags and Open Graph tags (in Spanish, matching the page content) in
  `src/layouts/Layout.astro` (title, description, image, canonical).
- `src/pages/sitemap.xml.ts` generates the sitemap at request time (static pages + every
  product currently in KV) — update the `site` URL in `astro.config.mjs` once you have the
  final domain.
- `public/robots.txt` references the sitemap.
- `public/og-image.svg` is a placeholder — for better social-platform compatibility (some
  don't support SVG in Open Graph), replace it with a 1200x630 `.png` or `.jpg` and update
  `SITE.ogImage` in `src/config/site.ts`.
