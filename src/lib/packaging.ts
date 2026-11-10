import { z } from "zod";
import type { Env } from "@/lib/products";

/** A packaging/delivery material in the catalog: bags, string, boxes... bought in packs. */
export const packagingItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  /** What one "unit" is: "unidad", "metro", ... Only used for display. */
  unit: z.string().min(1),
  /** What the whole pack cost, in CRC. */
  packPrice: z.number().positive(),
  /** How many units come in the pack (100 bags, 20 meters...). */
  packQuantity: z.number().positive(),
  createdAt: z.string(),
});

export type PackagingItem = z.infer<typeof packagingItemSchema>;
export interface PackagingUse {
  itemId: string;
  quantity: number;
}

const PREFIX = "packaging:";

export function unitCostCrc(item: Pick<PackagingItem, "packPrice" | "packQuantity">): number {
  return item.packPrice / item.packQuantity;
}

/** Total packaging cost for one piece. Uses missing items as zero so a deleted item can't break pricing. */
export function packagingCostCrc(uses: PackagingUse[], items: Pick<PackagingItem, "id" | "packPrice" | "packQuantity">[]): number {
  return uses.reduce((sum, use) => {
    const item = items.find((i) => i.id === use.itemId);
    return item ? sum + unitCostCrc(item) * use.quantity : sum;
  }, 0);
}

export async function listPackaging(env: Env): Promise<PackagingItem[]> {
  const { keys } = await env.PRODUCTS_KV.list({ prefix: PREFIX });
  const items = await Promise.all(
    keys.map(async (k) => {
      const raw = await env.PRODUCTS_KV.get(k.name);
      if (!raw) return null;
      const parsed = packagingItemSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    })
  );
  return items.filter((i): i is PackagingItem => i !== null).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function getPackagingItem(env: Env, id: string): Promise<PackagingItem | null> {
  const raw = await env.PRODUCTS_KV.get(PREFIX + id);
  if (!raw) return null;
  const parsed = packagingItemSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

export async function savePackagingItem(env: Env, item: PackagingItem): Promise<void> {
  await env.PRODUCTS_KV.put(PREFIX + item.id, JSON.stringify(packagingItemSchema.parse(item)));
}

export async function deletePackagingItem(env: Env, id: string): Promise<void> {
  await env.PRODUCTS_KV.delete(PREFIX + id);
}
