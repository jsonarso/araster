import type { APIRoute } from "astro";

export const prerender = false;

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** MakerWorld descriptions are rich-text HTML with a few custom wrapper tags
 * (<boostme>, <commercialme>) used for the "support the creator" blocks. Drop
 * those and flatten the rest to plain text with paragraph breaks. */
function htmlToText(html: string): string {
  const text = html
    .replace(/<(boostme|commercialme)[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(p|h[1-6]|li|div|figure)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeHtmlEntities(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");
}

interface MwDesign {
  title?: string;
  titleTranslated?: string;
  summary?: string;
  summaryTranslated?: string;
  coverUrl?: string;
  tags?: string[];
  tagsTranslated?: string[];
}

function modelIdFromUrl(url: URL): string | null {
  const match = url.pathname.match(/\/models\/(\d+)/);
  return match ? match[1] : null;
}

export const POST: APIRoute = async ({ request }) => {
  const { url } = (await request.json().catch(() => ({}))) as { url?: string };
  if (!url) return jsonError("Falta la URL.");

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return jsonError("La URL no es válida.");
  }
  if (!/(^|\.)makerworld\.com$/i.test(parsed.hostname)) {
    return jsonError("Solo se admiten links de makerworld.com.");
  }

  const modelId = modelIdFromUrl(parsed);
  if (!modelId) {
    return jsonError("El link no parece ser de un modelo de MakerWorld (/models/<número>-nombre).");
  }

  // The HTML page sits behind a Cloudflare challenge, but the JSON API the
  // frontend itself uses does not. X-BBL-Language makes it return the *Translated
  // fields (title, summary, tags) in Spanish.
  let design: MwDesign;
  try {
    const res = await fetch(`https://makerworld.com/api/v1/design-service/design/${modelId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ArasterImportBot/1.0)",
        Accept: "application/json",
        "X-BBL-Language": "es",
      },
    });
    if (!res.ok) {
      return jsonError(`MakerWorld respondió con error (${res.status}). Probá de nuevo o cargá los datos a mano.`, 502);
    }
    design = (await res.json()) as MwDesign;
  } catch {
    return jsonError("No se pudo conectar con MakerWorld. Probá de nuevo o cargá los datos a mano.", 502);
  }

  const name = (design.titleTranslated || design.title || "").trim() || null;
  const summaryHtml = design.summaryTranslated || design.summary || "";
  const description = summaryHtml ? htmlToText(summaryHtml) || null : null;
  const image = design.coverUrl || null;
  const tags = (design.tagsTranslated?.length ? design.tagsTranslated : design.tags) ?? [];

  // Print time / grams are deliberately NOT imported: MakerWorld's profiles are
  // usually a whole plate (several copies of the piece) sliced on the author's
  // printer, so they don't describe one piece on ours. The admin enters them
  // from their own slicer.

  if (!name && !description) {
    return jsonError(
      "No se pudo extraer información de esa página. Puede que MakerWorld haya cambiado su formato — cargá los datos a mano esta vez.",
      422
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      name,
      description,
      image,
      tags,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};
