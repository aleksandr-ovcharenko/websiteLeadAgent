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

export class OpenAiVisualAnalysisProvider implements VisualAnalysisProvider {
  constructor(private readonly opts: { apiKey: string; model: string; promptVersion: string }) {}

  get promptVersion() {
    return this.opts.promptVersion;
  }

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

    const body = {
      model: this.opts.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: JSON.stringify(user) },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${input.images.desktopPngBase64}` }
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${input.images.mobilePngBase64}` }
            }
          ]
        }
      ]
    };

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.opts.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      throw new Error(`OpenAI error: ${resp.status} ${t}`);
    }

    const json = (await resp.json()) as any;
    const model = String(json.model ?? this.opts.model);
    const text = String(json.choices?.[0]?.message?.content ?? '');
    const parsed = extractJson(text);
    const result = visualAnalysisProviderResultSchema.parse(parsed);

    return { result, model, usage: json.usage ?? null };
  }
}
