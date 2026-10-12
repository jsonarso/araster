// Central config for Araster. Edit WHATSAPP_NUMBER once you have the real number.
export const SITE = {
  name: "Araster",
  tagline: "Impresión 3D a medida",
  description:
    "Araster: piezas y modelos impresos en 3D. Funcionales, decorativos y a medida. Consultá por WhatsApp.",
  url: "https://araster.pages.dev",
  locale: "es",
  ogImage: "/og-image.svg",
};

export const WHATSAPP_NUMBER = "50683044678";

export const SOCIAL = {
  instagram: "https://instagram.com/araster.3d",
  email: "hola@araster.example",
};

/** Builds a wa.me deep link with an optional prefilled message. */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

export const WHATSAPP_MESSAGES = {
  general: "¡Hola! Quiero hacer una consulta sobre Araster.",
  product: (productName: string) =>
    `¡Hola! Quiero consultar por: ${productName}`,
  productWithColor: (productName: string, color: string) =>
    `¡Hola! Quiero consultar por: ${productName} en color ${color}`,
};

export const CATEGORIES = [
  {
    slug: "funcional",
    label: "Funcional",
    description: "Piezas útiles para el día a día: soportes, organizadores y más.",
  },
  {
    slug: "decorativo",
    label: "Decorativo",
    description: "Objetos para sumar diseño a tus espacios.",
  },
  {
    slug: "juguetes",
    label: "Juguetes",
    description: "Figuras articuladas, rompecabezas y piezas para jugar.",
  },
  {
    slug: "hogar-organizacion",
    label: "Hogar y Organización",
    description: "Soluciones para ordenar y aprovechar cada espacio.",
  },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

// Cross-cutting collections/tags — a product can have several (unlike CATEGORIES,
// which is one per product). Use these for seasonal drops or brand-specific fits.
// To add a new one, just add it here and reference its slug in a product's `tags`
// array — no other code changes needed.
export const TAGS = [
  { slug: "halloween", label: "Halloween" },
  { slug: "navidad", label: "Navidad" },
  { slug: "owala", label: "Owala" },
  { slug: "yeti", label: "Yeti" },
  { slug: "gadgets", label: "Gadgets" },
] as const;

export type TagSlug = (typeof TAGS)[number]["slug"];
