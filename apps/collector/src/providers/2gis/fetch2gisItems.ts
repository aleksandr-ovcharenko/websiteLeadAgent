import { z } from 'zod';

const pointSchema = z.object({
  lat: z.number().optional(),
  lon: z.number().optional()
});

const contactSchema = z.object({
  type: z.string().optional(),
  value: z.string().optional()
});

const itemSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  address_name: z.string().optional(),
  rubrics: z.array(z.object({ name: z.string().optional() })).optional(),
  point: pointSchema.optional(),
  url: z.string().optional(),
  contacts: z.array(contactSchema).optional()
});

const responseSchema = z.object({
  result: z
    .object({
      items: z.array(itemSchema).optional()
    })
    .optional()
});

export type DgisItem = z.infer<typeof itemSchema>;

export async function fetch2gisItems(input: {
  apiKey: string;
  city: string;
  query: string;
  page: number;
  pageSize: number;
}): Promise<DgisItem[]> {
  const { apiKey, city, query, page, pageSize } = input;

  const url = new URL('https://catalog.api.2gis.com/3.0/items');
  url.searchParams.set('q', `${query} ${city}`);
  url.searchParams.set('type', 'branch');
  url.searchParams.set('page', String(page));
  url.searchParams.set('page_size', String(pageSize));
  url.searchParams.set('key', apiKey);

  const res = await fetch(url, {
    headers: {
      accept: 'application/json'
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`2GIS HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = await res.json();
  const parsed = responseSchema.parse(json);

  return parsed.result?.items ?? [];
}
