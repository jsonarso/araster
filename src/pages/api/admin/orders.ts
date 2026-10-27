import type { APIRoute } from "astro";
import { getEnv } from "@/lib/products";
import { findSpool, listFilaments, recordUsage } from "@/lib/filaments";
import { deleteOrder, getOrder, saveOrder, STATUS_LABELS, type OrderStatus } from "@/lib/orders";

export const prerender = false;

function back(msg: string, kind: "ok" | "error") {
  const params = new URLSearchParams({ [kind]: msg });
  return new Response(null, { status: 303, headers: { Location: `/admin/pedidos?${params}` } });
}

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pendiente: ["confirmado", "cancelado"],
  confirmado: ["imprimiendo", "cancelado"],
  imprimiendo: ["listo"],
  listo: ["entregado"],
  entregado: [],
  cancelado: [],
};

export const POST: APIRoute = async ({ request }) => {
  const env = getEnv();
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const code = String(form.get("code") ?? "");
  const order = code ? await getOrder(env, code) : null;
  if (!order) return back("El pedido no existe.", "error");

  if (intent === "delete") {
    if (order.status !== "pendiente" && order.status !== "cancelado") {
      return back("Solo se pueden eliminar pedidos pendientes o cancelados.", "error");
    }
    await deleteOrder(env, code);
    return back(`Pedido ${code} eliminado.`, "ok");
  }

  if (intent === "status") {
    const status = String(form.get("status") ?? "") as OrderStatus;
    if (!NEXT[order.status].includes(status)) {
      return back(`No se puede pasar de ${STATUS_LABELS[order.status]} a ${STATUS_LABELS[status] ?? status}.`, "error");
    }

    const warnings: string[] = [];
    // Printing starts: take the filament out of inventory (once per order).
    if (status === "imprimiendo" && !order.filamentDeducted) {
      const filaments = await listFilaments(env);
      for (const line of order.lines) {
        if (!line.material || !line.colorName || !line.gramsEach) {
          warnings.push(`${line.productName}: sin color o gramos, no se descontó filamento.`);
          continue;
        }
        const grams = Math.round(line.gramsEach * line.quantity);
        const spool = findSpool(filaments, line.material, line.colorName, grams);
        if (!spool) {
          warnings.push(`${line.productName}: no hay carrete ${line.material} ${line.colorName}, no se descontó filamento.`);
          continue;
        }
        const entry = await recordUsage(env, {
          filamentId: spool.id,
          grams,
          kind: "print",
          productSlug: line.productSlug,
          productName: line.productName,
        });
        if (entry && entry.grams < grams) {
          warnings.push(`${line.productName}: al carrete solo le quedaban ${entry.grams} g de los ${grams} g necesarios.`);
        }
        // Keep local copy in sync if another line uses the same spool.
        spool.remainingG = Math.max(0, spool.remainingG - grams);
      }
      order.filamentDeducted = true;
    }

    order.status = status;
    await saveOrder(env, order);
    const note = warnings.length ? ` Atención: ${warnings.join(" ")}` : "";
    return back(`Pedido ${code}: ${STATUS_LABELS[status]}.${note}`, warnings.length ? "error" : "ok");
  }

  return back("Acción desconocida.", "error");
};
