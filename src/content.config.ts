import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const products = defineCollection({
  loader: glob({ pattern: "**/index.md", base: "./src/content/products" }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      category: z.enum([
        "funcional",
        "decorativo",
        "juguetes",
        "hogar-organizacion",
      ]),
      shortDescription: z.string(),
      tags: z.array(z.string()).default([]),
      photos: z.array(
        z.object({
          src: image(),
          alt: z.string(),
        })
      ).min(1),
      material: z.string().optional(),
      size: z.string().optional(),
      printTime: z.string().optional(),
      featured: z.boolean().default(false),
    }),
});

export const collections = { products };
