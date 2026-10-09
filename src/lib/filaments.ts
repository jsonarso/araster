import { z } from "zod";
import type { Env, Product } from "@/lib/products";

export const filamentSchema = z.object({
  id: z.string(),
  material: z.string().min(1),
  colorName: z.string().min(1),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  brand: z.string().default(""),
  code: z.string().optional(),
  remainingG: z.number().min(0),
  createdAt: z.string(),
});

export type Filament = z.infer<typeof filamentSchema>;

const PREFIX = "filament:";

/** Extra filament kept aside so a failed print can be redone. */
export const REPRINT_MARGIN = 1.15;

export const COMMON_MATERIALS = ["PLA", "PLA Mate", "PLA Silk", "PETG", "TPU", "ABS"];

function normalizeMaterial(m: string): string {
  // "mate" (Spanish spelling) and "matte" (Bambu Lab) are the same finish.
  return m.trim().toLowerCase().replace(/\s+/g, " ").replace(/\bmate\b/g, "matte");
}

export async function listFilaments(env: Env): Promise<Filament[]> {
  const { keys } = await env.PRODUCTS_KV.list({ prefix: PREFIX });
  const items = await Promise.all(
    keys.map(async (k) => {
      const raw = await env.PRODUCTS_KV.get(k.name);
      if (!raw) return null;
      const parsed = filamentSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    })
  );
  return items
    .filter((f): f is Filament => f !== null)
    .sort((a, b) => a.material.localeCompare(b.material, "es") || a.colorName.localeCompare(b.colorName, "es"));
}

export async function getFilament(env: Env, id: string): Promise<Filament | null> {
  const raw = await env.PRODUCTS_KV.get(PREFIX + id);
  if (!raw) return null;
  const parsed = filamentSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

export async function saveFilament(env: Env, filament: Filament): Promise<void> {
  await env.PRODUCTS_KV.put(PREFIX + filament.id, JSON.stringify(filamentSchema.parse(filament)));
}

export async function deleteFilament(env: Env, id: string): Promise<void> {
  await env.PRODUCTS_KV.delete(PREFIX + id);
}

export interface ColorOption {
  name: string;
  hex: string;
}

/** Colors a customer can pick for a product: one per distinct color name among
 * spools of the product's material that hold enough for one print plus the
 * reprint margin. Products without a material or weight show no picker. */
export function availableColors(product: Pick<Product, "material" | "filamentGrams">, filaments: Filament[]): ColorOption[] {
  if (!product.material) return [];
  const material = normalizeMaterial(product.material);
  const needed = product.filamentGrams ? product.filamentGrams * REPRINT_MARGIN : 1;
  const seen = new Map<string, ColorOption>();
  for (const f of filaments) {
    if (normalizeMaterial(f.material) !== material || f.remainingG < needed) continue;
    const key = f.colorName.trim().toLowerCase();
    if (!seen.has(key)) seen.set(key, { name: f.colorName.trim(), hex: f.colorHex });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

// ---- Usage log: every change to a spool's grams is recorded so it can be audited and undone ----

export type UsageKind = "print" | "waste" | "adjust";

export const usageEntrySchema = z.object({
  id: z.string(),
  at: z.string(),
  filamentId: z.string(),
  filamentLabel: z.string(),
  productSlug: z.string().optional(),
  productName: z.string().optional(),
  /** Grams taken out of the spool (negative when an adjustment adds grams). */
  grams: z.number(),
  kind: z.enum(["print", "waste", "adjust"]),
});

export type UsageEntry = z.infer<typeof usageEntrySchema>;

/** Spools below this are flagged in the admin so they can be restocked. */
export const LOW_STOCK_G = 150;

const LOG_PREFIX = "usage:";

export function filamentLabel(f: Pick<Filament, "material" | "colorName">): string {
  return `${f.material} · ${f.colorName}`;
}

/** Takes `grams` out of a spool (never below zero) and records it. Returns the entry, or null if the spool is gone. */
export async function recordUsage(
  env: Env,
  input: { filamentId: string; grams: number; kind: UsageKind; productSlug?: string; productName?: string }
): Promise<UsageEntry | null> {
  const filament = await getFilament(env, input.filamentId);
  if (!filament) return null;
  const remaining = Math.max(0, filament.remainingG - input.grams);
  // Log what was actually taken so an undo restores exactly that.
  const taken = filament.remainingG - remaining;
  await saveFilament(env, { ...filament, remainingG: remaining });
  const now = new Date();
  const entry: UsageEntry = {
    // Reverse-sorted key so the newest entries list first.
    id: `${String(9999999999999 - now.getTime())}-${crypto.randomUUID().slice(0, 6)}`,
    at: now.toISOString(),
    filamentId: filament.id,
    filamentLabel: filamentLabel(filament),
    productSlug: input.productSlug,
    productName: input.productName,
    grams: taken,
    kind: input.kind,
  };
  await env.PRODUCTS_KV.put(LOG_PREFIX + entry.id, JSON.stringify(entry));
  return entry;
}

export async function listUsage(env: Env, limit = 40): Promise<UsageEntry[]> {
  const { keys } = await env.PRODUCTS_KV.list({ prefix: LOG_PREFIX, limit });
  const entries = await Promise.all(
    keys.map(async (k) => {
      const raw = await env.PRODUCTS_KV.get(k.name);
      if (!raw) return null;
      const parsed = usageEntrySchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    })
  );
  return entries.filter((e): e is UsageEntry => e !== null);
}

/** Puts the grams back on the spool (if it still exists) and removes the entry. */
export async function undoUsage(env: Env, id: string): Promise<boolean> {
  const raw = await env.PRODUCTS_KV.get(LOG_PREFIX + id);
  if (!raw) return false;
  const parsed = usageEntrySchema.safeParse(JSON.parse(raw));
  if (parsed.success) {
    const filament = await getFilament(env, parsed.data.filamentId);
    if (filament) {
      await saveFilament(env, { ...filament, remainingG: Math.max(0, filament.remainingG + parsed.data.grams) });
    }
  }
  await env.PRODUCTS_KV.delete(LOG_PREFIX + id);
  return true;
}
