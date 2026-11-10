import type { APIRoute } from "astro";
import { getEnv, listProducts } from "@/lib/products";
import { deletePackagingItem, getPackagingItem, savePackagingItem } from "@/lib/packaging";

export const prerender = false;

function back(msg: string, kind: "ok" | "error") {
  const params = new URLSearchParams({ [kind]: msg });
  return new Response(null, { status: 303, headers: { Location: `/admin/empaques?${params}` } });
}

function positive(value: FormDataEntryValue | null): number | null {
  const n = parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const POST: APIRoute = async ({ request }) => {
  const env = getEnv();
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const id = String(form.get("id") ?? "").trim();

  if (intent === "create" || intent === "update") {
    const name = String(form.get("name") ?? "").trim();
    const unit = String(form.get("unit") ?? "").trim();
    const packPrice = positive(form.get("packPrice"));
    const packQuantity = positive(form.get("packQuantity"));
    if (!name || !unit) return back("El nombre y la unidad son obligatorios.", "error");
    if (packPrice == null) return back("El precio del paquete debe ser mayor a cero.", "error");
    if (packQuantity == null) return back("La cantidad por paquete debe ser mayor a cero.", "error");

    if (intent === "create") {
      await savePackagingItem(env, {
        id: crypto.randomUUID().slice(0, 8),
        name,
        unit,
        packPrice,
        packQuantity,
        createdAt: new Date().toISOString(),
      });
      return back(`"${name}" agregado.`, "ok");
    }

    const existing = id ? await getPackagingItem(env, id) : null;
    if (!existing) return back("El material no existe.", "error");
    await savePackagingItem(env, { ...existing, name, unit, packPrice, packQuantity });
    return back(`"${name}" actualizado. Los productos que lo usan recalculan su precio sugerido al abrirlos.`, "ok");
  }

  if (intent === "delete") {
    const item = id ? await getPackagingItem(env, id) : null;
    if (!item) return back("El material no existe.", "error");
    const users = (await listProducts(env)).filter((p) => p.packaging.some((u) => u.itemId === id));
    if (users.length > 0) {
      return back(
        `No se puede eliminar "${item.name}": lo usan ${users.length} producto${users.length === 1 ? "" : "s"} (${users
          .slice(0, 3)
          .map((p) => p.name)
          .join(", ")}${users.length > 3 ? "…" : ""}). Quitalo de ahí primero.`,
        "error"
      );
    }
    await deletePackagingItem(env, id);
    return back(`"${item.name}" eliminado.`, "ok");
  }

  return back("Acción desconocida.", "error");
};
