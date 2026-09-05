import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  validateFactCandidate,
  validatePhoneCandidate,
  validateEmailCandidate,
  validateAddressCandidate,
  validateEmployeeCount,
  validateFoundingDate,
  validateRegistrationId,
  FactGate,
} from '../dist/semantic/factValidation.js';

const phone = (raw, context = '') => validatePhoneCandidate(raw, context);
const email = (raw, context = '') => validateEmailCandidate(raw, context);
const address = (raw, context = '', source = '') => validateAddressCandidate(raw, context, source);

describe('fact validation', () => {
  describe('phone candidates', () => {
    it('rejects a year range (SAVIT regression)', () => {
      const r = phone('2007-2023');
      assert.equal(r.ok, false);
      assert.equal(r.rejectionReason, 'YEAR_RANGE');
    });

    it('rejects a bare 9-digit registration-style number (A-100 regression)', () => {
      const r = phone('101246411');
      assert.equal(r.ok, false);
    });

    it('rejects a 9-digit number in УНП context as REGISTRATION_ID', () => {
      const r = phone('101246411', 'УНП 101246411');
      assert.equal(r.ok, false);
      assert.equal(r.rejectionReason, 'REGISTRATION_ID');
    });

    it('rejects bank account fragments', () => {
      const r = phone('BY44 UNBS 3012 0000 0070 0600 0933', 'р/с BY44UNBS30120000007006000933 в ОАО "Банк"');
      assert.equal(r.ok, false);
    });

    it('rejects concatenated unrelated numbers', () => {
      const r = phone('+375 17 123-45-67 8029 555-66-77');
      assert.equal(r.ok, false);
    });

    it('rejects phone values fused with letters/email', () => {
      const r = phone('+375 17 123-45-67info');
      assert.equal(r.ok, false);
    });

    it('rejects a standalone year', () => {
      assert.equal(phone('2023').ok, false);
    });

    it('rejects too few and too many digits', () => {
      assert.equal(phone('12345').ok, false);
      assert.equal(phone('+375123456789012345678').ok, false);
    });

    it('accepts a labelled/standard phone', () => {
      const r = phone('+375 17 385-12-34', 'тел.:');
      assert.equal(r.ok, true);
      assert.equal(r.value, '+375 17 385-12-34');
    });
  });

  describe('email candidates', () => {
    it('accepts a clean email', () => {
      const r = email('info@company.by');
      assert.equal(r.ok, true);
      assert.equal(r.value, 'info@company.by');
    });

    it('cleans a noisy phone-prefix glued to an email', () => {
      const r = email('100-38-88info@company.by');
      assert.equal(r.ok, true);
      assert.equal(r.value, 'info@company.by');
    });

    it('rejects an email whose local part is only digits/dashes (phone fragment)', () => {
      const r = email('100-38-88@x.com');
      assert.equal(r.ok, false);
      assert.equal(r.rejectionReason, 'NUMERIC_LOCAL');
      // and an image/asset filename is rejected:
      assert.equal(email('icon@2x.png').ok, false);
    });

    it('rejects placeholder domains', () => {
      assert.equal(email('test@example.com').ok, false);
    });

    it('rejects non-email input', () => {
      assert.equal(email('not-an-email').ok, false);
    });
  });

  describe('address candidates', () => {
    it('rejects a catalog range text (SAVIT regression)', () => {
      const r = address('Проекты домов от 150 до 250 м2');
      assert.equal(r.ok, false);
      assert.equal(r.rejectionReason, 'CATALOG_OR_SERVICE_TEXT');
    });

    it('rejects opening hours text', () => {
      assert.equal(address('Пн-Пт 9:00 - 18:00, перерыв 13:00-14:00').ok, false);
    });

    it('rejects bank details', () => {
      assert.equal(address('р/с BY44UNBS30120000007006000933 в ОАО Банк, БИК UNBSBY2X').ok, false);
    });

    it('rejects a phone line', () => {
      assert.equal(address('тел. +375 17 385-12-34').ok, false);
    });

    it('accepts a schema.org PostalAddress', () => {
      const r = address('г. Минск, ул. Примерная, 15', '', 'jsonld');
      assert.equal(r.ok, true);
    });

    it('accepts a labelled address', () => {
      const r = address('г. Минск, ул. Примерная, 15, офис 301', 'Адрес офиса');
      assert.equal(r.ok, true);
    });

    it('accepts a street-token + number candidate', () => {
      const r = address('Минск, пр-т Победителей, 7');
      assert.equal(r.ok, true);
    });

    it('rejects plain body text with a digit but no address signal', () => {
      assert.equal(address('Компания осуществляет деятельность с 2010 года на рынке').ok, false);
    });
  });

  describe('employee count', () => {
    it('rejects a counter default of 0 (A-100 regression)', () => {
      const r = validateEmployeeCount('0 Сотрудников');
      assert.equal(r.ok, false);
      assert.equal(r.rejectionReason, 'COUNTER_ZERO');
    });

    it('rejects a number without employee wording', () => {
      assert.equal(validateEmployeeCount('150 проектов').ok, false);
    });

    it('accepts a real employee count', () => {
      const r = validateEmployeeCount('250 сотрудников');
      assert.equal(r.ok, true);
    });
  });

  describe('founding date', () => {
    it('rejects a year range', () => {
      assert.equal(validateFoundingDate('2007-2023').ok, false);
    });

    it('accepts a plausible year', () => {
      const r = validateFoundingDate('Основана в 2008 году');
      assert.equal(r.ok, true);
      assert.equal(r.value, '2008');
    });
  });

  describe('registration id', () => {
    it('rejects a bare 9-digit number without label', () => {
      assert.equal(validateRegistrationId('101246411', '').ok, false);
    });

    it('accepts a labelled УНП', () => {
      const r = validateRegistrationId('101246411', 'УНП 101246411');
      assert.equal(r.ok, true);
      assert.equal(r.value, '101246411');
    });
  });

  describe('FactGate', () => {
    it('keeps rejected candidates as diagnostics', () => {
      const gate = new FactGate();
      const ok = gate.accept({ rawValue: '2007-2023', attemptedType: 'PHONE', source: 'chrome-phone', sourceDocumentId: 'doc-1' });
      assert.equal(ok, undefined);
      assert.equal(gate.rejected.length, 1);
      assert.equal(gate.rejected[0].rawValue, '2007-2023');
      assert.equal(gate.rejected[0].attemptedType, 'PHONE');
      assert.equal(gate.rejected[0].rejectionReason, 'YEAR_RANGE');
      // drain empties the buffer
      const drained = gate.drain();
      assert.equal(drained.length, 1);
      assert.equal(gate.rejected.length, 0);
    });
  });
});
