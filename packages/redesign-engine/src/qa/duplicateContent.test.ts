import { describe, expect, it } from 'vitest';
import { auditEntityDuplicates, detectIntrablockDuplicates, detectSummaryDuplication, normalizeEntityContent } from './duplicateContent.js';

const SUMMARY = 'Первая секция страницы. Второй абзац текста о продукте и его применении в проектах';

describe('summary duplication — first surviving block', () => {
  it('drops a verbatim echo block and cascades the check to the next block', () => {
    const entity = {
      summary: SUMMARY,
      blocks: [
        { type: 'richText', content: 'Первая секция страницы.' },
        { type: 'richText', content: 'Второй абзац текста о продукте и его применении в проектах' },
        { type: 'richText', content: 'Уникальный блок, которого нет в summary.' },
      ],
    };
    const { entity: out, repairs } = normalizeEntityContent(entity);
    expect(repairs.filter((r) => r.kind === 'dropped-duplicate-summary').length).toBe(2);
    expect(out.blocks).toHaveLength(1);
    expect(auditEntityDuplicates(out)).toEqual([]);
  });

  it('strips a mid-content summary substring and keeps the rest of the block', () => {
    const entity = {
      summary: 'Только этот фрагмент повторяется внутри блока.',
      blocks: [
        { type: 'richText', heading: 'Описание', content: 'Вводная строка.\nТолько этот фрагмент повторяется внутри блока.\nЗавершающая строка с деталями.' },
      ],
    };
    const { entity: out } = normalizeEntityContent(entity);
    expect(String(out.blocks[0].content)).not.toContain('Только этот фрагмент');
    expect(String(out.blocks[0].content)).toContain('Вводная строка');
    expect(String(out.blocks[0].content)).toContain('Завершающая строка');
    expect(auditEntityDuplicates(out)).toEqual([]);
  });

  it('does not flag a textless first block (gallery/hero) as a summary echo', () => {
    const findings = detectSummaryDuplication(SUMMARY, [
      { type: 'gallery', imageIds: ['a.jpg'] },
      { type: 'richText', content: 'Обычный текст страницы без дублирования.' },
    ]);
    expect(findings).toEqual([]);
  });

  it('keeps a heading when only the body duplicates the summary', () => {
    const entity = {
      summary: 'Тело этого блока полностью повторено в summary продукта.',
      blocks: [
        { type: 'richText', heading: 'Преимущества', content: 'Тело этого блока полностью повторено в summary продукта.', items: ['Пункт один', 'Пункт два'] },
      ],
    };
    const { entity: out } = normalizeEntityContent(entity);
    expect(out.blocks[0].heading).toBe('Преимущества');
    expect(out.blocks[0].items).toHaveLength(2);
    expect(out.blocks[0].content).toBeUndefined();
    expect(auditEntityDuplicates(out)).toEqual([]);
  });
});

describe('glued-heading detector — Latin brands', () => {
  it('does not flag pure-Latin camelCase brand tokens', () => {
    const findings = detectIntrablockDuplicates({
      type: 'richText',
      content: 'Связаться: +375 (29) 331-20-17 (Viber, WhatsApp, Telegram) или +375 (33) 39-39-017 (Viber, WhatsApp, Telegram)',
    });
    expect(findings.filter((f) => f.kind === 'glued-heading')).toEqual([]);
  });

  it('still flags real Cyrillic glue', () => {
    const findings = detectIntrablockDuplicates({
      type: 'richText',
      content: 'Мы выполняем работыКачественно и в срок. Также предлагаем услугиСгарантией результата.',
    });
    expect(findings.some((f) => f.kind === 'glued-heading')).toBe(true);
  });
});

describe('sentence-level dedupe — repeated paragraph inside one line', () => {
  it('removes a verbatim repeated sentence and clears the audit', () => {
    const sentence = 'Двускатная крыша, хоть и самая стандартная форма, но при этом надежная и рациональная по своей цене.';
    const entity = {
      summary: 'Статья о выборе крыши.',
      blocks: [
        { type: 'richText', content: `Вводный абзац о крышах. ${sentence} Уникальный текст между повторами. ${sentence}` },
      ],
    };
    const { entity: out, repairs } = normalizeEntityContent(entity);
    expect(repairs.some((r) => r.kind === 'deduped-sentences')).toBe(true);
    expect(String(out.blocks[0].content).match(/двускатная крыша/gi)).toHaveLength(1);
    expect(auditEntityDuplicates(out)).toEqual([]);
  });

  it('keeps a single short repeat below the audit threshold', () => {
    const entity = {
      summary: 'Инструкция.',
      blocks: [{ type: 'richText', content: 'Первый пункт. Позвоните нам. Второй пункт. Позвоните нам.' }],
    };
    const { entity: out } = normalizeEntityContent(entity);
    expect(String(out.blocks[0].content).match(/Позвоните нам/g)).toHaveLength(2);
  });
});

describe('sentence-run dedupe — repeated boilerplate sequences', () => {
  it('drops the later copy of a repeated two-sentence run', () => {
    const run = 'минск, ул. примерная, 1. Режим работы сменный.';
    const entity = {
      summary: 'Вакансии компании.',
      blocks: [
        { type: 'richText', content: `Первая вакансия описание. ${run} Уникальные требования первой. Вторая вакансия описание. ${run} Уникальные требования второй.` },
      ],
    };
    const { entity: out, repairs } = normalizeEntityContent(entity);
    expect(repairs.some((r) => r.kind === 'deduped-sentences')).toBe(true);
    expect(auditEntityDuplicates(out)).toEqual([]);
  });
});

describe('decorative divider lines', () => {
  it('strips serialized <hr> artifacts from block content', () => {
    const entity = {
      summary: 'Условия кредита в магазине.',
      blocks: [
        { type: 'richText', content: `${'_'.repeat(129)}\nХотите обновить интерьер прямо сейчас? Оформляйте счёт-фактуру в любом магазине.` },
      ],
    };
    const { entity: out, repairs } = normalizeEntityContent(entity);
    expect(repairs.some((r) => r.kind === 'stripped-divider')).toBe(true);
    expect(String(out.blocks[0].content)).not.toMatch(/_{4,}/);
    expect(String(out.blocks[0].content)).toContain('Хотите обновить интерьер');
  });

  it('drops divider-only heading and divider items', () => {
    const entity = {
      summary: 'Разное описание страницы для теста.',
      blocks: [
        { type: 'richText', heading: '———————', content: 'Нормальный текст блока без разделителей.' },
        { type: 'features', items: ['Первый пункт достаточно длинный', '_____', 'Второй пункт достаточно длинный'] },
      ],
    };
    const { entity: out, repairs } = normalizeEntityContent(entity);
    expect(repairs.filter((r) => r.kind === 'stripped-divider').length).toBeGreaterThanOrEqual(2);
    expect(out.blocks[0].heading).toBeUndefined();
    expect(out.blocks[1].items).toHaveLength(2);
  });
});
