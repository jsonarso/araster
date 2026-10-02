/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare" />

declare module "cloudflare:workers" {
  const env: import("@/lib/products").Env;
  export { env };
}

declare namespace App {
  interface SessionData {
    isAdmin?: boolean;
  }
}
