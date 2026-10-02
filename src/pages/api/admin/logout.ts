import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async ({ redirect, session }) => {
  session?.destroy();
  return redirect("/admin/login");
};
