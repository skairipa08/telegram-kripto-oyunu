import { describe, it, expect } from 'vitest';
import { en } from './translations/en';
import { tr } from './translations/tr';
import { ru } from './translations/ru';
import { SUPPORTED_LANGUAGES } from './types';

describe('i18n localization dictionaries', () => {
  it('supports en, tr, ru with all metadata', () => {
    expect(SUPPORTED_LANGUAGES.map((l) => l.code)).toEqual(['en', 'tr', 'ru']);
  });

  it('ensures all translation keys match across en, tr, and ru', () => {
    const enKeys = Object.keys(en).sort();
    const trKeys = Object.keys(tr).sort();
    const ruKeys = Object.keys(ru).sort();

    expect(trKeys).toEqual(enKeys);
    expect(ruKeys).toEqual(enKeys);
  });

  it('has non-empty values for every key in all languages', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value, EN missing key ).toBeTruthy();
    }
    for (const [key, value] of Object.entries(tr)) {
      expect(value, TR missing key ).toBeTruthy();
    }
    for (const [key, value] of Object.entries(ru)) {
      expect(value, RU missing key ).toBeTruthy();
    }
  });
});
