import { describe, expect, it } from 'vitest';
import { map2gisItemToLeadUpsert } from './map2gisItemToLeadUpsert.js';

describe('map2gisItemToLeadUpsert', () => {
  it('maps minimal 2gis item', () => {
    const mapped = map2gisItemToLeadUpsert({
      city: 'Минск',
      query: 'ремонт квартир',
      item: {
        id: '123',
        name: 'Test',
        address_name: 'Addr',
        rubrics: [{ name: 'Cat1' }],
        point: { lat: 53.9, lon: 27.56 },
        contacts: [
          { type: 'phone', value: '+375000000' },
          { type: 'website', value: 'https://example.com' }
        ],
        url: 'https://2gis.example/item/123'
      }
    });

    expect(mapped.sourceId).toBe('123');
    expect(mapped.create.companyName).toBe('Test');
    expect(mapped.create.city).toBe('Минск');
    expect(mapped.create.websiteDomain).toBe('example.com');
    expect(mapped.create.categories).toEqual(['Cat1']);
  });
});
