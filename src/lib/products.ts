import { z } from "zod";
import { env as workerEnv } from "cloudflare:workers";
import { CATEGORIES } from "@/config/site";

export interface Env {
  PRODUCTS_KV: KVNamespace;
  PRODUCT_PHOTOS: R2Bucket;
  SESSION: KVNamespace;
  ASSETS: Fetcher;
  ADMIN_PASSWORD: string;
}

/** The Cloudflare Worker's runtime bindings — KV, R2, and secrets. */
export function getEnv(): Env {
  return workerEnv as unknown as Env;
}

const categorySlugs = CATEGORIES.map((c) => c.slug) as [string, ...string[]];

export const photoSchema = z.object({
  key: z.string(),
  alt: z.string(),
});

export const productSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Usá minúsculas, números y guiones (sin espacios ni acentos)."),
  name: z.string().min(1, "El nombre es obligatorio."),
  category: z.enum(categorySlugs),
  tags: z.array(z.string()).default([]),
  shortDescription: z.string().min(1, "La descripción corta es obligatoria."),
  description: z.string().default(""),
  material: z.string().optional(),
  size: z.string().optional(),
  printTime: z.string().optional(),
  printTimeHours: z.number().positive().optional(),
  filamentGrams: z.number().positive().optional(),
  price: z.number().positive().optional(),
  featured: z.boolean().default(false),
  photos: z.array(photoSchema).min(1, "Subí al menos una foto."),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Product = z.infer<typeof productSchema>;
export type ProductInput = Omit<Product, "createdAt" | "updatedAt">;

const KEY_PREFIX = "product:";

export function photoUrl(key: string): string {
  return `/img/${key}`;
}

export async function listProducts(env: Env): Promise<Product[]> {
  const { keys } = await env.PRODUCTS_KV.list({ prefix: KEY_PREFIX });
  const products = await Promise.all(
    keys.map(async (k) => {
      const raw = await env.PRODUCTS_KV.get(k.name);
      if (!raw) return null;
      const parsed = productSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    })
  );
  return products
    .filter((p): p is Product => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function getProduct(env: Env, slug: string): Promise<Product | null> {
  const raw = await env.PRODUCTS_KV.get(KEY_PREFIX + slug);
  if (!raw) return null;
  const parsed = productSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

export async function saveProduct(env: Env, input: ProductInput, isNew: boolean): Promise<Product> {
  const existing = isNew ? null : await getProduct(env, input.slug);
  const now = new Date().toISOString();
  const product: Product = {
    ...input,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const validated = productSchema.parse(product);
  await env.PRODUCTS_KV.put(KEY_PREFIX + validated.slug, JSON.stringify(validated));
  return validated;
}

export async function deleteProduct(env: Env, slug: string): Promise<void> {
  const product = await getProduct(env, slug);
  if (product) {
    await Promise.all(product.photos.map((p) => env.PRODUCT_PHOTOS.delete(p.key)));
  }
  await env.PRODUCTS_KV.delete(KEY_PREFIX + slug);
}

export async function uploadProductPhoto(
  env: Env,
  slug: string,
  file: File
): Promise<{ key: string }> {
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  const key = `products/${slug}/${Date.now()}-${safeName}`;
  await env.PRODUCT_PHOTOS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });
  return { key };
}

export async function deleteProductPhoto(env: Env, key: string): Promise<void> {
  await env.PRODUCT_PHOTOS.delete(key);
}

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
