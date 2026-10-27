import { z } from "zod";
import type { Env } from "@/lib/products";

export const ORDER_STATUSES = ["pendiente", "confirmado", "imprimiendo", "listo", "entregado", "cancelado"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  imprimiendo: "Imprimiendo",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const orderLineSchema = z.object({
  productSlug: z.string(),
  productName: z.string(),
  quantity: z.number().int().min(1).max(50),
  colorName: z.string().optional(),
  colorHex: z.string().optional(),
  /** Snapshots taken when the order was placed, so later product edits don't change old orders. */
  unitPrice: z.number().optional(),
  gramsEach: z.number().optional(),
  material: z.string().optional(),
});

export const orderSchema = z.object({
  code: z.string(),
  customerName: z.string(),
  lines: z.array(orderLineSchema).min(1),
  status: z.enum(ORDER_STATUSES),
  total: z.number().optional(),
  /** True once the filament for this order was deducted from inventory. */
  filamentDeducted: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Order = z.infer<typeof orderSchema>;
export type OrderLine = z.infer<typeof orderLineSchema>;

const PREFIX = "order:";
// No 0/O/1/I to keep codes easy to read aloud.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return "AR-" + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export async function createOrder(
  env: Env,
  input: { customerName: string; lines: OrderLine[] }
): Promise<Order> {
  let code = randomCode();
  for (let i = 0; i < 5 && (await env.PRODUCTS_KV.get(PREFIX + code)); i++) code = randomCode();
  const now = new Date().toISOString();
  const priced = input.lines.every((l) => l.unitPrice != null);
  const order: Order = {
    code,
    customerName: input.customerName,
    lines: input.lines,
    status: "pendiente",
    total: priced ? input.lines.reduce((sum, l) => sum + (l.unitPrice ?? 0) * l.quantity, 0) : undefined,
    filamentDeducted: false,
    createdAt: now,
    updatedAt: now,
  };
  await env.PRODUCTS_KV.put(PREFIX + code, JSON.stringify(orderSchema.parse(order)));
  return order;
}

export async function getOrder(env: Env, code: string): Promise<Order | null> {
  const raw = await env.PRODUCTS_KV.get(PREFIX + code);
  if (!raw) return null;
  const parsed = orderSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

export async function saveOrder(env: Env, order: Order): Promise<void> {
  const next = orderSchema.parse({ ...order, updatedAt: new Date().toISOString() });
  await env.PRODUCTS_KV.put(PREFIX + next.code, JSON.stringify(next));
}

export async function deleteOrder(env: Env, code: string): Promise<void> {
  await env.PRODUCTS_KV.delete(PREFIX + code);
}

/** Newest first. */
export async function listOrders(env: Env): Promise<Order[]> {
  const { keys } = await env.PRODUCTS_KV.list({ prefix: PREFIX });
  const orders = await Promise.all(
    keys.map(async (k) => {
      const raw = await env.PRODUCTS_KV.get(k.name);
      if (!raw) return null;
      const parsed = orderSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    })
  );
  return orders.filter((o): o is Order => o !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface PrintQueueRow {
  key: string;
  productName: string;
  colorName?: string;
  colorHex?: string;
  quantity: number;
  /** Grams for the whole row, when the product has a weight. */
  grams?: number;
  material?: string;
  orderCodes: string[];
}

/** What still has to be printed: confirmed and in-progress orders, grouped by product + color. */
export function buildPrintQueue(orders: Order[]): PrintQueueRow[] {
  const rows = new Map<string, PrintQueueRow>();
  for (const order of orders) {
    if (order.status !== "confirmado" && order.status !== "imprimiendo") continue;
    for (const line of order.lines) {
      const key = `${line.productSlug}|${(line.colorName ?? "").toLowerCase()}`;
      const row =
        rows.get(key) ??
        ({
          key,
          productName: line.productName,
          colorName: line.colorName,
          colorHex: line.colorHex,
          quantity: 0,
          material: line.material,
          orderCodes: [],
        } as PrintQueueRow);
      row.quantity += line.quantity;
      if (line.gramsEach) row.grams = (row.grams ?? 0) + line.gramsEach * line.quantity;
      if (!row.orderCodes.includes(order.code)) row.orderCodes.push(order.code);
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.productName.localeCompare(b.productName, "es"));
}
