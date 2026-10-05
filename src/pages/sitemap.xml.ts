import type { APIRoute } from "astro";
import { SITE } from "@/config/site";
import { listProducts, getEnv } from "@/lib/products";

export const prerender = false;

export const GET: APIRoute = async () => {
  const products = await listProducts(getEnv());

  const staticPaths = ["/", "/catalogo"];
  const productPaths = products.map((p) => `/catalogo/${p.slug}`);
  const urls = [...staticPaths, ...productPaths];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((path) => `  <url><loc>${new URL(path, SITE.url).toString()}</loc></url>`).join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml" },
  });
};
