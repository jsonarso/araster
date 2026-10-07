import {
  PRINTER_PRICE_USD,
  PRINTER_LIFETIME_HOURS,
  PRINTER_AVERAGE_WATTS,
  SHIPPING_USD_PER_KG,
  FILAMENT_PRICE_USD_PER_KG,
  DEFAULT_FILAMENT_PRICE_USD_PER_KG,
  ELECTRICITY_CRC_PER_KWH,
  EXCHANGE_RATE_CRC_PER_USD,
  PROFIT_MARGIN_PERCENT,
} from "@/config/pricing";

export interface PriceEstimateInput {
  printTimeHours: number;
  filamentGrams: number;
  material?: string;
}

export interface PriceEstimate {
  machineCostCrc: number;
  materialCostCrc: number;
  electricityCostCrc: number;
  subtotalCrc: number;
  priceCrc: number;
}

function filamentPriceUsdPerKg(material?: string): number {
  if (!material) return DEFAULT_FILAMENT_PRICE_USD_PER_KG;
  const key = material.trim().toLowerCase();
  return FILAMENT_PRICE_USD_PER_KG[key] ?? DEFAULT_FILAMENT_PRICE_USD_PER_KG;
}

/** Cost-based price estimate in CRC. See src/config/pricing.ts for the underlying
 * assumptions — every number here is adjustable there. */
export function estimatePriceCrc({ printTimeHours, filamentGrams, material }: PriceEstimateInput): PriceEstimate {
  const machineCostCrc =
    ((PRINTER_PRICE_USD * EXCHANGE_RATE_CRC_PER_USD) / PRINTER_LIFETIME_HOURS) * printTimeHours;

  const filamentUsdPerKg = filamentPriceUsdPerKg(material);
  const materialCostCrc =
    (filamentGrams / 1000) * (filamentUsdPerKg + SHIPPING_USD_PER_KG) * EXCHANGE_RATE_CRC_PER_USD;

  const electricityCostCrc = (PRINTER_AVERAGE_WATTS / 1000) * printTimeHours * ELECTRICITY_CRC_PER_KWH;

  const subtotalCrc = machineCostCrc + materialCostCrc + electricityCostCrc;
  const priceCrc = subtotalCrc * (1 + PROFIT_MARGIN_PERCENT / 100);

  return { machineCostCrc, materialCostCrc, electricityCostCrc, subtotalCrc, priceCrc };
}

/** Rounds to the nearest 100 CRC — avoids showing a price like ₡4,217. */
export function roundCrc(amount: number): number {
  return Math.round(amount / 100) * 100;
}

/** Turns 3.33 into "3 h 20 min" for display. */
export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function formatCrc(amount: number): string {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(amount);
}
