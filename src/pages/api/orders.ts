import type { APIRoute } from "astro";
import { getEnv, getProduct } from "@/lib/products";
import { availableColors, listFilaments } from "@/lib/filaments";
import { createOrder } from "@/lib/orders";
import { formatCrc } from "@/lib/pricing";
import { whatsappLink } from "@/config/site";

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Public endpoint: records a pending order, then the browser opens WhatsApp with its code. */
export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => null)) as {
    productSlug?: string;
    quantity?: number;
    colorName?: string;
    customerName?: string;
    website?: string; // honeypot, real users leave it empty
  } | null;
  if (!body) return json({ error: "Solicitud inválida." }, 400);
  if (body.website) return json({ ok: true, whatsappUrl: whatsappLink() }); // pretend success to bots

  const customerName = String(body.customerName ?? "").trim().slice(0, 60);
  if (!customerName) return json({ error: "Ingresá tu nombre." }, 400);

  const quantity = Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
    return json({ error: "La cantidad debe estar entre 1 y 50." }, 400);
  }

  const env = getEnv();
  const product = body.productSlug ? await getProduct(env, body.productSlug) : null;
  if (!product) return json({ error: "Ese producto ya no está disponible." }, 404);

  const colors = availableColors(product, await listFilaments(env));
  let color: { name: string; hex: string } | undefined;
  if (colors.length > 0) {
    color = colors.find((c) => c.name.toLowerCase() === String(body.colorName ?? "").toLowerCase());
    if (!color) return json({ error: "Elegí un color disponible." }, 400);
  }

  const order = await createOrder(env, {
    customerName,
    lines: [
      {
        productSlug: product.slug,
        productName: product.name,
        quantity,
        colorName: color?.name,
        colorHex: color?.hex,
        unitPrice: product.price,
        gramsEach: product.filamentGrams,
        material: product.material,
      },
    ],
  });

  const detail = `${quantity} × ${product.name}${color ? `, color ${color.name}` : ""}`;
  const totalText = order.total != null ? ` Total estimado: ${formatCrc(order.total)}.` : "";
  const message = `¡Hola! Quiero hacer un pedido (${order.code}): ${detail}.${totalText} A nombre de ${customerName}.`;

  return json({ ok: true, code: order.code, whatsappUrl: whatsappLink(message) });
};
