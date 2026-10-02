import type { APIRoute } from "astro";
import { getEnv } from "@/lib/products";
import { safeCompare } from "@/lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect, session }) => {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");

  const adminPassword = getEnv().ADMIN_PASSWORD;
  if (!adminPassword) {
    return new Response(
      "ADMIN_PASSWORD no está configurado. Agregalo como secret en Cloudflare antes de usar el admin.",
      { status: 500 }
    );
  }

  if (!(await safeCompare(password, adminPassword))) {
    return redirect("/admin/login?error=1");
  }

  await session?.regenerate();
  session?.set("isAdmin", true);

  return redirect("/admin");
};
