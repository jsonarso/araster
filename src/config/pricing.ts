// Pricing assumptions for Araster's cost-based pricing formula. All editable —
// change a number here and every future price suggestion in /admin picks it up.
// Research confidence is noted per constant; the lower-confidence ones (marked
// "ESTIMADO") are worth double-checking against your own numbers periodically.

/** What you paid for the printer, in USD. */
export const PRINTER_PRICE_USD = 399;

/** Total expected printing hours over the printer's useful life, for amortization.
 * 2,000h is a reasonable planning figure for a consumer-grade FDM printer with
 * normal maintenance (routine nozzle swaps don't reset this). */
export const PRINTER_LIFETIME_HOURS = 2000;

/** ESTIMADO — no reliable average wattage for the full-size A1 while printing was
 * found; its spec sheet lists a ~350W peak (bed+hotend heating together), but
 * steady-state draw during printing is well below that. 120W is a middle-ground
 * placeholder — measure with a plug-in power meter if you want a precise number. */
export const PRINTER_AVERAGE_WATTS = 120;

/** Shipping/import cost to bring filament from the US, in USD per pound. */
export const SHIPPING_USD_PER_LB = 7.5;
const LB_PER_KG = 2.20462;
export const SHIPPING_USD_PER_KG = SHIPPING_USD_PER_LB * LB_PER_KG;

/** Filament price per kg in USD, by material. Add more as you use new materials —
 * the pricing form falls back to DEFAULT_FILAMENT_PRICE_USD_PER_KG for anything
 * not listed here (matched case-insensitively against the product's `material` field). */
export const FILAMENT_PRICE_USD_PER_KG: Record<string, number> = {
  pla: 18,
  "pla+": 18,
  petg: 22,
  tpu: 28,
};
export const DEFAULT_FILAMENT_PRICE_USD_PER_KG = 18;

/** ESTIMADO (promedio derivado de la propuesta residencial 2026 del ICE, no la
 * tarifa oficial por bloque de consumo) — confirmá con tu factura si querés
 * precisión exacta. */
export const ELECTRICITY_CRC_PER_KWH = 86;

/** ESTIMADO — el tipo de cambio es el número más volátil de esta lista. No se
 * actualiza solo; revisalo cada tanto (p. ej. bccr.fi.cr) y editalo acá. */
export const EXCHANGE_RATE_CRC_PER_USD = 505;

/** Profit margin applied on top of the full cost subtotal (machine + material +
 * electricity). Since there's no separate labor line item, this margin is also
 * what compensates your time (slicing, supervising, post-processing, packaging). */
export const PROFIT_MARGIN_PERCENT = 30;
