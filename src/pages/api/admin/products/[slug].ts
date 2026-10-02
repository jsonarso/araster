import type { APIRoute } from "astro";
import {
  getEnv,
  getProduct,
  saveProduct,
  deleteProduct,
  deleteProductPhoto,
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

export const PUT: APIRoute = async ({ params, request }) => {
  const env = getEnv();
  const slug = params.slug;
  if (!slug) return jsonError("Falta el identificador del producto.");

  const current = await getProduct(env, slug);
  if (!current) return jsonError("El producto no existe.", 404);

  const form = await request.formData();

  const name = String(form.get("name") ?? "").trim();
  const category = String(form.get("category") ?? "");
  const shortDescription = String(form.get("shortDescription") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const material = String(form.get("material") ?? "").trim() || undefined;
  const size = String(form.get("size") ?? "").trim() || undefined;
  const printTime = String(form.get("printTime") ?? "").trim() || undefined;
  const featured = form.get("featured") === "true";

  let tags: string[] = [];
  let alts: string[] = [];
  let keptPhotos: { key: string; alt: string }[] = [];
  try {
    tags = JSON.parse(String(form.get("tagsJson") ?? "[]"));
    alts = JSON.parse(String(form.get("altsJson") ?? "[]"));
    keptPhotos = JSON.parse(String(form.get("keptPhotosJson") ?? "[]"));
  } catch {
    return jsonError("Datos de etiquetas o fotos inválidos.");
  }

  if (!name) return jsonError("El nombre es obligatorio.");

  const removedPhotos = current.photos.filter(
    (p) => !keptPhotos.some((kept) => kept.key === p.key)
  );

  const files = form.getAll("photo").filter((f): f is File => f instanceof File && f.size > 0);
  const newPhotos = await Promise.all(
    files.map(async (file, i) => {
      const { key } = await uploadProductPhoto(env, slug, file);
      return { key, alt: alts[i] || name };
    })
  );

  const photos = [...keptPhotos, ...newPhotos];
  if (photos.length === 0) {
    return jsonError("El producto necesita al menos una foto.");
  }

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
    featured,
    photos,
  };

  try {
    const product = await saveProduct(env, input, false);
    await Promise.all(removedPhotos.map((p) => deleteProductPhoto(env, p.key)));
    return new Response(JSON.stringify({ ok: true, slug: product.slug }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "No se pudo guardar el producto.", 400);
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const env = getEnv();
  const slug = params.slug;
  if (!slug) return jsonError("Falta el identificador del producto.");

  const existing = await getProduct(env, slug);
  if (!existing) return jsonError("El producto no existe.", 404);

  await deleteProduct(env, slug);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
