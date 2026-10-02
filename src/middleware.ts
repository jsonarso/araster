import { defineMiddleware } from "astro:middleware";

const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/api/admin/login"]);

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (!isAdminArea || PUBLIC_ADMIN_PATHS.has(pathname)) {
    return next();
  }

  const isAdmin = await context.session?.get("isAdmin");
  if (!isAdmin) {
    if (pathname.startsWith("/api/admin")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return context.redirect("/admin/login");
  }

  return next();
});
