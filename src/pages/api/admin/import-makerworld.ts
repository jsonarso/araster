import type { APIRoute } from "astro";

export const prerender = false;

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractMeta(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
    "i"
  );
  const match = html.match(re);
  return match ? decodeHtmlEntities(match[1]) : null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Best-effort search for a print-time estimate near the words "print time" /
 * "tiempo de impresión" in the raw HTML. MakerWorld's exact markup isn't
 * something we've been able to verify from this environment, so this is a
 * speculative pattern match — it may simply find nothing, which is fine, the
 * admin just fills that field in manually. */
function guessPrintTimeHours(html: string): number | null {
  const text = html.replace(/<[^>]+>/g, " ");
  const patterns = [
    /print(?:ing)?\s*time[^0-9]{0,20}(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\b/i,
    /(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\s*(?:print(?:ing)?\s*time)/i,
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match) {
      const hours = parseFloat(match[1]);
      if (!Number.isNaN(hours) && hours > 0 && hours < 1000) return hours;
    }
  }
  return null;
}

function stripSiteSuffix(title: string): string {
  return title.replace(/\s*[-|–]\s*MakerWorld\s*$/i, "").trim();
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

  let html: string;
  try {
    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ArasterImportBot/1.0)" },
    });
    if (!res.ok) {
      return jsonError(`MakerWorld respondió con error (${res.status}). Probá de nuevo o cargá los datos a mano.`, 502);
    }
    html = await res.text();
  } catch {
    return jsonError("No se pudo conectar con MakerWorld. Probá de nuevo o cargá los datos a mano.", 502);
  }

  const rawTitle = extractMeta(html, "og:title");
  const name = rawTitle ? stripSiteSuffix(rawTitle) : null;
  const description = extractMeta(html, "og:description");
  const image = extractMeta(html, "og:image");
  const printTimeHours = guessPrintTimeHours(html);

  if (!name && !description) {
    return jsonError(
      "No se pudo extraer información de esa página. Puede que MakerWorld haya cambiado su formato — cargá los datos a mano esta vez.",
      422
    );
  }

  return new Response(
    JSON.stringify({ ok: true, name, description, image, printTimeHours }),
    { headers: { "Content-Type": "application/json" } }
  );
};
