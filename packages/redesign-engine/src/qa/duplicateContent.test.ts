import { describe, expect, it } from 'vitest';
import { auditEntityDuplicates, detectSummaryDuplication, normalizeEntityContent } from './duplicateContent.js';

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
