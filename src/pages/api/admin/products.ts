import type { APIRoute } from "astro";
import {
  getEnv,
  getProduct,
  saveProduct,
  slugify,
  uploadProductPhoto,
  type ProductInput,
} from "@/lib/products";

export const prerender = false;

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseOptionalNumber(value: FormDataEntryValue | null): number | undefined {
  if (value == null) return undefined;
  const n = parseFloat(String(value));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export const POST: APIRoute = async ({ request }) => {
  const env = getEnv();
  const form = await request.formData();

  const name = String(form.get("name") ?? "").trim();
  const category = String(form.get("category") ?? "");
  const shortDescription = String(form.get("shortDescription") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const material = String(form.get("material") ?? "").trim() || undefined;
  const size = String(form.get("size") ?? "").trim() || undefined;
  const printTime = String(form.get("printTime") ?? "").trim() || undefined;
  const printTimeHours = parseOptionalNumber(form.get("printTimeHours"));
  const filamentGrams = parseOptionalNumber(form.get("filamentGrams"));
  const price = parseOptionalNumber(form.get("price"));
  const featured = form.get("featured") === "true";

  let tags: string[] = [];
  let alts: string[] = [];
  try {
    tags = JSON.parse(String(form.get("tagsJson") ?? "[]"));
    alts = JSON.parse(String(form.get("altsJson") ?? "[]"));
  } catch {
    return jsonError("Datos de etiquetas o descripciones de foto inválidos.");
  }

  if (!name) return jsonError("El nombre es obligatorio.");

  const slug = slugify(name);
  if (!slug) return jsonError("No se pudo generar un identificador a partir del nombre.");

  const existing = await getProduct(env, slug);
  if (existing) {
    return jsonError("Ya existe un producto con un nombre muy similar. Probá con otro nombre.");
  }

  const files = form.getAll("photo").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return jsonError("Subí al menos una foto.");
  }

  const photos = await Promise.all(
    files.map(async (file, i) => {
      const { key } = await uploadProductPhoto(env, slug, file);
      return { key, alt: alts[i] || name };
    })
  );

  const input: ProductInput = {
    slug,
    name,
    category: category as ProductInput["category"],
    tags,
    shortDescription,
    description,
    material,
    size,
    printTime,
    printTimeHours,
    filamentGrams,
    price,
    featured,
    photos,
  };

  try {
    const product = await saveProduct(env, input, true);
    return new Response(JSON.stringify({ ok: true, slug: product.slug }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "No se pudo guardar el producto.", 400);
  }
};
