import type { APIRoute } from "astro";
import { getEnv } from "@/lib/products";
import { getFilament, saveFilament, deleteFilament, recordUsage, undoUsage } from "@/lib/filaments";
import { getProduct } from "@/lib/products";

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
    const code = String(form.get("code") ?? "").trim() || undefined;
    if (!material || !colorName) return back("Material y nombre del color son obligatorios.", "error");
    if (!/^#[0-9a-fA-F]{6}$/.test(colorHex)) return back("Elegí un color válido.", "error");
    if (!Number.isFinite(grams) || grams < 0) return back("Los gramos deben ser un número válido.", "error");
    await saveFilament(env, {
      id: crypto.randomUUID().slice(0, 8),
      material,
      colorName,
      colorHex,
      brand,
      code,
      remainingG: Math.round(grams),
      createdAt: new Date().toISOString(),
    });
    return back(`Carrete ${colorName} (${material}) agregado.`, "ok");
  }

  if (intent === "update") {
    const filament = id ? await getFilament(env, id) : null;
    if (!filament) return back("El carrete no existe.", "error");
    if (!Number.isFinite(grams) || grams < 0) return back("Los gramos deben ser un número válido.", "error");
    const newG = Math.round(grams);
    // Route through the usage log so the correction is auditable and undoable.
    if (newG < filament.remainingG) {
      await recordUsage(env, { filamentId: id, grams: filament.remainingG - newG, kind: "adjust" });
    } else {
      await saveFilament(env, { ...filament, remainingG: newG });
    }
    return back("Gramos actualizados.", "ok");
  }

  if (intent === "use") {
    const kind = String(form.get("kind") ?? "print") === "waste" ? "waste" : "print";
    const productSlug = String(form.get("productSlug") ?? "").trim();
    const product = productSlug ? await getProduct(env, productSlug) : null;
    if (!id || !(await getFilament(env, id))) return back("Elegí un carrete.", "error");
    if (!Number.isFinite(grams) || grams <= 0) return back("Los gramos deben ser mayores a cero.", "error");
    const entry = await recordUsage(env, {
      filamentId: id,
      grams: Math.round(grams),
      kind,
      productSlug: product?.slug,
      productName: product?.name,
    });
    return back(
      `${kind === "waste" ? "Merma" : "Impresión"} registrada: −${entry?.grams ?? 0} g de ${entry?.filamentLabel ?? ""}.`,
      "ok"
    );
  }

  if (intent === "undo") {
    const entryId = String(form.get("entryId") ?? "");
    return (await undoUsage(env, entryId)) ? back("Movimiento deshecho.", "ok") : back("No se encontró el movimiento.", "error");
  }

  if (intent === "delete") {
    if (!id) return back("Falta el carrete.", "error");
    await deleteFilament(env, id);
    return back("Carrete eliminado.", "ok");
  }

  return back("Acción desconocida.", "error");
};
