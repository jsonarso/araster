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

// Placeholder — swap for the real number (with country code, no + no spaces, e.g. "5491122334455")
export const WHATSAPP_NUMBER = "000000000";

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
