# Araster

Sitio informativo para Araster, un taller de impresión 3D. Muestra un catálogo de piezas
impresas (funcionales, decorativas, juguetes y organización) con contacto directo por
WhatsApp. Sin carrito, sin pagos — solo mostrar el trabajo y facilitar la consulta.

## Stack

- [Astro](https://astro.build) (salida estática) + TypeScript
- Tailwind CSS v4 (config CSS-first en `src/styles/global.css`)
- React solo para las dos piezas interactivas (menú mobile y galería de fotos), como islas de Astro
- Content Collections de Astro para el catálogo de productos
- Pensado para desplegar en Cloudflare Pages

## Estructura del proyecto

```
src/
  config/site.ts        # Número de WhatsApp, mensajes prellenados, categorías, redes
  content/products/      # Un directorio por producto (markdown + fotos)
  content.config.ts       # Schema de la colección "products"
  components/              # Header, Footer, ProductCard, WhatsAppButton, Gallery, MobileNav...
  layouts/Layout.astro     # Layout base con meta tags SEO/Open Graph
  pages/
    index.astro            # Home
    catalogo/index.astro   # Catálogo con filtro por categoría
    catalogo/[slug].astro  # Detalle de producto
    sobre-nosotros.astro   # About / Contacto
public/                    # favicon, og-image, robots.txt
```

## Editar el número de WhatsApp y mensajes

Todo vive en un solo archivo: **`src/config/site.ts`**.

```ts
export const WHATSAPP_NUMBER = "000000000"; // <- reemplazar por el número real
```

Formato: código de país + número, sin `+`, sin espacios ni guiones (ej. `5491122334455`
para Argentina). Ahí mismo se editan los textos prellenados de los botones y el link de
Instagram / email de contacto.

## Agregar, editar o quitar productos

Cada producto es una carpeta en `src/content/products/<slug>/` con un `index.md` y sus
fotos al lado. No hace falta tocar código.

1. Creá una carpeta nueva, ej. `src/content/products/mi-pieza-nueva/`.
2. Agregá las fotos ahí adentro (jpg, png, webp o svg).
3. Creá `index.md` con este formato:

```md
---
name: "Nombre de la pieza"
category: "funcional" # funcional | decorativo | juguetes | hogar-organizacion
shortDescription: "Descripción corta para la tarjeta del catálogo."
photos:
  - src: "./foto-1.jpg"
    alt: "Texto alternativo de la foto"
  - src: "./foto-2.jpg"
    alt: "Otra foto del producto"
material: "PLA" # opcional
size: "10 x 10 x 5 cm" # opcional
printTime: "3 h" # opcional
featured: false # true para mostrarla en el home
---

Descripción larga del producto (soporta markdown).
```

Para agregar una categoría nueva, sumala al array `CATEGORIES` en `src/config/site.ts` y
usá el mismo `slug` en el `category` de tus productos.

Las fotos placeholder actuales son SVGs generados (estilo "blueprint") para no depender de
imágenes reales todavía — reemplazalas por fotos reales cuando las tengas, el sitio las va
a optimizar automáticamente gracias a `astro:assets`.

## Desarrollo local

Requiere Node 18.20.8+, 20.3.0+ o 22.0.0+.

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # build de producción en dist/
npm run preview   # sirve el build de producción localmente
```

`npm run build` corre `astro check` antes de compilar, así se detectan errores de tipos.

## Deploy en Cloudflare Pages

1. Subí el repo a GitHub/GitLab (o usá Wrangler para deploy directo).
2. En el dashboard de Cloudflare Pages, creá un proyecto nuevo conectado al repo.
3. Configuración de build:
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** 20 (o superior) — configurable con la variable de entorno
     `NODE_VERSION` en Cloudflare Pages si hace falta.
4. Deploy. Cloudflare va a reconstruir el sitio en cada push a la rama configurada.

También se puede desplegar con Wrangler:

```bash
npm run build
npx wrangler pages deploy dist
```

No hay funciones server-side ni SSR — el sitio es 100% estático, así que no necesita
configuración adicional de Cloudflare Pages Functions.

## SEO

- Meta tags y Open Graph en español en `src/layouts/Layout.astro` (título, descripción,
  imagen, canonical).
- Sitemap generado automáticamente en el build (`@astrojs/sitemap`) — actualizá la URL
  `site` en `astro.config.mjs` cuando tengas el dominio final.
- `public/robots.txt` con referencia al sitemap.
- `public/og-image.svg` es un placeholder — para mejor compatibilidad con redes sociales
  (algunas no soportan SVG en Open Graph), reemplazalo por un `.png` o `.jpg` de 1200x630
  y actualizá `SITE.ogImage` en `src/config/site.ts`.
