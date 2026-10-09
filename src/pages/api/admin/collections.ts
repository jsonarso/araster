import type { APIRoute } from "astro";
import { getEnv, slugify, saveCollection, deleteCollection, collectionExists } from "@/lib/products";

export const prerender = false;

function back(msg: string, kind: "ok" | "error") {
  const params = new URLSearchParams({ [kind]: msg });
  return new Response(null, { status: 303, headers: { Location: `/admin/colecciones?${params}` } });
}

export const POST: APIRoute = async ({ request }) => {
  const env = getEnv();
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const label = String(form.get("label") ?? "").trim();
  const slug = String(form.get("slug") ?? "").trim();

  if (intent === "create") {
    if (!label) return back("El nombre es obligatorio.", "error");
    const newSlug = slugify(label);
    if (!newSlug) return back("El nombre debe tener letras o números.", "error");
    if (await collectionExists(env, newSlug)) return back("Ya existe una colección con ese nombre.", "error");
    await saveCollection(env, { slug: newSlug, label });
    return back(`Colección "${label}" creada.`, "ok");
  }

  if (intent === "rename") {
    if (!slug || !label) return back("Falta el nombre.", "error");
    if (!(await collectionExists(env, slug))) return back("La colección no existe.", "error");
    await saveCollection(env, { slug, label });
    return back("Nombre actualizado.", "ok");
  }

  if (intent === "delete") {
    if (!slug) return back("Falta la colección.", "error");
    const count = await deleteCollection(env, slug);
    return back(
      count > 0 ? `Colección eliminada (se quitó de ${count} producto${count === 1 ? "" : "s"}).` : "Colección eliminada.",
      "ok"
    );
  }

  return back("Acción desconocida.", "error");
};
