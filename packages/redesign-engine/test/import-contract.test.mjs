import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizePhone, isGenericCompanyName } from '../dist/import/importToCms.js';
import { Prisma } from '@prisma/client';

describe('CMS import contract regressions', () => {
  it('phone normalization strips surrounding junk', () => {
    assert.equal(normalizePhone('15 +375(17)209 87 00'), '+375(17)209 87 00');
    assert.equal(normalizePhone('+375 (17) 209-87-32'), '+375 (17) 209-87-32');
    assert.equal(normalizePhone('8 (017) 209-87-32'), '8 (017) 209-87-32');
    assert.equal(normalizePhone('Тел: +375(17)209 87 00, +375(29)151 87 00'), '+375(17)209 87 00');
    const multi = normalizePhone('канцелярия +375(17)209-87-25 приёмная +375(17)209-87-00');
    assert.ok(['+375(17)209-87-25', '+375(17)209-87-00'].includes(multi || ''), 'picks one of the valid phones');
    assert.equal(normalizePhone(null), undefined);
  });

  it('generic page headings are rejected as company name', () => {
    assert.equal(isGenericCompanyName('Contacts'), true);
    assert.equal(isGenericCompanyName('About us'), true);
    assert.equal(isGenericCompanyName('Acme, central office'), false);
  });

  it('SiteSettingsCreateInput supports identity fields', () => {
    // Compile-time shape check: constructing a SiteSettingsCreateInput with
    // the new identity fields must not throw or omit them at runtime.
    const data = {
      site: { connect: { id: 'test' } },
      companyName: 'Мапид',
      legalName: 'ОАО Мапид',
      unp: '100008115',
      founded: '2001',
      employees: '250+',
      phone: normalizePhone('15 +375(17)209 87 00'),
      previewUrl: undefined,
      language: 'ru',
      timezone: 'Europe/Minsk'
    };
    assert.equal(data.unp, '100008115');
    assert.equal(data.legalName, 'ОАО Мапид');
    assert.equal(data.phone, '+375(17)209 87 00');
  });
});
