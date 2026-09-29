# Araster

Informational website for Araster, a 3D printing workshop. Showcases a catalog of
printed pieces (functional, decorative, toys, and organization) with direct WhatsApp
contact. No cart, no payments — just showcase the work and make it easy to reach out.

The page content itself (products, copy, nav labels, etc.) is in Spanish, since that's
the site's audience. Everything else — code, comments, and this README — is in English.

## Stack

- [Astro](https://astro.build) (static output) + TypeScript
- Tailwind CSS v4 (CSS-first config in `src/styles/global.css`)
- React only for the two interactive pieces (mobile menu and photo gallery), as Astro islands
- Astro Content Collections for the product catalog
- Built for deployment on Cloudflare Pages

## Project structure

```
src/
  config/site.ts           # WhatsApp number, prefilled messages, categories, socials
  content/products/        # One directory per product (markdown + photos)
  content.config.ts        # Schema for the "products" collection
  components/               # Header, Footer, ProductCard, WhatsAppButton, Gallery, MobileNav...
  layouts/Layout.astro      # Base layout with SEO/Open Graph meta tags
  pages/
    index.astro             # Home
    catalogo/index.astro    # Catalog with category filter
    catalogo/[slug].astro   # Product detail
    sobre-nosotros.astro    # About / Contact
public/                     # favicon, og-image, robots.txt
```

## Editing the WhatsApp number and messages

Everything lives in one file: **`src/config/site.ts`**.

```ts
export const WHATSAPP_NUMBER = "000000000"; // <- replace with the real number
```

Format: country code + number, no `+`, no spaces or dashes (e.g. `5491122334455` for
Argentina). The prefilled button text and the Instagram link / contact email are edited
in that same file.

## Adding, editing, or removing products

Each product is a folder at `src/content/products/<slug>/` with an `index.md` and its
photos alongside it. No code changes needed.

1. Create a new folder, e.g. `src/content/products/my-new-piece/`.
2. Add the photos inside it (jpg, png, webp, or svg).
3. Create `index.md` with this format:

```md
---
name: "Nombre de la pieza"
category: "funcional" # funcional | decorativo | juguetes | hogar-organizacion
shortDescription: "Descripción corta para la tarjeta del catálogo."
tags: ["halloween", "gadgets"] # optional, see below
photos:
  - src: "./foto-1.jpg"
    alt: "Texto alternativo de la foto"
  - src: "./foto-2.jpg"
    alt: "Otra foto del producto"
material: "PLA" # optional
size: "10 x 10 x 5 cm" # optional
printTime: "3 h" # optional
featured: false # true to show it on the home page
---

Long product description (supports markdown).
```

Note: `name`, `shortDescription`, `alt`, and the body are page content, so keep them in
Spanish to match the rest of the site.

To add a new category, add it to the `CATEGORIES` array in `src/config/site.ts` and use
the same `slug` in the `category` field of your products.

### Categories vs. tags

`category` is one required value per product (Funcional, Decorativo, Juguetes, Hogar y
Organización) — it's the main way the catalog is organized. `tags` is a separate,
optional array for cross-cutting collections a product can belong to alongside its
category — seasonal drops (Halloween, Navidad) or brand fits (Owala, Yeti), for example.
A product can have zero, one, or several tags.

The curated list of known tags lives in `TAGS` in `src/config/site.ts` — add a new
`{ slug, label }` entry there, then reference its `slug` in any product's `tags` array.
The catalog page only shows a tag filter button for tags that are actually in use, so
adding a tag to `TAGS` that no product uses yet won't show up until you use it.

The current placeholder photos are generated SVGs (blueprint-style) so the site doesn't
depend on real photos yet — swap them for real photos whenever you have them; the site
will optimize them automatically via `astro:assets`.

## Local development

Requires Node 18.20.8+, 20.3.0+, or 22.0.0+.

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

`npm run build` runs `astro check` before compiling, so type errors are caught early.

## Deploying to Cloudflare Pages

1. Push the repo to GitHub/GitLab (or use Wrangler for a direct deploy).
2. In the Cloudflare Pages dashboard, create a new project connected to the repo.
3. Build configuration:
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** 20 or newer — configurable via the `NODE_VERSION` environment
     variable in Cloudflare Pages if needed.
4. Deploy. Cloudflare will rebuild the site on every push to the configured branch.

You can also deploy with Wrangler:

```bash
npm run build
npx wrangler pages deploy dist
```

There are no server-side functions or SSR — the site is 100% static, so no additional
Cloudflare Pages Functions configuration is needed.

## SEO

- Meta tags and Open Graph tags (in Spanish, matching the page content) in
  `src/layouts/Layout.astro` (title, description, image, canonical).
- Sitemap generated automatically at build time (`@astrojs/sitemap`) — update the `site`
  URL in `astro.config.mjs` once you have the final domain.
- `public/robots.txt` references the sitemap.
- `public/og-image.svg` is a placeholder — for better social-platform compatibility (some
  don't support SVG in Open Graph), replace it with a 1200x630 `.png` or `.jpg` and update
  `SITE.ogImage` in `src/config/site.ts`.
