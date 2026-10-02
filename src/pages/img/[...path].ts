import type { APIRoute } from "astro";
import { getEnv } from "@/lib/products";

export const GET: APIRoute = async ({ params }) => {
  const key = params.path;
  if (!key) return new Response("Not found", { status: 404 });

  const object = await getEnv().PRODUCT_PHOTOS.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
};
