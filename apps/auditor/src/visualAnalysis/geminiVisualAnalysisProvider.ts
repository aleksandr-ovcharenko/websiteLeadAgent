import type { VisualAnalysisProvider } from './visualAnalysisProvider.js';
import { visualAnalysisProviderResultSchema, type VisualAnalysisInput } from './visualAnalysisSchema.js';

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return JSON.parse(trimmed);

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error('Could not extract JSON from model output');
}

export class GeminiVisualAnalysisProvider implements VisualAnalysisProvider {
  constructor(private readonly opts: { apiKey: string; model: string; promptVersion: string }) {}

  async analyze(input: VisualAnalysisInput) {
    const system =
      'You are a senior UX/UI reviewer. You analyze ONLY visual/UX quality and redesign potential of a company website. ' +
      'Do NOT evaluate performance/SEO (already provided separately). Do NOT invent facts. ' +
      'Return ONLY a valid JSON object matching the requested schema. Keep it concise. ' +
      'IMPORTANT: summary must be concise and no longer than 250 characters.';

    const user = {
      leadId: input.leadId,
      companyName: input.companyName,
      categories: input.categories,
      url: input.url,
      crawl: input.crawl,
      lighthouse: input.lighthouse,
      rubric: {
        scale: 'All numeric fields are integers 1..10 (1=very poor, 10=excellent).',
        limits: { problemsMax: 6, strengthsMax: 4, summaryMaxChars: 250 }
      },
      requiredJsonSchema: {
        modernity: '1..10',
        visualQuality: '1..10',
        mobileUX: '1..10',
        trust: '1..10',
        ctaQuality: '1..10',
        contentStructure: '1..10',
        visualHierarchy: '1..10',
        brandConsistency: '1..10',
        redesignPotential: '1..10',
        problems: 'array[string], <=6',
        strengths: 'array[string], <=4',
        summary: 'string <=250 chars'
      }
    };

    const contents = [
      {
        role: 'user',
        parts: [
          { text: `${system}\n\nINPUT:\n${JSON.stringify(user)}` },
          {
            inline_data: {
              mime_type: 'image/png',
              data: input.images.desktopPngBase64
            }
          },
          {
            inline_data: {
              mime_type: 'image/png',
              data: input.images.mobilePngBase64
            }
          }
        ]
      }
    ];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.opts.model)}:generateContent?key=${encodeURIComponent(this.opts.apiKey)}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 800
        }
      })
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      throw new Error(`Gemini error: ${resp.status} ${t}`);
    }

    const json = (await resp.json()) as any;
    const text =
      String(
        json.candidates?.[0]?.content?.parts
          ?.map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
          .join('') ??
          ''
      ) || '';

    const parsed = extractJson(text);
    const result = visualAnalysisProviderResultSchema.parse(parsed);

    return { result, model: this.opts.model, usage: json.usageMetadata ?? null };
  }
}
