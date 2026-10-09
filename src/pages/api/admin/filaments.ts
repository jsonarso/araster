import type { APIRoute } from "astro";
import { getEnv } from "@/lib/products";
import { getFilament, saveFilament, deleteFilament } from "@/lib/filaments";

export const prerender = false;

function back(msg: string, kind: "ok" | "error") {
  const params = new URLSearchParams({ [kind]: msg });
  return new Response(null, { status: 303, headers: { Location: `/admin/filamentos?${params}` } });
}

export const POST: APIRoute = async ({ request }) => {
  const env = getEnv();
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const id = String(form.get("id") ?? "").trim();
  const grams = Number(String(form.get("remainingG") ?? "").replace(",", "."));

  if (intent === "create") {
    const material = String(form.get("material") ?? "").trim();
    const colorName = String(form.get("colorName") ?? "").trim();
    const colorHex = String(form.get("colorHex") ?? "").trim();
    const brand = String(form.get("brand") ?? "").trim();
    if (!material || !colorName) return back("Material y nombre del color son obligatorios.", "error");
    if (!/^#[0-9a-fA-F]{6}$/.test(colorHex)) return back("Elegí un color válido.", "error");
    if (!Number.isFinite(grams) || grams < 0) return back("Los gramos deben ser un número válido.", "error");
    await saveFilament(env, {
      id: crypto.randomUUID().slice(0, 8),
      material,
      colorName,
      colorHex,
      brand,
      remainingG: Math.round(grams),
      createdAt: new Date().toISOString(),
    });
    return back(`Carrete ${colorName} (${material}) agregado.`, "ok");
  }

  if (intent === "update") {
    const filament = id ? await getFilament(env, id) : null;
    if (!filament) return back("El carrete no existe.", "error");
    if (!Number.isFinite(grams) || grams < 0) return back("Los gramos deben ser un número válido.", "error");
    await saveFilament(env, { ...filament, remainingG: Math.round(grams) });
    return back("Gramos actualizados.", "ok");
  }

  if (intent === "delete") {
    if (!id) return back("Falta el carrete.", "error");
    await deleteFilament(env, id);
    return back("Carrete eliminado.", "ok");
  }

  return back("Acción desconocida.", "error");
};
