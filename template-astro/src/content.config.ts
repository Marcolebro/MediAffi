import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    type: z.enum(['review', 'comparatif', 'top_list', 'guide', 'actu']),
    rating: z.number().min(0).max(10).optional(),
    affiliate_link: z.string().url().optional(),
    image: z.string().optional(),
    meta_description: z.string(),
    author: z.string().optional(),
  }),
});

export const collections = { articles };
